-- Listing creation in one step, safe to retry (P1-10).
--
-- Before: the app inserted the listing, then its photos, in two requests.
-- A failure in between left a listing without photos; a double click, a
-- retried request or a lost response created the same listing twice.
--
-- After:
--   * create_listing(...) inserts the listing and its photos in one
--     transaction: either both are stored or neither.
--   * Every submission carries an idempotency key (a UUID the wizard keeps
--     with the draft). Sending the same key again returns the listing already
--     created instead of a second one, also for concurrent requests
--     (unique index on seller + key).
--   * Photo paths must be in the caller's own Storage folder ("<user id>/..."),
--     for create_listing and for direct listing_images writes by users, so a
--     listing cannot show another user's uploaded files.
--
-- create_listing is SECURITY INVOKER: the caller's RLS policies and all
-- listing triggers (quota, limits, validation, moderation) apply unchanged.
-- Needs 0009 (limits) and 0010 (rate_limited_caller).
--
-- Safe to re-run.

alter table public.listings add column if not exists idempotency_key uuid;

create unique index if not exists listings_seller_idempotency_uniq
  on public.listings (seller_id, idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- Photo paths stay in the owner's folder
-- ---------------------------------------------------------------------------

create or replace function public.guard_listing_image_path()
returns trigger language plpgsql as $$
begin
  if public.rate_limited_caller() then
    if auth.uid() is null
       or left(new.path, 37) <> auth.uid()::text || '/'
       or new.path ~ '(^|/)\.\.(/|$)'
       or char_length(new.path) > 300 then
      raise exception 'Fotoğraf yolu geçersiz.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists listing_images_path_guard on public.listing_images;
create trigger listing_images_path_guard before insert or update of path on public.listing_images
  for each row execute function public.guard_listing_image_path();

-- ---------------------------------------------------------------------------
-- create_listing
-- ---------------------------------------------------------------------------

create or replace function public.create_listing(
  p_key uuid,
  p_category text,
  p_title text,
  p_description text,
  p_price numeric,
  p_currency text,
  p_city text,
  p_district text,
  p_condition text,
  p_negotiable boolean,
  p_photos text[]
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_category int;
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;
  if p_key is null then
    raise exception 'Gönderim anahtarı eksik.' using errcode = '22023';
  end if;

  -- A retry of a submission that already went through.
  select id into v_id from listings where seller_id = v_uid and idempotency_key = p_key;
  if v_id is not null then
    return v_id;
  end if;

  if coalesce(cardinality(p_photos), 0) < 1 then
    raise exception 'En az 1 fotoğraf ekle.' using errcode = '23514';
  end if;
  select id into v_category from categories where slug = p_category;
  if v_category is null then
    raise exception 'Kategori seç.' using errcode = '23514';
  end if;

  insert into listings (seller_id, category_id, title, description, price, currency, city, district,
                        condition, negotiable, status, idempotency_key)
  values (v_uid, v_category, btrim(p_title), coalesce(p_description, ''), p_price, p_currency, p_city,
          nullif(btrim(coalesce(p_district, '')), ''), p_condition, coalesce(p_negotiable, false), 'pending', p_key)
  on conflict (seller_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- A concurrent request with the same key won; it stores the photos.
    select id into v_id from listings where seller_id = v_uid and idempotency_key = p_key;
    return v_id;
  end if;

  insert into listing_images (listing_id, path, position)
  select v_id, photo.path, photo.ord - 1
  from unnest(p_photos) with ordinality as photo(path, ord);

  return v_id;
end $$;

revoke execute on function public.create_listing(uuid, text, text, text, numeric, text, text, text, text, boolean, text[]) from public, anon;
grant execute on function public.create_listing(uuid, text, text, text, numeric, text, text, text, text, boolean, text[]) to authenticated;
