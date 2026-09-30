-- Kıbrıs İkinci Elcim — baseline schema for the self-hosted PostgreSQL.
--
-- This is the effective final state of supabase/migrations/0001 → 0015,
-- ported off Supabase. Every business rule, trigger, constraint and row level
-- security policy is kept; only the Supabase plumbing changes:
--
--   auth.uid()                       → app.uid()   (set per transaction by the API)
--   auth.jwt() ->> 'role'            → app.role()  ('anon' | 'user' | 'system')
--   current_user in (service_role…)  → app.trusted()
--   storage.objects + policies       → public.uploads + API checks
--   supabase_realtime publication    → pg_notify('app_events') triggers (0003)
--   auth.users (Supabase)            → auth.users (ours, 0002)
--
-- Roles (created by db/init/00-roles.sh, not here):
--   kie_owner  owns every object, runs migrations; RLS does not apply to it.
--   kie_app    the API at runtime: DML only, RLS applies, no DDL.
--
-- The API opens a transaction per request and runs
--   select set_config('app.user_id', <uuid or ''>, true),
--          set_config('app.role', 'anon' | 'user' | 'system', true)
-- so policies and triggers see the caller. 'system' is only used by trusted
-- server code (jobs, the Supabase import, seed) and never derived from input.

create extension if not exists pg_trgm;
create extension if not exists citext;

create schema if not exists app;
create schema if not exists auth;

-- ---------------------------------------------------------------------------
-- Caller context
-- ---------------------------------------------------------------------------

create or replace function app.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function app.role()
returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.role', true), ''), '')
$$;

-- Trusted callers keep full control, as the service role / postgres / SECURITY
-- DEFINER functions did on Supabase: anything not running as the API role
-- (migrations, SECURITY DEFINER functions owned by kie_owner, psql) and API
-- code that explicitly runs as 'system'. The guard functions themselves are
-- NOT security definer, so current_user reflects the real caller.
create or replace function app.trusted()
returns boolean language sql stable as $$
  select current_user <> 'kie_app' or app.role() = 'system'
$$;

-- Lowercase ASCII fold used for slugs and search (Turkish letters included).
create or replace function app.fold(value text)
returns text language sql immutable parallel safe as $$
  select lower(translate(coalesce(value, ''),
    'çğıöşüÇĞIİÖŞÜâîûÂÎÛéÉ', 'cgiosucgiiosuaiuaiuee'))
$$;

create or replace function public.slugify(value text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(app.fold(value), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Accounts (the auth tables themselves are in 0002_auth.sql)
-- ---------------------------------------------------------------------------

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (char_length(email) <= 254),
  email_verified_at timestamptz,
  -- Argon2id ("$argon2id$…") for passwords set here; bcrypt ("$2a$…") for
  -- accounts imported from Supabase until their next sign-in rehashes it.
  -- NULL for accounts that only sign in with Google.
  password_hash text,
  password_changed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at before update on auth.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Regions (Cyprus). A table instead of a CHECK list so a region can be added
-- without a code change; listings and profiles reference it by name.
-- ---------------------------------------------------------------------------

create table public.regions (
  name text primary key,
  slug text not null unique,
  side text not null check (side in ('north', 'south')),
  lat double precision not null,
  lng double precision not null,
  sort_order int not null default 0
);

insert into public.regions (name, slug, side, lat, lng, sort_order) values
  ('Lefkoşa', 'lefkosa', 'north', 35.1856, 33.3823, 1),
  ('Girne', 'girne', 'north', 35.3364, 33.3199, 2),
  ('Gazimağusa', 'gazimagusa', 'north', 35.125, 33.9417, 3),
  ('Güzelyurt', 'guzelyurt', 'north', 35.1983, 32.9936, 4),
  ('İskele', 'iskele', 'north', 35.2869, 33.8911, 5),
  ('Larnaka', 'larnaka', 'south', 34.9167, 33.6233, 6),
  ('Limasol', 'limasol', 'south', 34.6841, 33.0379, 7),
  ('Baf', 'baf', 'south', 34.7754, 32.4245, 8);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Kullanıcı'
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 40),
  avatar_url text,
  region text references public.regions (name) on update cascade,
  bio text constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'warned', 'restricted', 'suspended')),
  status_until timestamptz,
  phone_verified boolean not null default false,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 2000),
  account_type text not null default 'personal'
    constraint profiles_account_type_known check (account_type in ('personal', 'store')),
  store_name text constraint profiles_store_name_length check (store_name is null or char_length(btrim(store_name)) between 2 and 60),
  store_verified boolean not null default false,
  store_address text constraint profiles_store_address_length check (store_address is null or char_length(store_address) <= 160),
  store_phone text constraint profiles_store_phone_format check (store_phone is null or store_phone ~ '^\+?[0-9]{10,15}$'),
  store_website text constraint profiles_store_website_format check (store_website is null or (store_website ~ '^https?://' and char_length(store_website) <= 200)),
  store_hours text constraint profiles_store_hours_length check (store_hours is null or char_length(store_hours) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_store_needs_name check (account_type <> 'store' or store_name is not null),
  constraint profiles_avatar_length check (avatar_url is null or char_length(avatar_url) <= 500)
);

create index profiles_store_idx on public.profiles (account_type) where account_type = 'store';

-- Contact details are kept apart from the public profile so they are never
-- readable by other users; only the owner and admins can see them. (The e-mail
-- address lives in auth.users only.)
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text constraint profile_private_phone_format check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  whatsapp_enabled boolean not null default false
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from profiles where id = app.uid() and role = 'admin')
$$;

-- True when the current user may create listings, send messages, favorite, etc.
create or replace function public.can_act()
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from profiles
    where id = app.uid()
      and (status in ('active', 'warned') or (status_until is not null and status_until < now()))
  )
