-- Live notifications, full admin control, listing details and store accounts.
--
-- 1. Realtime: notifications join the supabase_realtime publication, so the
--    header badge and the notification list update the moment a notification
--    is created (messages were already published in 0001).
-- 2. Admins: may edit any user's private contact data, delete any user's
--    Storage files, delete ratings, and delete an account with
--    admin_delete_user() (same clean-up as delete_my_account; never their own
--    account or another admin's).
-- 3. Listing details: listings.details (jsonb) holds optional attributes the
--    seller fills in (brand, model, colour, warranty, delivery, exchange...).
--    A change to details on a published listing sends it back to review like
--    any other content change. create_listing gets an overload that takes
--    p_details; the old signature stays so a deployment running the previous
--    app version keeps working.
-- 4. Stores: a profile can be a store (account_type = 'store') with a store
--    name and public business details. Only admins set store_verified.
--    Verified stores get a higher listing quota.
--
-- Needs 0013. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Realtime notifications
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Admin powers
-- ---------------------------------------------------------------------------

drop policy if exists "own private update" on public.profile_private;
create policy "own private update" on public.profile_private for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "admins delete files" on storage.objects;
create policy "admins delete files" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images', 'avatars') and public.is_admin());

drop policy if exists "admins delete ratings" on public.ratings;
create policy "admins delete ratings" on public.ratings for delete using (public.is_admin());

-- Deletes another user's account. Storage files are removed by the app first
-- (src/lib/accountDeletion.ts), as for delete_my_account.
create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'Kendi hesabını buradan silemezsin.' using errcode = '22023';
  end if;
  if exists (select 1 from profiles where id = p_user and role = 'admin') then
    raise exception 'Yönetici hesabı silinemez; önce yetkisini kaldır.' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = p_user;
  update support_tickets
    set email = 'silinmis-hesap@kibrisikinciel.invalid'
    where user_id = p_user
       or (user_id is null and v_email is not null and lower(email) = lower(v_email));
  delete from auth.users where id = p_user;
end $$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Listing details
-- ---------------------------------------------------------------------------

alter table public.listings add column if not exists details jsonb not null default '{}'::jsonb;
alter table public.listings
  drop constraint if exists listings_details_shape,
  add constraint listings_details_shape check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2000);

-- Replaces the 0008 version; adds details to the content that is reviewed again.
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
    or new.district is distinct from old.district
    or new.details is distinct from old.details) then
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

-- The 0013 function with details; the old overload is kept (see header).
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
  p_photos text[],
  p_details jsonb
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
                        condition, negotiable, status, idempotency_key, details)
  values (v_uid, v_category, btrim(p_title), coalesce(p_description, ''), p_price, p_currency, p_city,
          nullif(btrim(coalesce(p_district, '')), ''), p_condition, coalesce(p_negotiable, false), 'pending', p_key,
          coalesce(p_details, '{}'::jsonb))
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

revoke execute on function public.create_listing(uuid, text, text, text, numeric, text, text, text, text, boolean, text[], jsonb) from public, anon;
grant execute on function public.create_listing(uuid, text, text, text, numeric, text, text, text, text, boolean, text[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Store accounts
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists account_type text not null default 'personal',
  add column if not exists store_name text,
  add column if not exists store_verified boolean not null default false,
  add column if not exists store_address text,
  add column if not exists store_phone text,
  add column if not exists store_website text,
  add column if not exists store_hours text;

alter table public.profiles
  drop constraint if exists profiles_account_type_known,
  add constraint profiles_account_type_known check (account_type in ('personal', 'store')),
  drop constraint if exists profiles_store_name_length,
  add constraint profiles_store_name_length check (store_name is null or char_length(btrim(store_name)) between 2 and 60),
  drop constraint if exists profiles_store_needs_name,
  add constraint profiles_store_needs_name check (account_type <> 'store' or store_name is not null),
  drop constraint if exists profiles_store_address_length,
  add constraint profiles_store_address_length check (store_address is null or char_length(store_address) <= 160),
  drop constraint if exists profiles_store_phone_format,
  add constraint profiles_store_phone_format check (store_phone is null or store_phone ~ '^\+?[0-9]{10,15}$'),
  drop constraint if exists profiles_store_website_format,
  add constraint profiles_store_website_format check (store_website is null or (store_website ~ '^https?://' and char_length(store_website) <= 200)),
  drop constraint if exists profiles_store_hours_length,
  add constraint profiles_store_hours_length check (store_hours is null or char_length(store_hours) <= 80);

create index if not exists profiles_store_idx on public.profiles (account_type) where account_type = 'store';

-- Replaces the 0001 version; the store badge is the admins' too.
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() and coalesce(current_setting('app.bypass', true), '') <> 'on'
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.role := old.role;
    new.status := old.status;
    new.status_until := old.status_until;
    new.phone_verified := old.phone_verified;
    -- Renaming the store or turning it back into a personal account drops the badge.
    new.store_verified := old.store_verified
      and new.account_type = 'store'
      and new.store_name is not distinct from old.store_name;
  end if;
  return new;
end $$;

-- Replaces the 0009 version; verified stores may keep more listings open.
create or replace function public.enforce_listing_quota()
returns trigger language plpgsql as $$
declare
  open_count int;
  day_count int;
  v_store boolean;
  v_open_max int;
  v_day_max int;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') or public.is_admin() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('listing_quota:' || new.seller_id::text, 0));
  select coalesce(account_type = 'store' and store_verified, false) into v_store
    from public.profiles where id = new.seller_id;
  v_open_max := case when v_store then 500 else 50 end;
  v_day_max := case when v_store then 100 else 10 end;
  select count(*) filter (where status in ('draft', 'pending', 'active')),
         count(*) filter (where created_at > now() - interval '24 hours')
    into open_count, day_count
  from public.listings where seller_id = new.seller_id;
  if open_count >= v_open_max then
    raise exception 'Aynı anda en fazla % açık ilanın olabilir. Satılan ya da eski ilanlarını kaldır.', v_open_max using errcode = 'PT429';
  end if;
  if day_count >= v_day_max then
    raise exception 'Bir günde en fazla % ilan verebilirsin. Yarın tekrar dene.', v_day_max using errcode = 'PT429';
  end if;
  return new;
end $$;
