-- Server-controlled columns on conversations, messages and listings.
--
-- RLS decides *which rows* a user may write, not *which columns*, so through
-- the public API (publishable key + PostgREST) a participant could rewrite a
-- conversation's buyer/seller/listing, a recipient could edit the text of a
-- message they received, and a seller could forge featured, view_count,
-- created_at, ref_no, slug and friends on their own listings. These triggers
-- pin those columns in the database.
--
-- Trusted callers keep full control, as in the existing guards: admins (for
-- listings), SECURITY DEFINER functions (they run as the owner, e.g.
-- on_message_created bumping last_message_at, increment_listing_view) and the
-- service role (seed script). The guard functions themselves are deliberately
-- NOT security definer, so current_user reflects the real caller.
--
-- Safe to re-run: functions are replaced and triggers dropped/recreated.

-- ---------------------------------------------------------------------------
-- Conversations: only the meeting confirmation may change (P0-03)
-- ---------------------------------------------------------------------------

create or replace function public.guard_conversation_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.listing_id is distinct from old.listing_id
     or new.buyer_id is distinct from old.buyer_id
     or new.seller_id is distinct from old.seller_id
     or new.created_at is distinct from old.created_at
     or new.last_message_at is distinct from old.last_message_at then
    raise exception 'Konuşmanın bu alanları değiştirilemez.' using errcode = '42501';
  end if;
  -- confirmMeeting: can be set once, is stamped by the server and never cleared.
  if new.meeting_confirmed_at is distinct from old.meeting_confirmed_at then
    new.meeting_confirmed_at := case
      when old.meeting_confirmed_at is not null or new.meeting_confirmed_at is null then old.meeting_confirmed_at
      else now() end;
  end if;
  return new;
end $$;

drop trigger if exists conversations_guard on public.conversations;
create trigger conversations_guard before update on public.conversations
  for each row execute function public.guard_conversation_update();

-- ---------------------------------------------------------------------------
-- Messages: sent messages are immutable; the recipient may only set read_at (P0-05)
-- ---------------------------------------------------------------------------

create or replace function public.guard_message_update()
returns trigger language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Gönderilmiş bir mesaj değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before update on public.messages
  for each row execute function public.guard_message_update();

-- ---------------------------------------------------------------------------
-- Listings: system columns are set by the database (P0-06)
-- ---------------------------------------------------------------------------

-- ref_no is now assigned in listing_defaults(), so a value sent by the client
-- can no longer take the place of the sequence default.
alter table public.listings alter column ref_no drop default;

-- Runs first on INSERT and UPDATE (triggers fire in name order:
-- listings_defaults, listings_guard, listings_updated_at).
create or replace function public.listing_defaults()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not (public.is_admin() or coalesce(current_setting('app.bypass', true), '') = 'on'
            or current_user in ('service_role', 'postgres', 'supabase_admin')) then
      new.featured := false;
      new.view_count := 0;
      new.created_at := now();
      new.updated_at := now();
      new.published_at := null;
      new.reject_reason := null;
      new.ref_no := null;
      new.slug := null;
    end if;
    if new.ref_no is null then
      new.ref_no := nextval('public.listing_ref_seq');
    end if;
    if new.slug is null then
      new.slug := public.slugify(new.title) || '-' || new.ref_no;
    end if;
  elsif new.title is distinct from old.title then
    new.slug := public.slugify(new.title) || '-' || new.ref_no;
  end if;
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end $$;

-- Sellers can edit their listings, mark them sold/removed or resubmit them for
-- review, but only moderators can publish, reject, feature or re-categorise.
create or replace function public.guard_listing_update()
returns trigger language plpgsql as $$
begin
  if public.is_admin() or coalesce(current_setting('app.bypass', true), '') = 'on'
     or current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  new.seller_id := old.seller_id;
  new.featured := old.featured;
  new.view_count := old.view_count;
  new.ref_no := old.ref_no;
  new.created_at := old.created_at;
  new.published_at := old.published_at;
  -- The listing edit form has no category field; only admins re-categorise.
  new.category_id := old.category_id;
  -- listings_defaults ran first and may have built the slug from a forged
  -- ref_no, or kept a slug sent by the client; rebuild it from trusted values.
  new.slug := case
    when new.title is distinct from old.title then public.slugify(new.title) || '-' || old.ref_no
    else old.slug end;
  if new.status is distinct from old.status then
    if new.status not in ('draft', 'pending', 'sold', 'removed') then
      raise exception 'Bu durum değişikliğine yetkin yok.';
    end if;
  end if;
  -- The rejection reason is the moderator's; resubmitting for review clears it.
  new.reject_reason := case
    when new.status = 'pending' and old.status is distinct from 'pending' then null
    else old.reject_reason end;
  return new;
end $$;