$$;

-- True while the user's restriction/suspension is in force (mirror of can_act()).
create or replace function public.is_sanctioned(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = p_user
      and status in ('restricted', 'suspended')
      and (status_until is null or status_until >= now())
  )
$$;

-- Admins, trusted code and the caller's own identity are the only ones who
-- may bypass rate limits; everyone else is counted (fail closed).
create or replace function public.rate_limited_caller()
returns boolean language sql stable set search_path = public, app as $$
  select not app.trusted() and not public.is_admin()
$$;

-- ---------------------------------------------------------------------------
-- Uploads: every file stored by the API. Replaces storage.objects and its
-- "own folder" policies: a listing photo or an avatar must be an upload that
-- belongs to the caller (checked by the triggers below and by the API).
-- ---------------------------------------------------------------------------

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('listing', 'avatar')),
  -- Storage key prefix, e.g. "l/2026/10/<uuid>"; variants live under it.
  key text not null unique check (key ~ '^[a-z]/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}$'),
  width int not null check (width > 0),
  height int not null check (height > 0),
  bytes int not null check (bytes > 0),
  attached_at timestamptz,
  created_at timestamptz not null default now()
);

create index uploads_owner_idx on public.uploads (owner_id, created_at desc);
create index uploads_orphans_idx on public.uploads (created_at) where attached_at is null;

-- Users may only change a profile's own fields: not their role, status,
-- badges; the avatar must be their own upload (or cleared).
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() and not app.trusted() then
    new.role := old.role;
    new.status := old.status;
    new.status_until := old.status_until;
    new.phone_verified := old.phone_verified;
    new.created_at := old.created_at;
    -- Renaming the store or turning it back into a personal account drops the badge.
    new.store_verified := old.store_verified
      and new.account_type = 'store'
      and new.store_name is not distinct from old.store_name;
    if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null
       and not exists (select 1 from public.uploads u
                       where u.key = new.avatar_url and u.owner_id = app.uid() and u.kind = 'avatar') then
      raise exception 'Profil fotoğrafı geçersiz.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- phone_verified must describe the number currently on file (0007).
create or replace function public.reset_phone_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set phone_verified = false where id = new.id and phone_verified;
  return null;
end $$;

revoke execute on function public.reset_phone_verification() from public;

create trigger profile_private_phone_changed after update of phone on public.profile_private
  for each row when (old.phone is distinct from new.phone)
  execute function public.reset_phone_verification();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id serial primary key,
  parent_id int references public.categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  name_en text check (name_en is null or char_length(btrim(name_en)) between 2 and 60),
  icon text not null default 'grid' check (char_length(icon) <= 40),
  description text check (description is null or char_length(description) <= 300),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create index categories_parent_idx on public.categories (parent_id, sort_order);

create sequence public.listing_ref_seq start 10480;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique,
  slug text unique,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id int not null references public.categories (id),
  title text not null
    constraint listings_title_trimmed check (char_length(btrim(title)) between 3 and 120),
  description text not null default ''
    constraint listings_description_length check (char_length(description) <= 5000),
  price numeric(12, 2) not null check (price >= 0)
    constraint listings_price_max check (price <= 10000000),
  currency text not null default 'TL' check (currency in ('TL', '€')),
  city text not null references public.regions (name) on update cascade,
  district text constraint listings_district_length check (district is null or char_length(btrim(district)) between 1 and 60),
  condition text not null check (condition in ('Sıfır', 'Az kullanılmış', 'Yıpranmış')),
  negotiable boolean not null default false,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'active', 'rejected', 'sold', 'removed')),
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 500),
  featured boolean not null default false,
  view_count int not null default 0,
  -- Category-specific attributes, validated by the API against
  -- category_attributes (0004). Keys are attribute keys, values are strings,
  -- numbers, booleans or arrays of option values.
  attributes jsonb not null default '{}'::jsonb
    constraint listings_attributes_shape check (jsonb_typeof(attributes) = 'object' and pg_column_size(attributes) <= 4000),
  idempotency_key uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Accent- and case-insensitive text for keyword search.
  search_text text generated always as (app.fold(title || ' ' || description)) stored
);

create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_active_feed_idx on public.listings (featured desc, created_at desc) where status = 'active';
create index listings_active_category_idx on public.listings (category_id, created_at desc) where status = 'active';
create index listings_active_city_idx on public.listings (city, created_at desc) where status = 'active';
create index listings_active_price_idx on public.listings (price) where status = 'active';
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_search_trgm_idx on public.listings using gin (search_text gin_trgm_ops);
create index listings_attributes_idx on public.listings using gin (attributes jsonb_path_ops);
create unique index listings_seller_idempotency_uniq
  on public.listings (seller_id, idempotency_key) where idempotency_key is not null;

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- System columns are set by the database (P0-06). Runs first on INSERT and
-- UPDATE (triggers fire in name order: listings_defaults, listings_guard,
-- listings_quota, listings_updated_at).
create or replace function public.listing_defaults()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not (public.is_admin() or app.trusted()) then
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
  -- The showcase (Vitrin) only ever holds published listings, whoever
  -- changes the status (the admin exemption in guard_listing_update used to
  -- leave a rejected listing marked as featured).
  if new.status <> 'active' then
    new.featured := false;
  end if;
  return new;
end $$;

create trigger listings_defaults before insert or update on public.listings
  for each row execute function public.listing_defaults();

