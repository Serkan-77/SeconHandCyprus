-- Application-owned authentication (replaces Supabase Auth).
--
-- auth.users is created in 0001 (profiles reference it). This file adds:
--   auth.identities   external sign-in (Google) linked to a user
--   auth.sessions     one row per signed-in device; revocable
--   auth.refresh_tokens  rotating refresh tokens (only SHA-256 hashes stored)
--   auth.one_time_tokens e-mail verification and password reset (hashes only)
--   auth.attempts     sign-in / sign-up / reset attempts for rate limiting
--
-- None of these tables is readable through RLS-protected paths; only the API's
-- auth module touches them. No token is ever stored in clear text.

create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google')),
  provider_user_id text not null,
  email citext,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create index identities_user_idx on auth.identities (user_id);

create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 'web' sessions live in HttpOnly cookies, 'mobile' ones in the app's
  -- secure storage; both rotate refresh tokens the same way.
  client text not null default 'web' check (client in ('web', 'mobile')),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text
);

create index sessions_user_idx on auth.sessions (user_id, created_at desc);
create index sessions_expired_idx on auth.sessions (expires_at);

create table auth.refresh_tokens (
  id bigserial primary key,
  session_id uuid not null references auth.sessions (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  -- Set when the token is exchanged. Presenting a used token again means it
  -- was stolen (or replayed): the whole session is revoked.
  used_at timestamptz
);

create index refresh_tokens_session_idx on auth.refresh_tokens (session_id);

create table auth.one_time_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('email_verify', 'password_reset')),
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index one_time_tokens_user_idx on auth.one_time_tokens (user_id, kind, created_at desc);

-- Keyed by a SHA-256 of "action:ip" or "action:email" so neither addresses nor
-- e-mails are stored in clear text here.
create table auth.attempts (
  id bigserial primary key,
  key_hash bytea not null,
  action text not null,
  created_at timestamptz not null default now()
);

create index attempts_key_idx on auth.attempts (key_hash, created_at);
create index attempts_created_idx on auth.attempts (created_at);
