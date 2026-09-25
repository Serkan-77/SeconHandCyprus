-- Account deletion that removes the account's personal data but not other
-- people's records (P1-09).
--
-- Before: deleting an account (or a listing) cascaded into conversations, so
-- the other side lost the whole chat, including evidence of a scam. Support
-- tickets kept the deleted account's e-mail address.
--
-- After:
--   * conversations keep existing when the buyer, the seller or the listing is
--     deleted: buyer_id / seller_id / listing_id become NULL. Messages keep
--     existing when their sender is deleted: sender_id becomes NULL. The
--     remaining participant sees "Silinmiş kullanıcı" and can no longer send.
--   * no message can be sent into a conversation whose other side is gone.
--   * delete_my_account also replaces the e-mail address on the account's
--     support tickets (and anonymous tickets sent from the same address).
--
-- Deleted with the account (unchanged, by cascade): profile, private contact
-- data, listings and their photo rows, favourites, blocks, notifications,
-- verification requests, ratings, rate-limit events. Photo and avatar files
-- in Storage are removed by the app before calling delete_my_account
-- (src/lib/accountDeletion.ts); SQL cannot delete Storage files.
--
-- Foreign keys are dropped and re-added under the same names (the messages
-- page embeds through them). No rows are deleted. Needs 0011 (sanction check
-- in delete_my_account).
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Conversations and messages outlive a deleted account or listing
-- ---------------------------------------------------------------------------

alter table public.conversations
  alter column listing_id drop not null,
  alter column buyer_id drop not null,
  alter column seller_id drop not null;

alter table public.conversations
  drop constraint if exists conversations_listing_id_fkey,
  add constraint conversations_listing_id_fkey foreign key (listing_id) references public.listings (id) on delete set null,
  drop constraint if exists conversations_buyer_id_fkey,
  add constraint conversations_buyer_id_fkey foreign key (buyer_id) references public.profiles (id) on delete set null,
  drop constraint if exists conversations_seller_id_fkey,
  add constraint conversations_seller_id_fkey foreign key (seller_id) references public.profiles (id) on delete set null;

alter table public.messages alter column sender_id drop not null;
alter table public.messages
  drop constraint if exists messages_sender_id_fkey,
  add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles (id) on delete set null;

-- Replaces the 0001 policy: same rules, and the other participant must still
-- exist.
drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert
  with check (
    sender_id = auth.uid() and public.can_act() and public.is_participant(conversation_id)
    and public.conversation_other(conversation_id) is not null
    and not public.is_blocked_between(auth.uid(), public.conversation_other(conversation_id))
  );

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------

-- Replaces the 0011 version (same sanction check).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then raise exception 'Oturum bulunamadı.'; end if;
  if public.is_sanctioned(v_uid) then
    raise exception 'Hesabın kısıtlıyken silinemez. İtiraz için destek talebi oluşturabilirsin.' using errcode = 'PT403';
  end if;
  select email into v_email from auth.users where id = v_uid;
  update support_tickets
    set email = 'silinmis-hesap@kibrisikinciel.invalid'
    where user_id = v_uid
       or (user_id is null and v_email is not null and lower(email) = lower(v_email));
  delete from auth.users where id = v_uid;
end $$;