-- Sellers can edit their listings, mark them sold/removed or resubmit them for
-- review, but only moderators can publish, reject, feature or re-categorise
-- (0005, 0008, 0014). A published listing whose content changes goes back to
-- review.
create or replace function public.guard_listing_update()
returns trigger language plpgsql as $$
begin
  if public.is_admin() or app.trusted() then
    return new;
  end if;
  new.seller_id := old.seller_id;
  new.featured := old.featured;
  new.view_count := old.view_count;
  new.ref_no := old.ref_no;
  new.created_at := old.created_at;
  new.published_at := old.published_at;
  new.idempotency_key := old.idempotency_key;
  -- Only admins re-categorise.
  new.category_id := old.category_id;
  -- listings_defaults ran first and may have built the slug from a forged
  -- ref_no, or kept a slug sent by the client; rebuild it from trusted values.
  new.slug := case
    when new.title is distinct from old.title then public.slugify(new.title) || '-' || old.ref_no
    else old.slug end;
  if new.status is distinct from old.status then
    if new.status not in ('draft', 'pending', 'sold', 'removed') then
      raise exception 'Bu durum değişikliğine yetkin yok.' using errcode = '42501';
    end if;
  end if;
  -- A published listing whose content changed is reviewed again.
  if old.status = 'active' and new.status = 'active' and (
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.condition is distinct from old.condition
    or new.district is distinct from old.district
    or new.attributes is distinct from old.attributes) then
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

create trigger listings_guard before update on public.listings
  for each row execute function public.guard_listing_update();

-- Listings per seller (P1-05, 0014): verified stores may keep more open.
create or replace function public.enforce_listing_quota()
returns trigger language plpgsql as $$
declare
  open_count int;
  day_count int;
  v_store boolean;
  v_open_max int;
  v_day_max int;
begin
  if app.trusted() or public.is_admin() then
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

create trigger listings_quota before insert on public.listings
  for each row execute function public.enforce_listing_quota();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Storage key of an upload (public.uploads.key); legacy rows imported from
  -- Supabase keep their key after the import rewrote them.
  path text not null check (char_length(path) <= 300),
  position int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, position);

-- Photos per listing (P1-05).
create or replace function public.enforce_listing_image_limit()
returns trigger language plpgsql as $$
declare
  n int;
begin
  if app.trusted() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.listing_id is not distinct from old.listing_id then
    return new;
  end if;
  -- Serialise concurrent uploads to the same listing.
  perform pg_advisory_xact_lock(hashtextextended('listing_images:' || new.listing_id::text, 0));
  select count(*) into n from public.listing_images where listing_id = new.listing_id;
  if n >= 10 then
    raise exception 'Bir ilana en fazla 10 fotoğraf eklenebilir.' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger listing_images_limit before insert or update of listing_id on public.listing_images
  for each row execute function public.enforce_listing_image_limit();

-- A listing can only show the caller's own uploaded files (0013, now checked
-- against the uploads table instead of a folder prefix).
create or replace function public.guard_listing_image_path()
returns trigger language plpgsql as $$
begin
  if public.rate_limited_caller() then
    if app.uid() is null or not exists (
      select 1 from public.uploads u
      where u.key = new.path and u.owner_id = app.uid() and u.kind = 'listing'
    ) then
      raise exception 'Fotoğraf yolu geçersiz.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger listing_images_path_guard before insert or update of path on public.listing_images
  for each row execute function public.guard_listing_image_path();

-- Photo changes on a published listing by its seller send it back to review (P1-01).
create or replace function public.listing_images_moderation()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  affected uuid[];
begin
  if app.uid() is null or public.is_admin() or app.role() = 'system' then
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

revoke execute on function public.listing_images_moderation() from public;

-- Reordering photos (position) is not a content change and does not re-review.
create trigger listing_images_moderation after insert or delete or update of path, listing_id on public.listing_images
  for each row execute function public.listing_images_moderation();

create or replace function public.increment_listing_view(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update listings set view_count = view_count + 1 where id = p_listing and status = 'active';
end $$;

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on public.favorites (listing_id);
create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

-- Conversations and messages outlive a deleted account or listing (0012):
-- the ids become NULL and the other side keeps the history.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  meeting_confirmed_at timestamptz,
  buyer_confirmed_at timestamptz,
  seller_confirmed_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);
create index conversations_buyer_created_idx on public.conversations (buyer_id, created_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000)
    constraint messages_body_not_blank check (char_length(btrim(body)) >= 1),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_created_idx on public.messages (sender_id, created_at);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_participant(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from conversations
    where id = p_conversation and app.uid() in (buyer_id, seller_id)
  )
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.conversation_other(p_conversation uuid)
returns uuid language sql stable security definer set search_path = public, app as $$
  select case when buyer_id = app.uid() then seller_id else buyer_id end
  from conversations where id = p_conversation
$$;

-- New conversations start unconfirmed, with server timestamps (P0-04).
create or replace function public.guard_conversation_insert()
returns trigger language plpgsql as $$
begin
  if app.trusted() then
    return new;
  end if;
  new.created_at := now();
  new.last_message_at := now();
  new.meeting_confirmed_at := null;
  new.buyer_confirmed_at := null;
  new.seller_confirmed_at := null;
  return new;
end $$;

create trigger conversations_insert_guard before insert on public.conversations
  for each row execute function public.guard_conversation_insert();

-- Identity columns are immutable; each participant may confirm only their own
-- side, once, with the server clock; meeting_confirmed_at follows (P0-03/04).
create or replace function public.guard_conversation_update()
returns trigger language plpgsql as $$
begin
  if not app.trusted() then
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
      if app.uid() is distinct from old.buyer_id then
        raise exception 'Karşı tarafın buluşma onayını değiştiremezsin.' using errcode = '42501';
      end if;
      new.buyer_confirmed_at := coalesce(old.buyer_confirmed_at, case when new.buyer_confirmed_at is not null then now() end);
    end if;
    if new.seller_confirmed_at is distinct from old.seller_confirmed_at then
      if app.uid() is distinct from old.seller_id then
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

