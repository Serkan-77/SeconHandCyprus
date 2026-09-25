-- Server-side rate limits for marketplace actions (P1-07).
--
-- Counted in the database against server time, so a direct API call is held
-- to the same limits as the app. Exceeding a limit raises SQLSTATE PT429,
-- which PostgREST returns as HTTP 429.
--
--   messages               20 per minute and 300 per hour per sender
--   conversations          20 new per hour per buyer
--   reports                10 per hour per reporter
--   verification_requests  3 per 24 hours per user
--   support_tickets        5 per hour per signed-in user; anonymous: 3 per hour
--                          per e-mail address and 30 per hour in total
--   WhatsApp number        30 lookups per hour per user (get_listing_whatsapp)
--
-- Only API requests made with the anon or authenticated role are limited:
-- admins, the service role (seed, scripts) and SQL run without a JWT are
-- exempt. The trigger is SECURITY DEFINER because RLS hides the rows it counts
-- (support tickets), so the caller is identified from the JWT, not
-- current_user. Signing up and signing in are limited by Supabase Auth
-- (dashboard setting).
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Who is limited
-- ---------------------------------------------------------------------------

create or replace function public.rate_limited_caller()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated') and not public.is_admin()
$$;

-- ---------------------------------------------------------------------------
-- Inserts
-- ---------------------------------------------------------------------------

create or replace function public.enforce_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not public.rate_limited_caller() then
    return new;
  end if;
  -- Server time only: a client-sent created_at would slip past the counts.
  -- (messages, conversations and listings already get this from their guards.)
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
    -- A signed-in caller always counts as themselves, not against the shared
    -- anonymous limit.
    if auth.uid() is not null then
      new.user_id := auth.uid();
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

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

-- Named "zz_" so it runs after the other BEFORE INSERT guards (name order) and
-- counts with the sender/buyer they settled on.
drop trigger if exists zz_rate_limit on public.messages;
create trigger zz_rate_limit before insert on public.messages
  for each row execute function public.enforce_rate_limit();
drop trigger if exists zz_rate_limit on public.conversations;
create trigger zz_rate_limit before insert on public.conversations
  for each row execute function public.enforce_rate_limit();
drop trigger if exists zz_rate_limit on public.reports;
create trigger zz_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limit();
drop trigger if exists zz_rate_limit on public.verification_requests;
create trigger zz_rate_limit before insert on public.verification_requests
  for each row execute function public.enforce_rate_limit();
drop trigger if exists zz_rate_limit on public.support_tickets;
create trigger zz_rate_limit before insert on public.support_tickets
  for each row execute function public.enforce_rate_limit();

create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at);
create index if not exists conversations_buyer_created_idx on public.conversations (buyer_id, created_at);
create index if not exists reports_reporter_created_idx on public.reports (reporter_id, created_at);
create index if not exists verification_requests_user_created_idx on public.verification_requests (user_id, created_at);
create index if not exists support_tickets_user_created_idx on public.support_tickets (user_id, created_at);
create index if not exists support_tickets_email_created_idx on public.support_tickets (lower(email), created_at);

-- ---------------------------------------------------------------------------
-- WhatsApp number lookups
-- ---------------------------------------------------------------------------

-- Actions that leave no row of their own. Only the functions below write here;
-- clients have no access.
create table if not exists public.rate_limit_events (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_user_action_idx on public.rate_limit_events (user_id, action, created_at);
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;
revoke all on sequence public.rate_limit_events_id_seq from anon, authenticated;

-- Replaces the 0008 version: same answer, now counted per user so the numbers
-- of all sellers cannot be harvested in one go. Every lookup counts, including
-- ones that return no number.
create or replace function public.get_listing_whatsapp(p_listing uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_phone text;
  n int;
begin
  if v_uid is null then
    return null;
  end if;
  if public.rate_limited_caller() then
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
