-- Moderation integrity (P1-01, P1-02).
--
-- P1-01: an approved (active) listing whose content a seller changes goes back
-- to review. Content = title, description, condition, district (free text) and
-- photos (listing_images insert/update/delete). Price, currency, negotiable and
-- city (a fixed list) do not trigger review. category_id is already
-- admin-only (0005). Going back to review also drops the showcase flag.
--
-- P1-02: users under an active restriction or suspension (profiles.status
-- restricted/suspended until status_until, or indefinitely) cannot edit
-- listings or photos, rate, report or request a phone review; can_act()
-- already blocked new listings, favourites, conversations and messages. Their
-- active listings are hidden from the public by RLS instead of a status
-- change, so they reappear by themselves when a timed restriction ends.
-- Warned users are unaffected. Admins still see and manage everything.
--
-- Safe to re-run.

-- True while the user's restriction/suspension is in force (mirror of can_act()).
-- Profile status is public already; RLS policies call it as the caller.
create or replace function public.is_sanctioned(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = p_user
      and status in ('restricted', 'suspended')
      and (status_until is null or status_until >= now())
  )
$$;

-- ---------------------------------------------------------------------------
-- Listings: content edits by the seller go back to review (P1-01)
-- ---------------------------------------------------------------------------

-- Replaces the 0005 version; everything it did is kept.
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
  -- A published listing whose content changed is reviewed again.
  if old.status = 'active' and new.status = 'active' and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.condition is distinct from old.condition
    or new.district is distinct from old.district) then
    new.status := 'pending';
  end if;
  -- Leaving the public list also leaves the showcase.
  if old.status = 'active' and new.status <> 'active' then
    new.featured := false;
  end if;
  -- The rejection reason is the moderator's; resubmitting for review clears it.
  new.reject_reason := case
    when new.status = 'pending' and old.status is distinct from 'pending' then null
    else old.reject_reason end;
  return new;
end $$;

-- Photo changes on a published listing by its seller send it back to review.
-- SECURITY DEFINER so the status change passes guard_listing_update; admins,
-- the service role and SQL run without a JWT (auth.uid() null) are exempt.
create or replace function public.listing_images_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  affected uuid[];
begin
  if auth.uid() is null or public.is_admin() then
    return null;
  end if;
  if tg_op = 'INSERT' then
    affected := array[new.listing_id];
  elsif tg_op = 'DELETE' then
    affected := array[old.listing_id];
  else
    affected := array[new.listing_id, old.listing_id];
  end if;
  update listings set status = 'pending', featured = false, reject_reason = null
  where status = 'active' and id = any(affected);
  return null;
end $$;

revoke execute on function public.listing_images_moderation() from public, anon, authenticated;

drop trigger if exists listing_images_moderation on public.listing_images;
create trigger listing_images_moderation after insert or update or delete on public.listing_images
  for each row execute function public.listing_images_moderation();

-- ---------------------------------------------------------------------------
-- Sanctions: hide listings, block actions (P1-02)
-- ---------------------------------------------------------------------------

drop policy if exists "listings visible" on public.listings;
create policy "listings visible" on public.listings for select
  using (
    (status = 'active' and not public.is_sanctioned(seller_id))
    or seller_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "update own listing" on public.listings;
create policy "update own listing" on public.listings for update
  using ((seller_id = auth.uid() and public.can_act()) or public.is_admin())
  with check ((seller_id = auth.uid() and public.can_act()) or public.is_admin());

drop policy if exists "owner manages images" on public.listing_images;
create policy "owner manages images" on public.listing_images for all
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and ((l.seller_id = auth.uid() and public.can_act()) or public.is_admin())
  ))
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id and ((l.seller_id = auth.uid() and public.can_act()) or public.is_admin())
  ));

-- Same as 0006 plus can_act().
drop policy if exists "rate conversation partner" on public.ratings;
create policy "rate conversation partner" on public.ratings for insert
  with check (
    rater_id = auth.uid()
    and public.can_act()
    and public.is_participant(conversation_id)
    and ratee_id = public.conversation_other(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.buyer_confirmed_at is not null
        and c.seller_confirmed_at is not null
    )
  );

drop policy if exists "file report" on public.reports;
create policy "file report" on public.reports for insert
  with check (reporter_id = auth.uid() and public.can_act());

drop policy if exists "request verification" on public.verification_requests;
create policy "request verification" on public.verification_requests for insert
  with check (user_id = auth.uid() and status = 'pending' and public.can_act());

-- WhatsApp numbers of sellers whose listings are hidden are not handed out.
create or replace function public.get_listing_whatsapp(p_listing uuid)
returns text language sql stable security definer set search_path = public as $$
  select pp.phone
  from listings l join profile_private pp on pp.id = l.seller_id
  where l.id = p_listing and l.status = 'active' and pp.whatsapp_enabled
    and pp.phone is not null and auth.uid() is not null
    and not public.is_sanctioned(l.seller_id)
$$;