create trigger conversations_guard before update on public.conversations
  for each row execute function public.guard_conversation_update();

-- Server timestamp, unread on arrival (P0-04).
create or replace function public.guard_message_insert()
returns trigger language plpgsql as $$
begin
  if app.trusted() then
    return new;
  end if;
  new.created_at := now();
  new.read_at := null;
  return new;
end $$;

create trigger messages_insert_guard before insert on public.messages
  for each row execute function public.guard_message_insert();

-- Sent messages are immutable; the recipient may only set read_at (P0-05).
create or replace function public.guard_message_update()
returns trigger language plpgsql as $$
begin
  if app.trusted() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Gönderilmiş bir mesaj değiştirilemez.' using errcode = '42501';
  end if;
  -- read_at is stamped by the server and never cleared.
  if new.read_at is distinct from old.read_at then
    new.read_at := coalesce(old.read_at, case when new.read_at is not null then now() end);
  end if;
  return new;
end $$;

create trigger messages_guard before update on public.messages
  for each row execute function public.guard_message_update();

-- ---------------------------------------------------------------------------
-- Ratings, reports, moderation
-- ---------------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  score int not null check (score between 1 and 5),
  comment text constraint ratings_comment_length check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (rater_id, conversation_id),
  check (rater_id <> ratee_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

-- The rating's listing is the conversation's, and its date is the server's.
create or replace function public.guard_rating_insert()
returns trigger language plpgsql as $$
begin
  if app.trusted() then
    return new;
  end if;
  new.created_at := now();
  new.listing_id := (select c.listing_id from public.conversations c where c.id = new.conversation_id);
  return new;
end $$;

create trigger ratings_insert_guard before insert on public.ratings
  for each row execute function public.guard_rating_insert();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reason text not null constraint reports_reason_length check (char_length(btrim(reason)) between 1 and 100),
  detail text constraint reports_detail_length check (detail is null or char_length(detail) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_at timestamptz,
  target_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint reports_target_check check (listing_id is not null or reported_user_id is not null or target_snapshot is not null)
);

create index reports_reporter_created_idx on public.reports (reporter_id, created_at);
create index reports_status_created_idx on public.reports (status, created_at desc);
create unique index reports_open_listing_uniq on public.reports (reporter_id, listing_id)
  where status <> 'resolved' and listing_id is not null;
create unique index reports_open_user_uniq on public.reports (reporter_id, reported_user_id)
  where status <> 'resolved' and listing_id is null and reported_user_id is not null;

-- What a report was about, as it was when filed (P1-08).
create or replace function public.report_target_snapshot(p_listing uuid, p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'captured_at', now(),
    'listing', (
      select jsonb_build_object(
        'id', l.id, 'title', l.title, 'description', l.description, 'price', l.price,
        'currency', l.currency, 'city', l.city, 'district', l.district, 'status', l.status,
        'ref_no', l.ref_no, 'seller_id', l.seller_id, 'seller_name', p.display_name,
        'images', coalesce((select jsonb_agg(i.path order by i.position) from listing_images i where i.listing_id = l.id), '[]'::jsonb))
      from listings l join profiles p on p.id = l.seller_id
      where l.id = p_listing),
    'user', (
      select jsonb_build_object('id', p.id, 'display_name', p.display_name)
      from profiles p where p.id = p_user)
  ))
$$;

revoke execute on function public.report_target_snapshot(uuid, uuid) from public;

create or replace function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  v_seller uuid;
  v_status text;
begin
  if new.listing_id is not null then
    select seller_id, status into v_seller, v_status from listings where id = new.listing_id;
  end if;
  -- SECURITY DEFINER (RLS hides the rows it reads), so the caller is taken
  -- from app.role(), not current_user.
  if app.role() in ('anon', 'user') and not public.is_admin() then
    new.status := 'pending';
    new.resolution_note := null;
    new.resolved_at := null;
    if new.reported_user_id = new.reporter_id or v_seller = new.reporter_id then
      raise exception 'Kendini ya da kendi ilanını şikayet edemezsin.' using errcode = '23514';
    end if;
    if new.listing_id is not null and v_status is distinct from 'active' then
      raise exception 'Bu ilan şikayet edilemez.' using errcode = '23514';
    end if;
  end if;
  new.target_snapshot := public.report_target_snapshot(new.listing_id, new.reported_user_id);
  return new;
end $$;

revoke execute on function public.guard_report_insert() from public;

create trigger reports_insert_guard before insert on public.reports
  for each row execute function public.guard_report_insert();

create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  subject_user_id uuid not null,
  subject_name text,
  kind text not null check (kind in ('warn', 'restrict', 'suspend', 'lift')),
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sanctions_subject_idx on public.sanctions (subject_user_id, created_at desc);

create or replace function public.sanction_subject()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    raise exception 'Yaptırım bir kullanıcıya verilmeli.' using errcode = '23502';
  end if;
  new.subject_user_id := new.user_id;
  new.subject_name := (select display_name from profiles where id = new.user_id);
  return new;
end $$;

revoke execute on function public.sanction_subject() from public;

create trigger sanctions_subject before insert on public.sanctions
  for each row execute function public.sanction_subject();

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('phone', 'email')),
  detail text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint verification_requests_detail_format check (
    char_length(detail) <= 254 and (kind <> 'phone' or detail ~ '^\+?[0-9]{10,15}$')
  )
);

