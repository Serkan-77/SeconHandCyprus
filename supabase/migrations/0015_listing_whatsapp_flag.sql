-- Whether a listing's seller accepts WhatsApp, without revealing the number.
--
-- Before: every listing showed a WhatsApp button; for sellers who keep their
-- number private (the default) it only said so after a click, and the click
-- counted against the buyer's number-lookup limit (0010).
--
-- After: listing_accepts_whatsapp() answers yes/no, so the page shows the
-- button only for sellers who opted in, and says "in-app messages only"
-- otherwise. The number itself is still only returned by
-- get_listing_whatsapp() to signed-in users, with the rate limit.
--
-- Safe to re-run. The app falls back to always showing the button while this
-- function does not exist, so deploy order does not matter.

create or replace function public.listing_accepts_whatsapp(p_listing uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pp.whatsapp_enabled and pp.phone is not null
    from listings l join profile_private pp on pp.id = l.seller_id
    where l.id = p_listing and l.status = 'active'
  ), false)
$$;

revoke execute on function public.listing_accepts_whatsapp(uuid) from public;
grant execute on function public.listing_accepts_whatsapp(uuid) to anon, authenticated;
