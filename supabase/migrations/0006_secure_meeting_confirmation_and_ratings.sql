-- Two-sided meeting confirmation, ratings that require it, and server-set
-- columns on new conversations, messages and ratings (P0-04).
--
-- Before this migration either participant could set meeting_confirmed_at on
-- their own, the ratings policy never looked at it, and INSERTs through the
-- public API could forge created_at / last_message_at / meeting_confirmed_at
-- on conversations and created_at / read_at on messages.
--
-- Now each side stamps only its own confirmation (buyer_confirmed_at,
-- seller_confirmed_at) once, with the server clock; meeting_confirmed_at is
-- derived by the database when both are present, and a rating needs both.
--
-- Trusted callers (service role for the seed script, SECURITY DEFINER
-- functions running as the owner) keep full control, as in 0005.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Conversations: per-side confirmation columns
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column if not exists buyer_confirmed_at timestamptz,
  add column if not exists seller_confirmed_at timestamptz;

-- A meeting_confirmed_at written under the old one-sided model does not prove
-- that both people confirmed, so it is cleared rather than copied into both
-- columns. Ratings already given are left as they are.
update public.conversations
set meeting_confirmed_at = null
where meeting_confirmed_at is not null
  and (buyer_confirmed_at is null or seller_confirmed_at is null);

-- New conversations start unconfirmed, with server timestamps. buyer_id and
-- seller_id are still checked by the "buyer starts conversation" policy
-- (buyer = auth.uid(), seller = the listing's real seller).
create or replace function public.guard_conversation_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  new.created_at := now();
  new.last_message_at := now();
  new.meeting_confirmed_at := null;
  new.buyer_confirmed_at := null;
  new.seller_confirmed_at := null;
  return new;
end $$;

drop trigger if exists conversations_insert_guard on public.conversations;
create trigger conversations_insert_guard before insert on public.conversations
  for each row execute function public.guard_conversation_insert();

-- Replaces the 0005 version: identity columns stay immutable, each participant
-- may confirm only their own side, once, and meeting_confirmed_at follows.
create or replace function public.guard_conversation_update()
returns trigger language plpgsql as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.id is distinct from old.id
       or new.listing_id is distinct from old.listing_id
       or new.buyer_id is distinct from old.buyer_id
       or new.seller_id is distinct from old.seller_id
       or new.created_at is distinct from old.created_at
       or new.last_message_at is distinct from old.last_message_at
       or new.meeting_confirmed_at is distinct from old.meeting_confirmed_at then
      raise exception 'Konuşmanın bu alanları değiştirilemez.' using errcode = '42501';
    end if;
    if new.buyer_confirmed_at is distinct from old.buyer_confirmed_at then
      if auth.uid() is distinct from old.buyer_id then
        raise exception 'Karşı tarafın buluşma onayını değiştiremezsin.' using errcode = '42501';
      end if;
      -- Set once with the server clock; never moved or withdrawn.
      new.buyer_confirmed_at := coalesce(old.buyer_confirmed_at, case when new.buyer_confirmed_at is not null then now() end);
    end if;
    if new.seller_confirmed_at is distinct from old.seller_confirmed_at then
      if auth.uid() is distinct from old.seller_id then
        raise exception 'Karşı tarafın buluşma onayını değiştiremezsin.' using errcode = '42501';
      end if;
      new.seller_confirmed_at := coalesce(old.seller_confirmed_at, case when new.seller_confirmed_at is not null then now() end);
    end if;
  end if;
  if new.buyer_confirmed_at is not null and new.seller_confirmed_at is not null
     and new.meeting_confirmed_at is null then
    new.meeting_confirmed_at := now();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Messages: server timestamp, unread on arrival
-- ---------------------------------------------------------------------------

-- sender_id, membership, blocks and can_act() stay with the
-- "participants send messages" policy.
create or replace function public.guard_message_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  new.created_at := now();
  new.read_at := null;
  return new;
end $$;

drop trigger if exists messages_insert_guard on public.messages;
create trigger messages_insert_guard before insert on public.messages
  for each row execute function public.guard_message_insert();

-- ---------------------------------------------------------------------------
-- Ratings: only after both sides confirmed the meeting
-- ---------------------------------------------------------------------------

-- The rating's listing is the conversation's, and its date is the server's.
create or replace function public.guard_rating_insert()
returns trigger language plpgsql as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  new.created_at := now();
  new.listing_id := (select c.listing_id from public.conversations c where c.id = new.conversation_id);
  return new;
end $$;

drop trigger if exists ratings_insert_guard on public.ratings;
create trigger ratings_insert_guard before insert on public.ratings
  for each row execute function public.guard_rating_insert();

-- Same rules as before (rater is you, you took part, the ratee is the other
-- participant; one rating per conversation via unique(rater_id,
-- conversation_id); no UPDATE/DELETE policies) plus the two confirmations.
drop policy if exists "rate conversation partner" on public.ratings;
create policy "rate conversation partner" on public.ratings for insert
  with check (
    rater_id = auth.uid()
    and public.is_participant(conversation_id)
    and ratee_id = public.conversation_other(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.buyer_confirmed_at is not null
        and c.seller_confirmed_at is not null
    )
  );