create index verification_requests_user_created_idx on public.verification_requests (user_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  recipients int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null
    constraint support_tickets_email_format check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text not null constraint support_tickets_topic_length check (char_length(btrim(topic)) between 1 and 60),
  message text not null constraint support_tickets_message_length check (char_length(btrim(message)) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index support_tickets_user_created_idx on public.support_tickets (user_id, created_at);
create index support_tickets_email_created_idx on public.support_tickets (lower(email), created_at);

-- Actions that leave no row of their own (WhatsApp number lookups).
create table public.rate_limit_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_user_action_idx on public.rate_limit_events (user_id, action, created_at);

-- Admin actions that change someone else's data (new).
create table public.admin_audit_log (
  id bigserial primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Derived data
-- ---------------------------------------------------------------------------

create view public.seller_stats with (security_invoker = true) as
select
  p.id as seller_id,
  coalesce(r.avg_score, 0)::numeric(3, 2) as rating_avg,
  coalesce(r.cnt, 0)::int as rating_count,
  coalesce(l.active_count, 0)::int as active_listings,
  coalesce(l.sold_count, 0)::int as sold_listings
from public.profiles p
left join (
  select ratee_id, avg(score) as avg_score, count(*) as cnt from public.ratings group by ratee_id
) r on r.ratee_id = p.id
left join (
  select seller_id,
    count(*) filter (where status = 'active') as active_count,
    count(*) filter (where status = 'sold') as sold_count
  from public.listings group by seller_id
) l on l.seller_id = p.id;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------

create or replace function public.wants_notification(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select (settings ->> case p_kind
      when 'message' then 'notify_messages'
      when 'price' then 'notify_price'
      when 'listing' then 'notify_listing'
      when 'rating' then 'notify_rating'
      when 'announcement' then 'notify_announcements'
      else 'notify_always' end) is distinct from 'false'
    from profiles where id = p_user
  ), true)
$$;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if wants_notification(p_user, p_kind) then
    insert into notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link);
  end if;
end $$;

-- Only the notification triggers call notify() (0004).
revoke execute on function public.notify(uuid, text, text, text, text) from public;

create or replace function public.on_message_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv conversations%rowtype;
  recipient uuid;
  sender_name text;
begin
  select * into conv from conversations where id = new.conversation_id;
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  recipient := case when conv.buyer_id = new.sender_id then conv.seller_id else conv.buyer_id end;
  if recipient is null then
    return new;
  end if;
  select coalesce(case when account_type = 'store' then store_name end, display_name) into sender_name
    from profiles where id = new.sender_id;
  -- Keep one unread message notification per conversation instead of one per message.
  delete from notifications
    where user_id = recipient and kind = 'message' and read_at is null
      and link = '/mesajlar?c=' || conv.id;
  perform notify(recipient, 'message', coalesce(sender_name, 'Bir kullanıcı') || ' sana mesaj gönderdi',
    '"' || left(new.body, 120) || '"', '/mesajlar?c=' || conv.id);
  return new;
end $$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_created();

create or replace function public.on_listing_status_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'active' and old.status = 'pending' then
      perform notify(new.seller_id, 'listing', 'İlanın yayına alındı',
        new.title || ' artık aramalarda görünüyor.', '/ilan/' || new.slug);
    elsif new.status = 'rejected' then
      perform notify(new.seller_id, 'listing', 'İlanın yayınlanamadı',
        new.title || ': ' || coalesce(new.reject_reason, 'kurallara uygun bulunmadı.'),
        '/ilan-ver/reddedildi?id=' || new.id);
    end if;
  end if;
  if new.status = 'active' and new.price < old.price then
    insert into notifications (user_id, kind, title, body, link)
    select f.user_id, 'price', 'Favorindeki bir ilanın fiyatı düştü',
      new.title || ' artık ' || to_char(new.price, 'FM999G999G990') || ' ' || new.currency,
      '/ilan/' || new.slug
    from favorites f where f.listing_id = new.id and wants_notification(f.user_id, 'price');
  end if;
  return new;
end $$;

create trigger listings_after_update after update on public.listings
  for each row execute function public.on_listing_status_changed();

create or replace function public.on_rating_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare rater_name text;
begin
  select display_name into rater_name from profiles where id = new.rater_id;
  perform notify(new.ratee_id, 'rating', coalesce(rater_name, 'Bir kullanıcı') || ' seni değerlendirdi',
    repeat('★', new.score) || coalesce(' — ' || new.comment, ''), '/satici/' || new.ratee_id || '/yorumlar');
  return new;
end $$;

create trigger ratings_after_insert after insert on public.ratings
  for each row execute function public.on_rating_created();

create or replace function public.on_sanction_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set
    status = case new.kind
      when 'warn' then 'warned' when 'restrict' then 'restricted'
      when 'suspend' then 'suspended' else 'active' end,
    status_until = new.expires_at
  where id = new.user_id;
  perform notify(new.user_id, 'account',
    case new.kind when 'lift' then 'Hesap kısıtlaman kaldırıldı' else 'Hesabınla ilgili bir işlem yapıldı' end,
    new.reason, case when new.kind in ('restrict', 'suspend') then '/hesap-kisitlandi' else '/hesabim' end);
  return new;
end $$;

create trigger sanctions_after_insert after insert on public.sanctions
  for each row execute function public.on_sanction_created();

-- Admin approval of a manual phone review (0007): number first, then the flag.
create or replace function public.on_verification_resolved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' and new.kind = 'phone' then
    update profile_private set phone = new.detail where id = new.user_id;
    update profiles set phone_verified = true where id = new.user_id;
  end if;
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    perform notify(new.user_id, 'account',
      case when new.status = 'approved' then 'İnceleme talebin onaylandı' else 'İnceleme talebin reddedildi' end,
      case new.kind when 'phone' then 'Telefon numarası: ' else 'E-posta: ' end || new.detail,
      '/hesabim/dogrulama');
  end if;
  return new;
end $$;

create trigger verification_after_update after update on public.verification_requests
  for each row execute function public.on_verification_resolved();

-- ---------------------------------------------------------------------------
-- Rate limits (P1-07). Counted against server time; PT429 → HTTP 429.
--   messages 20/min & 300/h per sender · conversations 20/h per buyer
--   reports 10/h · verification requests 3/24h · support tickets 5/h per
--   user, anonymous 3/h per e-mail and 30/h in total · WhatsApp 30/h
-- ---------------------------------------------------------------------------

create or replace function public.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = public, app as $$
declare
  n int;
  limited boolean := app.role() in ('anon', 'user') and not public.is_admin();
begin
  if not limited then
    return new;
  end if;
  new.created_at := now();

  if tg_table_name = 'messages' then
    perform pg_advisory_xact_lock(hashtextextended('rl:messages:' || new.sender_id::text, 0));
    select count(*) into n from messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute';
    if n >= 20 then
      raise exception 'Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene.' using errcode = 'PT429';
    end if;
    select count(*) into n from messages
      where sender_id = new.sender_id and created_at > now() - interval '1 hour';
    if n >= 300 then
      raise exception 'Bir saatte gönderebileceğin mesaj sınırına ulaştın. Daha sonra tekrar dene.' using errcode = 'PT429';
    end if;

  elsif tg_table_name = 'conversations' then
    perform pg_advisory_xact_lock(hashtextextended('rl:conversations:' || new.buyer_id::text, 0));
    select count(*) into n from conversations
      where buyer_id = new.buyer_id and created_at > now() - interval '1 hour';
    if n >= 20 then
      raise exception 'Bir saatte en fazla 20 yeni sohbet başlatabilirsin. Daha sonra tekrar dene.' using errcode = 'PT429';
    end if;

  elsif tg_table_name = 'reports' then
    perform pg_advisory_xact_lock(hashtextextended('rl:reports:' || coalesce(new.reporter_id::text, ''), 0));
    select count(*) into n from reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 hour';
    if n >= 10 then
      raise exception 'Bir saatte en fazla 10 şikayet gönderebilirsin. Daha sonra tekrar dene.' using errcode = 'PT429';
    end if;

  elsif tg_table_name = 'verification_requests' then
    perform pg_advisory_xact_lock(hashtextextended('rl:verification:' || new.user_id::text, 0));
    select count(*) into n from verification_requests
      where user_id = new.user_id and created_at > now() - interval '24 hours';
    if n >= 3 then
      raise exception 'Bir günde en fazla 3 doğrulama talebi gönderebilirsin. Yarın tekrar dene.' using errcode = 'PT429';
    end if;

  elsif tg_table_name = 'support_tickets' then
    -- A signed-in caller always counts as themselves.
    if app.uid() is not null then
      new.user_id := app.uid();
    end if;
    if new.user_id is not null then
      perform pg_advisory_xact_lock(hashtextextended('rl:support:' || new.user_id::text, 0));
      select count(*) into n from support_tickets
        where user_id = new.user_id and created_at > now() - interval '1 hour';
      if n >= 5 then
        raise exception 'Bir saatte en fazla 5 destek talebi gönderebilirsin. Daha sonra tekrar dene.' using errcode = 'PT429';
      end if;
    else
      perform pg_advisory_xact_lock(hashtextextended('rl:support:anon', 0));
      select count(*) into n from support_tickets
        where user_id is null and lower(email) = lower(new.email) and created_at > now() - interval '1 hour';
      if n >= 3 then
        raise exception 'Bu e-posta adresiyle çok fazla talep gönderildi. Daha sonra tekrar dene.' using errcode = 'PT429';
      end if;
      select count(*) into n from support_tickets
        where user_id is null and created_at > now() - interval '1 hour';
      if n >= 30 then
        raise exception 'Şu anda çok fazla talep var. Lütfen daha sonra tekrar dene ya da giriş yapıp gönder.' using errcode = 'PT429';
      end if;
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.enforce_rate_limit() from public;

-- "zz_" so it runs after the other BEFORE INSERT guards (name order).
create trigger zz_rate_limit before insert on public.messages
  for each row execute function public.enforce_rate_limit();
create trigger zz_rate_limit before insert on public.conversations
  for each row execute function public.enforce_rate_limit();
create trigger zz_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limit();
create trigger zz_rate_limit before insert on public.verification_requests
  for each row execute function public.enforce_rate_limit();
create trigger zz_rate_limit before insert on public.support_tickets
  for each row execute function public.enforce_rate_limit();

-- ---------------------------------------------------------------------------
-- Functions the API calls
-- ---------------------------------------------------------------------------

create or replace function public.send_announcement(p_audience text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = public, app as $$
declare n int;
begin
  if not is_admin() then raise exception 'Yetkisiz işlem.' using errcode = '42501'; end if;
  insert into notifications (user_id, kind, title, body, link)
  select p.id, 'announcement', p_title, p_body, null
  from profiles p
  where wants_notification(p.id, 'announcement') and case p_audience
    when 'Aktif satıcılar' then exists (select 1 from listings l where l.seller_id = p.id and l.status = 'active')
    when 'Yeni kullanıcılar' then p.created_at > now() - interval '30 days'
    else true end;
  get diagnostics n = row_count;
  insert into announcements (audience, title, body, recipients, created_by)
  values (p_audience, p_title, p_body, n, app.uid());
  return n;
end $$;

-- The seller's WhatsApp number, to signed-in users only, rate limited (0010).
create or replace function public.get_listing_whatsapp(p_listing uuid)
returns text language plpgsql volatile security definer set search_path = public, app as $$
declare
  v_uid uuid := app.uid();
  v_phone text;
  n int;
begin
  if v_uid is null then
    return null;
  end if;
  if app.role() in ('anon', 'user') and not public.is_admin() then
    perform pg_advisory_xact_lock(hashtextextended('rl:whatsapp:' || v_uid::text, 0));
    select count(*) into n from rate_limit_events
      where user_id = v_uid and action = 'whatsapp' and created_at > now() - interval '1 hour';
    if n >= 30 then
      raise exception 'Kısa sürede çok fazla numara görüntüledin. Daha sonra tekrar dene.' using errcode = 'PT429';
    end if;
    delete from rate_limit_events where user_id = v_uid and created_at < now() - interval '1 day';
    insert into rate_limit_events (user_id, action) values (v_uid, 'whatsapp');
  end if;
  select pp.phone into v_phone
  from listings l join profile_private pp on pp.id = l.seller_id
  where l.id = p_listing and l.status = 'active' and pp.whatsapp_enabled
    and pp.phone is not null
    and not public.is_sanctioned(l.seller_id);
  return v_phone;
end $$;

-- Whether a listing's seller accepts WhatsApp, without revealing the number (0015).
create or replace function public.listing_accepts_whatsapp(p_listing uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select pp.whatsapp_enabled and pp.phone is not null
    from listings l join profile_private pp on pp.id = l.seller_id
    where l.id = p_listing and l.status = 'active'
  ), false)
$$;

-- Account deletion (0011, 0012): refused while sanctioned; support tickets
-- lose the address; everything personal goes with auth.users by cascade.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, app, auth as $$
declare
  v_uid uuid := app.uid();
  v_email text;
begin
  if v_uid is null then raise exception 'Oturum bulunamadı.' using errcode = '42501'; end if;
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

-- An admin deletes another user's account (0014): never their own or another admin's.
create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, app, auth as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.' using errcode = '42501';
  end if;
  if p_user is null or p_user = app.uid() then
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

-- Listing creation in one step, safe to retry (0013/0014). SECURITY INVOKER:
-- the caller's RLS policies and all listing triggers apply. p_photos are
-- upload keys, which must be the caller's own unattached listing uploads.
create or replace function public.create_listing(
  p_key uuid,
  p_category int,
  p_title text,
  p_description text,
  p_price numeric,
  p_currency text,
  p_city text,
  p_district text,
  p_condition text,
  p_negotiable boolean,
  p_photos text[],
  p_attributes jsonb
)
returns uuid language plpgsql security invoker set search_path = public, app as $$
declare
  v_uid uuid := app.uid();
  v_id uuid;
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
  if not exists (select 1 from categories where id = p_category and is_active) then
    raise exception 'Kategori seç.' using errcode = '23514';
  end if;

  insert into listings (seller_id, category_id, title, description, price, currency, city, district,
                        condition, negotiable, status, idempotency_key, attributes)
  values (v_uid, p_category, btrim(p_title), coalesce(p_description, ''), p_price, p_currency, p_city,
          nullif(btrim(coalesce(p_district, '')), ''), p_condition, coalesce(p_negotiable, false), 'pending', p_key,
          coalesce(p_attributes, '{}'::jsonb))
  on conflict (seller_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    -- A concurrent request with the same key won; it stores the photos.
    select id into v_id from listings where seller_id = v_uid and idempotency_key = p_key;
    return v_id;
  end if;

  insert into listing_images (listing_id, path, position, width, height)
  select v_id, photo.path, photo.ord - 1, u.width, u.height
  from unnest(p_photos) with ordinality as photo(path, ord)
  left join uploads u on u.key = photo.path;

  update uploads set attached_at = now()
  where key = any(p_photos) and owner_id = v_uid and attached_at is null;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security (applies to kie_app; kie_owner owns the tables)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.regions enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.uploads enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.ratings enable row level security;
alter table public.reports enable row level security;
alter table public.sanctions enable row level security;
alter table public.verification_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.support_tickets enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.admin_audit_log enable row level security;

-- 'system' callers (trusted server code) see and manage everything.
create policy "system" on public.profiles for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.profile_private for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.categories for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.listings for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.listing_images for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.uploads for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.favorites for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.conversations for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.messages for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.blocks for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.ratings for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.reports for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.sanctions for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.verification_requests for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.notifications for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.announcements for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.support_tickets for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.rate_limit_events for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');
create policy "system" on public.admin_audit_log for all using ((select app.role()) = 'system') with check ((select app.role()) = 'system');

create policy "regions are public" on public.regions for select using (true);

create policy "profiles are public" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update
  using (id = (select app.uid()) or (select public.is_admin())) with check (id = (select app.uid()) or (select public.is_admin()));

create policy "own private read" on public.profile_private for select
  using (id = (select app.uid()) or (select public.is_admin()));
create policy "own private update" on public.profile_private for update
  using (id = (select app.uid()) or (select public.is_admin())) with check (id = (select app.uid()) or (select public.is_admin()));

create policy "categories are public" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "listings visible" on public.listings for select
  using (
    (status = 'active' and not public.is_sanctioned(seller_id))
    or seller_id = (select app.uid())
    or (select public.is_admin())
  );
create policy "create own listing" on public.listings for insert
  with check (seller_id = (select app.uid()) and (select public.can_act()) and status in ('draft', 'pending'));
create policy "update own listing" on public.listings for update
  using ((seller_id = (select app.uid()) and (select public.can_act())) or (select public.is_admin()))
  with check ((seller_id = (select app.uid()) and (select public.can_act())) or (select public.is_admin()));
create policy "delete own listing" on public.listings for delete
  using (seller_id = (select app.uid()) or (select public.is_admin()));

create policy "images follow listing" on public.listing_images for select
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "owner manages images" on public.listing_images for all
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and ((l.seller_id = (select app.uid()) and (select public.can_act())) or (select public.is_admin()))
  ))
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id and ((l.seller_id = (select app.uid()) and (select public.can_act())) or (select public.is_admin()))
  ));

