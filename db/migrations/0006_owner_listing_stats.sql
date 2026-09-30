-- How many people saved a listing, for its seller (dashboard, listing page)
-- and admins. Favorites rows stay private to their owners under row level
-- security; this returns only a count, and only to the listing's seller or
-- an admin (NULL for anyone else).

create or replace function public.listing_favorite_count(p_listing uuid)
returns int language sql stable security definer set search_path = public, app as $$
  select case
    when exists (select 1 from listings l where l.id = p_listing and (l.seller_id = app.uid() or public.is_admin()))
    then (select count(*)::int from favorites f where f.listing_id = p_listing)
  end
$$;

revoke execute on function public.listing_favorite_count(uuid) from public;
grant execute on function public.listing_favorite_count(uuid) to kie_app;
