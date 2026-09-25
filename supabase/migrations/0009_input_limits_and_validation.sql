-- Marketplace limits and input validation in the database (P1-05, P1-06).
--
-- The server actions validate with Zod (src/lib/validation.ts, same numbers);
-- these constraints hold the same rules for any request that skips the app.
-- Existing development data was checked before writing this file: no row
-- violates any constraint below.
--
-- Limits (mirrored in LIMITS, src/lib/validation.ts):
--   10 photos per listing; 50 open (draft/pending/active) listings per seller;
--   10 new listings per seller per 24 hours. The demo data peaks at 4 open
--   listings per seller. Admins, the service role (seed) and SQL run without a
--   JWT are exempt.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- P1-05: photos per listing
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_image_limit()
returns trigger language plpgsql as $$
declare
  n int;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.listing_id is not distinct from old.listing_id then
    return new;
  end if;
  -- Serialise concurrent uploads to the same listing so two requests cannot
  -- both see 9 photos and both insert.
  perform pg_advisory_xact_lock(hashtextextended('listing_images:' || new.listing_id::text, 0));
  select count(*) into n from public.listing_images where listing_id = new.listing_id;
  if n >= 10 then
    raise exception 'Bir ilana en fazla 10 fotoğraf eklenebilir.' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists listing_images_limit on public.listing_images;
create trigger listing_images_limit before insert or update of listing_id on public.listing_images
  for each row execute function public.enforce_listing_image_limit();

-- ---------------------------------------------------------------------------
-- P1-05: listings per seller
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_quota()
returns trigger language plpgsql as $$
declare
  open_count int;
  day_count int;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') or public.is_admin() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('listing_quota:' || new.seller_id::text, 0));
  select count(*) filter (where status in ('draft', 'pending', 'active')),
         count(*) filter (where created_at > now() - interval '24 hours')
    into open_count, day_count
  from public.listings where seller_id = new.seller_id;
  if open_count >= 50 then
    raise exception 'Aynı anda en fazla 50 açık ilanın olabilir. Satılan ya da eski ilanlarını kaldır.' using errcode = 'PT429';
  end if;
  if day_count >= 10 then
    raise exception 'Bir günde en fazla 10 ilan verebilirsin. Yarın tekrar dene.' using errcode = 'PT429';
  end if;
  return new;
end $$;

drop trigger if exists listings_quota on public.listings;
create trigger listings_quota before insert on public.listings
  for each row execute function public.enforce_listing_quota();

-- ---------------------------------------------------------------------------
-- P1-06: CHECK constraints
-- ---------------------------------------------------------------------------

alter table public.listings
  drop constraint if exists listings_title_trimmed,
  add constraint listings_title_trimmed check (char_length(btrim(title)) between 3 and 120),
  drop constraint if exists listings_description_length,
  add constraint listings_description_length check (char_length(description) <= 5000),
  drop constraint if exists listings_district_length,
  add constraint listings_district_length check (district is null or char_length(btrim(district)) between 1 and 60),
  drop constraint if exists listings_city_known,
  add constraint listings_city_known check (city in ('Lefkoşa', 'Girne', 'Gazimağusa', 'Güzelyurt', 'İskele', 'Larnaka', 'Limasol', 'Baf')),
  drop constraint if exists listings_price_max,
  add constraint listings_price_max check (price <= 10000000);

alter table public.profiles alter column display_name set default 'Kullanıcı';
alter table public.profiles
  drop constraint if exists profiles_display_name_length,
  add constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 40),
  drop constraint if exists profiles_bio_length,
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  drop constraint if exists profiles_region_known,
  add constraint profiles_region_known check (region is null or region in ('Lefkoşa', 'Girne', 'Gazimağusa', 'Güzelyurt', 'İskele', 'Larnaka', 'Limasol', 'Baf'));

alter table public.profile_private
  drop constraint if exists profile_private_phone_format,
  add constraint profile_private_phone_format check (phone is null or phone ~ '^\+?[0-9]{10,15}$');

alter table public.messages
  drop constraint if exists messages_body_not_blank,
  add constraint messages_body_not_blank check (char_length(btrim(body)) >= 1);

alter table public.ratings
  drop constraint if exists ratings_comment_length,
  add constraint ratings_comment_length check (comment is null or char_length(comment) <= 500);

alter table public.reports
  drop constraint if exists reports_reason_length,
  add constraint reports_reason_length check (char_length(btrim(reason)) between 1 and 100),
  drop constraint if exists reports_detail_length,
  add constraint reports_detail_length check (detail is null or char_length(detail) <= 1000);

alter table public.support_tickets
  drop constraint if exists support_tickets_email_format,
  add constraint support_tickets_email_format check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  drop constraint if exists support_tickets_topic_length,
  add constraint support_tickets_topic_length check (char_length(btrim(topic)) between 1 and 60),
  drop constraint if exists support_tickets_message_length,
  add constraint support_tickets_message_length check (char_length(btrim(message)) between 10 and 5000);

alter table public.verification_requests
  drop constraint if exists verification_requests_detail_format,
  add constraint verification_requests_detail_format check (
    char_length(detail) <= 254 and (kind <> 'phone' or detail ~ '^\+?[0-9]{10,15}$')
  );

-- ---------------------------------------------------------------------------
-- Sign-up: fit metadata into the constraints instead of failing the sign-up
-- ---------------------------------------------------------------------------

-- Replaces the 0003 version (same sources for name/region/avatar/phone).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 40));
  v_region text := nullif(new.raw_user_meta_data ->> 'region', '');
  v_phone text := regexp_replace(coalesce(new.phone, new.raw_user_meta_data ->> 'phone', ''), '\s', '', 'g');
begin
  if char_length(v_name) < 2 then
    v_name := 'Kullanıcı';
  end if;
  if v_region not in ('Lefkoşa', 'Girne', 'Gazimağusa', 'Güzelyurt', 'İskele', 'Larnaka', 'Limasol', 'Baf') then
    v_region := null;
  end if;
  if v_phone !~ '^\+?[0-9]{10,15}$' then
    v_phone := null;
  end if;
  insert into profiles (id, display_name, region, avatar_url)
  values (new.id, v_name, v_region, nullif(new.raw_user_meta_data ->> 'avatar_url', ''));
  insert into profile_private (id, email, phone)
  values (new.id, new.email, v_phone);
  return new;
end $$;