create policy "own uploads" on public.uploads for select using (owner_id = (select app.uid()) or (select public.is_admin()));
create policy "add own upload" on public.uploads for insert with check (owner_id = (select app.uid()) and (select public.can_act()));
create policy "attach own upload" on public.uploads for update
  using (owner_id = (select app.uid()) or (select public.is_admin())) with check (owner_id = (select app.uid()) or (select public.is_admin()));
create policy "delete own upload" on public.uploads for delete using (owner_id = (select app.uid()) or (select public.is_admin()));

create policy "own favorites" on public.favorites for select using (user_id = (select app.uid()));
create policy "add favorite" on public.favorites for insert
  with check (user_id = (select app.uid()) and (select public.can_act()));
create policy "remove favorite" on public.favorites for delete using (user_id = (select app.uid()));

create policy "participants read conversations" on public.conversations for select
  using ((select app.uid()) in (buyer_id, seller_id) or (select public.is_admin()));
create policy "buyer starts conversation" on public.conversations for insert
  with check (
    buyer_id = (select app.uid()) and (select public.can_act())
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = conversations.seller_id and l.status = 'active'
        and not public.is_sanctioned(l.seller_id)
    )
  );
create policy "participants update conversation" on public.conversations for update
  using ((select app.uid()) in (buyer_id, seller_id));

