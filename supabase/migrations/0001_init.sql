-- Kıbrıs İkinci El — initial schema
-- Tables, row level security, triggers, storage buckets and realtime.
-- Safe to run once on a fresh Supabase project (SQL editor or `supabase db push`).

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.slugify(value text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    lower(translate(value, 'çğıöşüÇĞİÖŞÜâîûÂÎÛéÉ', 'cgiosucgiosuaiuaiuee')),
    '[^a-z0-9]+', '-', 'g'))
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  region text,
  bio text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'warned', 'restricted', 'suspended')),
  status_until timestamptz,
  phone_verified boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contact details are kept apart from the public profile so they are never
-- readable by other users; only the owner and admins can see them.
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  email text,
  phone text,
  whatsapp_enabled boolean not null default false
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- True when the current user may create listings, send messages, favorite, etc.
create or replace function public.can_act()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (status in ('active', 'warned') or (status_until is not null and status_until < now()))
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, region)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Kullanıcı'),
    nullif(new.raw_user_meta_data ->> 'region', '')
  );
  insert into profile_private (id, email, phone)
  values (new.id, new.email, coalesce(new.phone, nullif(new.raw_user_meta_data ->> 'phone', '')));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own profile but not their role, status or badges.
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() and coalesce(current_setting('app.bypass', true), '') <> 'on'
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    new.role := old.role;
    new.status := old.status;
    new.status_until := old.status_until;
    new.phone_verified := old.phone_verified;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id serial primary key,
  slug text not null unique,
  name text not null,
  icon text not null default 'grid',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create sequence public.listing_ref_seq start 10480;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  ref_no bigint not null unique default nextval('public.listing_ref_seq'),
  slug text unique,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id int not null references public.categories (id),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  currency text not null default 'TL' check (currency in ('TL', '€')),
  city text not null,
  district text,
  condition text not null check (condition in ('Sıfır', 'Az kullanılmış', 'Yıpranmış')),
  negotiable boolean not null default false,
  status text not null default 'pending'
    check (status in ('draft', 'pending', 'active', 'rejected', 'sold', 'removed')),
  reject_reason text,
  featured boolean not null default false,
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listings_status_created_idx on public.listings (status, created_at desc);
create index listings_seller_idx on public.listings (seller_id);
create index listings_category_idx on public.listings (category_id);
create index listings_title_trgm_idx on public.listings using gin (title gin_trgm_ops);

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create or replace function public.listing_defaults()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
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

create trigger listings_defaults before insert or update on public.listings
  for each row execute function public.listing_defaults();

-- Sellers can edit their listings, mark them sold/removed or resubmit them for
-- review, but only moderators can publish or reject.
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
  if new.status is distinct from old.status then
    if new.status not in ('draft', 'pending', 'sold', 'removed') then
      raise exception 'Bu durum değişikliğine yetkin yok.';
    end if;
    if new.status = 'pending' then
      new.reject_reason := null;
    end if;
  end if;
  return new;
end $$;

create trigger listings_guard before update on public.listings
  for each row execute function public.guard_listing_update();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, position);