create policy "participants read messages" on public.messages for select
  using (public.is_participant(conversation_id) or (select public.is_admin()));
create policy "participants send messages" on public.messages for insert
  with check (
    sender_id = (select app.uid()) and (select public.can_act()) and public.is_participant(conversation_id)
    and public.conversation_other(conversation_id) is not null
    and not public.is_blocked_between((select app.uid()), public.conversation_other(conversation_id))
  );
create policy "participants mark read" on public.messages for update
  using (public.is_participant(conversation_id) and sender_id is distinct from (select app.uid()));

create policy "own blocks" on public.blocks for select using (blocker_id = (select app.uid()));
create policy "add block" on public.blocks for insert with check (blocker_id = (select app.uid()));
create policy "remove block" on public.blocks for delete using (blocker_id = (select app.uid()));

create policy "ratings are public" on public.ratings for select using (true);
create policy "rate conversation partner" on public.ratings for insert
  with check (
    rater_id = (select app.uid())
    and (select public.can_act())
    and public.is_participant(conversation_id)
    and ratee_id = public.conversation_other(conversation_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.buyer_confirmed_at is not null
        and c.seller_confirmed_at is not null
    )
  );
create policy "admins delete ratings" on public.ratings for delete using ((select public.is_admin()));

create policy "file report" on public.reports for insert
  with check (reporter_id = (select app.uid()) and (select public.can_act()));
create policy "read own or admin reports" on public.reports for select
  using (reporter_id = (select app.uid()) or (select public.is_admin()));
create policy "admins update reports" on public.reports for update using ((select public.is_admin()));

create policy "admins sanction" on public.sanctions for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "see own sanctions" on public.sanctions for select using (user_id = (select app.uid()));

create policy "request verification" on public.verification_requests for insert
  with check (user_id = (select app.uid()) and status = 'pending' and (select public.can_act()));
create policy "read own or admin verifications" on public.verification_requests for select
  using (user_id = (select app.uid()) or (select public.is_admin()));
create policy "admins resolve verifications" on public.verification_requests for update
  using ((select public.is_admin()));

create policy "own notifications" on public.notifications for select using (user_id = (select app.uid()));
create policy "update own notifications" on public.notifications for update using (user_id = (select app.uid()));
create policy "delete own notifications" on public.notifications for delete using (user_id = (select app.uid()));

create policy "announcements are public" on public.announcements for select using (true);

create policy "anyone opens a ticket" on public.support_tickets for insert
  with check (user_id is null or user_id = (select app.uid()));
create policy "admins read tickets" on public.support_tickets for select using ((select public.is_admin()));
create policy "admins update tickets" on public.support_tickets for update using ((select public.is_admin()));

create policy "admins read audit log" on public.admin_audit_log for select using ((select public.is_admin()));
create policy "admins write audit log" on public.admin_audit_log for insert
  with check ((select public.is_admin()) and admin_id = (select app.uid()));

-- ---------------------------------------------------------------------------
-- Top-level categories (ids and slugs match production, 0001)
-- ---------------------------------------------------------------------------

insert into public.categories (id, slug, name, name_en, icon, sort_order) values
  (1, 'mobilya', 'Mobilya', 'Furniture', 'sofa', 1),
  (2, 'elektronik', 'Elektronik', 'Electronics', 'phone', 2),
  (3, 'giyim', 'Giyim', 'Fashion', 'shirt', 3),
  (4, 'arac', 'Araç', 'Vehicles', 'car', 4),
  (5, 'ev-aletleri', 'Ev aletleri', 'Home appliances', 'appliance', 5),
  (6, 'bebek', 'Bebek', 'Baby & kids', 'baby', 6),
  (7, 'spor', 'Spor', 'Sports', 'bike', 7),
  (8, 'kitap', 'Kitap', 'Books', 'book', 8),
  (9, 'hobi', 'Hobi', 'Hobbies', 'camera', 9);

-- Categories added by admins in production keep ids above 9 when imported;
-- new subcategories start at 1000 so the two ranges never collide.
select setval('public.categories_id_seq', 1000, false);