create or replace function public.increment_listing_view(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass', 'on', true);
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

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  meeting_confirmed_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create or replace function public.is_participant(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversations
    where id = p_conversation and auth.uid() in (buyer_id, seller_id)
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
returns uuid language sql stable security definer set search_path = public as $$
  select case when buyer_id = auth.uid() then seller_id else buyer_id end
  from conversations where id = p_conversation
$$;

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
  comment text,
  created_at timestamptz not null default now(),
  unique (rater_id, conversation_id),
  check (rater_id <> ratee_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  listing_id uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reason text not null,
  detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved')),
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (listing_id is not null or reported_user_id is not null)
);

create table public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('warn', 'restrict', 'suspend', 'lift')),
  reason text not null,
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('phone', 'email')),
  detail text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

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

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  audience text not null,
  title text not null,
  body text not null,
  recipients int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.packages (
  id serial primary key,
  name text not null,
  price numeric(10, 2) not null,
  currency text not null default 'TL',
  duration_days int,
  active boolean not null default false,
  sort_order int not null default 0
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  topic text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

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

-- Maps a notification kind to the profile setting that can mute it.
create or replace function public.wants_notification(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select (settings ->> case p_kind
      when 'message' then 'notify_messages'
      when 'price' then 'notify_price'
      when 'listing' then 'notify_listing'
      when 'rating' then 'notify_rating'
      when 'announcement' then 'notify_announcements'
      else 'notify_always' end) <> 'false'
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
  select display_name into sender_name from profiles where id = new.sender_id;
  -- Keep one unread message notification per conversation instead of one per message.
  delete from notifications
    where user_id = recipient and kind = 'message' and read_at is null
      and link = '/mesajlar?c=' || conv.id;
  perform notify(recipient, 'message', sender_name || ' sana mesaj gönderdi',
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
  perform notify(new.ratee_id, 'rating', rater_name || ' seni değerlendirdi',
    repeat('★', new.score) || coalesce(' — ' || new.comment, ''), '/satici/' || new.ratee_id || '/yorumlar');
  return new;
end $$;

create trigger ratings_after_insert after insert on public.ratings
  for each row execute function public.on_rating_created();

create or replace function public.on_sanction_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.bypass', 'on', true);
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

create or replace function public.on_verification_resolved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status <> 'approved' and new.kind = 'phone' then
    perform set_config('app.bypass', 'on', true);
    update profiles set phone_verified = true where id = new.user_id;
    update profile_private set phone = new.detail where id = new.user_id;
  end if;
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    perform notify(new.user_id, 'account',
      case when new.status = 'approved' then 'Doğrulaman onaylandı' else 'Doğrulaman reddedildi' end,
      case new.kind when 'phone' then 'Telefon numarası: ' else 'E-posta: ' end || new.detail,
      '/hesabim/dogrulama');
  end if;
  return new;
end $$;

create trigger verification_after_update after update on public.verification_requests
  for each row execute function public.on_verification_resolved();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.send_announcement(p_audience text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Yetkisiz işlem.'; end if;
  insert into notifications (user_id, kind, title, body, link)
  select p.id, 'announcement', p_title, p_body, null
  from profiles p
  where wants_notification(p.id, 'announcement') and case p_audience
    when 'Aktif satıcılar' then exists (select 1 from listings l where l.seller_id = p.id and l.status = 'active')
    when 'Yeni kullanıcılar' then p.created_at > now() - interval '30 days'
    else true end;
  get diagnostics n = row_count;
  insert into announcements (audience, title, body, recipients, created_by)
  values (p_audience, p_title, p_body, n, auth.uid());
  return n;
end $$;

-- Returns the seller's WhatsApp number only to signed-in users, and only when
-- the seller opted in.
create or replace function public.get_listing_whatsapp(p_listing uuid)
returns text language sql stable security definer set search_path = public as $$
  select pp.phone
  from listings l join profile_private pp on pp.id = l.seller_id
  where l.id = p_listing and l.status = 'active' and pp.whatsapp_enabled
    and pp.phone is not null and auth.uid() is not null
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
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
alter table public.packages enable row level security;
alter table public.support_tickets enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy "own private read" on public.profile_private for select
  using (id = auth.uid() or public.is_admin());
create policy "own private update" on public.profile_private for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "categories are public" on public.categories for select using (true);
create policy "admins manage categories" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy "listings visible" on public.listings for select
  using (status = 'active' or seller_id = auth.uid() or public.is_admin());
create policy "create own listing" on public.listings for insert
  with check (seller_id = auth.uid() and public.can_act() and status in ('draft', 'pending'));
create policy "update own listing" on public.listings for update
  using (seller_id = auth.uid() or public.is_admin())
  with check (seller_id = auth.uid() or public.is_admin());
create policy "delete own listing" on public.listings for delete
  using (seller_id = auth.uid() or public.is_admin());

create policy "images follow listing" on public.listing_images for select
  using (exists (select 1 from public.listings l where l.id = listing_id));
create policy "owner manages images" on public.listing_images for all
  using (exists (select 1 from public.listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.listings l where l.id = listing_id and (l.seller_id = auth.uid() or public.is_admin())));

create policy "own favorites" on public.favorites for select using (user_id = auth.uid());
create policy "add favorite" on public.favorites for insert
  with check (user_id = auth.uid() and public.can_act());
create policy "remove favorite" on public.favorites for delete using (user_id = auth.uid());

create policy "participants read conversations" on public.conversations for select
  using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
create policy "buyer starts conversation" on public.conversations for insert
  with check (
    buyer_id = auth.uid() and public.can_act()
    and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = conversations.seller_id and l.status = 'active')
  );
create policy "participants update conversation" on public.conversations for update
  using (auth.uid() in (buyer_id, seller_id));

create policy "participants read messages" on public.messages for select
  using (public.is_participant(conversation_id) or public.is_admin());
create policy "participants send messages" on public.messages for insert
  with check (
    sender_id = auth.uid() and public.can_act() and public.is_participant(conversation_id)
    and not public.is_blocked_between(auth.uid(), public.conversation_other(conversation_id))
  );
create policy "participants mark read" on public.messages for update
  using (public.is_participant(conversation_id) and sender_id <> auth.uid());

create policy "own blocks" on public.blocks for select using (blocker_id = auth.uid());
create policy "add block" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "remove block" on public.blocks for delete using (blocker_id = auth.uid());

create policy "ratings are public" on public.ratings for select using (true);
create policy "rate conversation partner" on public.ratings for insert
  with check (
    rater_id = auth.uid()
    and public.is_participant(conversation_id)
    and ratee_id = public.conversation_other(conversation_id)
  );

create policy "file report" on public.reports for insert
  with check (reporter_id = auth.uid());
create policy "read own or admin reports" on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy "admins update reports" on public.reports for update using (public.is_admin());

create policy "admins sanction" on public.sanctions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "see own sanctions" on public.sanctions for select using (user_id = auth.uid());

create policy "request verification" on public.verification_requests for insert
  with check (user_id = auth.uid() and status = 'pending');
create policy "read own or admin verifications" on public.verification_requests for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admins resolve verifications" on public.verification_requests for update
  using (public.is_admin());

create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update using (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete using (user_id = auth.uid());

create policy "announcements are public" on public.announcements for select using (true);

create policy "packages are public" on public.packages for select using (true);
create policy "admins manage packages" on public.packages for all
  using (public.is_admin()) with check (public.is_admin());

create policy "anyone opens a ticket" on public.support_tickets for insert
  with check (user_id is null or user_id = auth.uid());
create policy "admins read tickets" on public.support_tickets for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public read images" on storage.objects for select
  using (bucket_id in ('listing-images', 'avatars'));
create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own files" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

insert into public.categories (slug, name, icon, sort_order) values
  ('mobilya', 'Mobilya', 'sofa', 1),
  ('elektronik', 'Elektronik', 'phone', 2),
  ('giyim', 'Giyim', 'shirt', 3),
  ('arac', 'Araç', 'car', 4),
  ('ev-aletleri', 'Ev aletleri', 'appliance', 5),
  ('bebek', 'Bebek', 'baby', 6),
  ('spor', 'Spor', 'bike', 7),
  ('kitap', 'Kitap', 'book', 8),
  ('hobi', 'Hobi', 'camera', 9);

insert into public.packages (name, price, duration_days, active, sort_order) values
  ('3 gün öne çıkarma', 75, 3, true, 1),
  ('7 gün öne çıkarma', 150, 7, true, 2),
  ('30 gün öne çıkarma', 450, 30, true, 3),
  ('Plus üyelik (aylık)', 199, 30, false, 4);
