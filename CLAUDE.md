@AGENTS.md

# CLAUDE.md — Kıbrıs İkinci Elcim (project memory)

Second-hand marketplace for Cyprus. **This is a live production system with
real user data.** Read this file before changing anything; keep it current
when the architecture, deployment or an operational rule changes (not for
trivial UI work).

| | |
|---|---|
| Production (canonical) | https://www.kibrisikincielcim.com |
| Apex | https://kibrisikincielcim.com → permanent redirect to www (Caddy) |
| Direct VDS hostname | https://new.kibrisikincielcim.com (same app, allowed via `EXTRA_ORIGINS`) |
| Repo / branch | https://github.com/Serkan-77/SeconHandCyprus.git, `marketplace-v2` (repo root = this directory) |
| Server | Ubuntu 24.04, `ssh serkan@91.151.89.238`, app at `/srv/kibrisikincielcim/app` |
| **Never touch** | `/srv/gezeceyik-kibris` — an unrelated application on the same box (its dirs, containers, network, Caddy blocks) |

Detailed operations: [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md).
Background docs (Turkish): `docs/ARCHITECTURE.md`, `docs/SECURITY.md`,
`docs/DEPLOYMENT.md`, `docs/BACKUP_RESTORE.md`, `docs/MIGRATION.md`, `docs/i18n.md`.
`PROJECT_STATE.md` predates the go-live (it still says "nothing deployed") —
where it disagrees with this file, this file wins.

---

## 1. Architecture

```
Browser ──HTTPS──► Caddy (host, only public listener 80/443)
                     ├─ /api/*   (incl. WebSocket /api/v1/ws) ─► 127.0.0.1:4100 ─► api  (Fastify 5, container :4000)
                     ├─ /media/* ─► files on disk /srv/kibrisikincielcim/uploads (served by Caddy itself)
                     ├─ /health* ─► 404 (health is host-only)
                     └─ else     ─► 127.0.0.1:3100 ─► web (Next.js 16, container :3000)
web ──SSR fetch http://api:4000 (docker network kibrisikincielcim-network)──► api
api ──postgres.js (docker network "db", internal:true, no published port)──► db (PostgreSQL 17)
```

**Same origin for everything** — no CORS anywhere. Session cookies are first-party.

| Piece | What runs there | Code |
|---|---|---|
| `web` container | Next.js 16 App Router, standalone output (`node server.js`). Renders pages server-side by calling the API; client components call `/api/v1` directly through Caddy. No DB access, no secrets except `INTERNAL_API_TOKEN`. | `src/`, `shared/`, `deploy/web.Dockerfile` |
| `api` container | Fastify 5 modular monolith: auth, listings, uploads + image processing (sharp), messaging, admin, realtime hub (WebSocket), e-mail (nodemailer SMTP), housekeeping jobs (`api/src/jobs.ts`). Also serves `/media` as a fallback (`SERVE_MEDIA=1`). | `api/src/`, `shared/`, `deploy/api.Dockerfile` |
| `migrate` (one-shot) | Same image as api; `node dist/migrate.js` applies `db/migrations/*.sql` as `kie_owner`. Migrations are **baked into the image at build time** (`api/build.mjs` copies them to `dist/migrations`). | `api/src/db/migrate.ts` |
| `db` container | PostgreSQL 17. Owns **all business rules as a second line of defence**: RLS policies, guard triggers, quotas, rate limits (`rate_limit_events`), notifications, realtime `pg_notify`. Data in `/srv/kibrisikincielcim/data/postgres`. | `db/migrations/`, `db/init/00-roles.sh` |
| Host | Caddy (`/etc/caddy/Caddyfile` imports `/srv/kibrisikincielcim/app/deploy/Caddyfile`), systemd timers for backup / restore drill / healthcheck. | `deploy/Caddyfile`, `deploy/ops/` |

### Database roles and per-request identity
- `kie_owner` — owns the schema, runs migrations, RLS does not apply.
- `kie_app` — the API at runtime: DML only, RLS applies, no DDL, no BYPASSRLS.
- Every request's queries run in **one transaction** that first does
  `set_config('app.user_id', …)` / `set_config('app.role', 'anon'|'user'|'system')`
  (`withActor` in `api/src/db/pool.ts`; `run(app, req, fn)` in `api/src/modules/common.ts`).
  Policies/triggers read these through `app.uid()`, `app.role()`, `app.trusted()`.
  `SYSTEM` is used only by trusted server code (jobs, signup insert, import) — never derived from input.
- SQL is always `postgres.js` tagged templates (parameterised). No ORM. Columns are camelCased on read.
- DB errors are translated in `api/src/lib/errors.ts` (`fromDbError`): Turkish messages raised by our
  triggers (errcodes `PT429`, `PT403`, `42501`, `23514`…) reach the user; anything else is generic.
- API error shape everywhere: `{ "error": { "code", "message", "fields"? } }`.

### Authentication / sessions / cookies
- Email + password (Argon2id via `@node-rs/argon2`; imported Supabase bcrypt hashes are verified once and
  rehashed on login) — `api/src/auth/passwords.ts`. Optional Google OAuth (PKCE, signed state) — `api/src/modules/google.ts`.
- Access token: HS256 JWT, 15 min (`JWT_SECRET`), claims `sub` (user) + `sid` (session). **Every request
  re-checks the session row** (`resolveViewer` in `api/src/http/context.ts`), so logout is immediate.
- Refresh token: opaque 256-bit random, only SHA-256 stored (`auth.refresh_tokens`), rotated on every use;
  reuse after a 20 s grace revokes the whole session (`api/src/auth/sessions.ts`). Sessions slide 30 days, max 180.
- Web: cookies `kie_at` / `kie_rt` — `HttpOnly`, `Secure` (when SITE_URL is https), `SameSite=Lax`, `path=/`,
  optional `COOKIE_DOMAIN`. Mobile (future): `{"client":"mobile"}` → tokens in body, `Authorization: Bearer`.
- Refresh happens in two places: `src/proxy.ts` (before rendering, if `kie_at` is missing/expiring and
  `kie_rt` exists — it forwards the rotated `Set-Cookie`s) and `src/lib/api/client.ts` (browser retries once
  on `401 token_expired`, concurrent calls share one refresh).
- `src/proxy.ts` also redirects signed-out users away from `/hesabim`, `/mesajlar`, `/ilan-ver`, `/kurulum`,
  `/yonetim` (admin → `/yonetim/giris`). **This is UX only — authorization is always the API + RLS.**
- Admin = `profiles.role = 'admin'`; checked with `requireAdmin` in the API and `is_admin()` in SQL;
  every admin action writes `admin_audit_log` (`audit()` in `common.ts`).
- Account status (`active|warned|restricted|suspended` + `status_until`) — `isSanctioned()` in `context.ts`
  mirrors `public.is_sanctioned`; sanctioned users can't upload/post (enforced in API and DB).
- Brute force: `auth.attempts` (hashed keys, per IP and per email) — `api/src/auth/attempts.ts`.
  Plus a global 600 req / 5 min per-IP limiter (`@fastify/rate-limit`, `api/src/app.ts`).

### CSRF
`checkCsrf` (`api/src/http/context.ts`): every non-GET request with cookies must carry `X-KIE-CSRF: 1`
and, if an `Origin` header is present, it must be in `allowedOrigins` = `SITE_URL` origin + `EXTRA_ORIGINS`
+ (apex automatically when SITE_URL is `www.`). Bearer requests are exempt. Both API clients
(`src/lib/api/client.ts`, `src/lib/api/server.ts`) always send the header. **Any new fetch to the API must
send `x-kie-csrf: 1`** — use the existing clients, don't hand-roll fetch.

### Client IP trust
Caddy is 1 trusted hop (`TRUST_PROXY_HOPS=1`). When Next's server calls the API it forwards the browser IP
in `x-kie-client-ip` with `x-kie-internal: <INTERNAL_API_TOKEN>`; the API trusts it only if the token
matches (`resolveClientIp`). Rate limits depend on this — the token must be identical in web and api env.

### Uploads and /media
Flow: browser shrinks the photo (`src/components/sell/PhotoManager.tsx`, max edge 2560) →
`POST /api/v1/uploads?kind=listing|avatar` (multipart, 1 file, ≤12 MB; Caddy caps body at 14 MB) →
`api/src/modules/uploads.ts`: requires viewer, not sanctioned, per-user limits (80/h, 300/day) →
`processImage` (`api/src/storage/images.ts`): decoded by sharp/libvips (JPEG/PNG/WebP/AVIF only, ≤40 MP,
no animation, min edge), re-encoded to WebP variants `sm/md/lg` (avatar `sm/md` square), EXIF/GPS stripped,
**original not kept** → `LocalStore.putVariants` (`api/src/storage/store.ts`) writes
`UPLOAD_DIR/<key>/{sm,md,lg}.webp` where key = `l|a/YYYY/MM/<uuid>` (server-generated, regex-checked,
path-traversal-proof) → row in `public.uploads` (owner, kind, key, size) → response `{key, urls}`.
The key is attached later: `listing_images.path = key` (via `create_listing` or `POST /listings/:id/images`)
or `profiles.avatar_url = key`; DB triggers ensure you can only attach your own uploads.
Serving: Caddy `handle_path /media/*` serves from `/srv/kibrisikincielcim/uploads` only if the path matches
`^/[la]/YYYY/MM/<uuid>/(sm|md|lg).webp$`, with immutable cache, `nosniff`, `CSP: default-src 'none'; sandbox`.
Cleanup: `purgeUploads` deletes files + rows no longer referenced (listing delete, discard);
job `orphan-uploads` (30 min) removes never-attached uploads older than 24 h.
Upload dir on host must be owned by uid 1000 (container `node` user) and world-readable (Caddy).

### Realtime (WebSocket)
- DB triggers in `db/migrations/0003_realtime.sql` call `pg_notify('app_events', {t, ids, users[]})` on
  message insert, messages read, conversation update (meeting confirmations), notification insert.
  The **recipient list is computed by the DB** from the conversation row. Notify is transactional.
- `api/src/realtime/hub.ts`: one `LISTEN` connection; for each event, for each connected recipient, it
  re-reads the row **as that user** (RLS applies) and pushes `{type:"message"|"read"|"conversation"|"notification"}`.
  Max 6 sockets/user, 30 s ping, sessions re-checked every 5 min, closed on logout/password change.
- `GET /api/v1/ws` (`api/src/modules/realtime.ts`): cookie auth only if `Origin` ∈ allowedOrigins
  (prevents cross-site WebSocket hijacking), or first frame `{"type":"auth","token"}` (mobile). 4 KB max frame;
  clients only listen (and ping).
- Web: `src/components/realtime/Realtime.tsx` (`RealtimeProvider` in `src/app/layout.tsx`, `useRealtime`),
  URL = `NEXT_PUBLIC_WS_URL` or same-origin `wss://<host>/api/v1/ws`; reconnect with backoff and re-sync of
  unread counts (`src/lib/liveCounts.ts`). Consumers: `components/messages/ChatThread.tsx`,
  `ConversationList.tsx`, `components/account/Notifications.tsx`.
- **Single API instance assumption**: the hub and the jobs are in-process. Scaling api to >1 replica needs
  no change for realtime (each instance LISTENs) but jobs would run twice (they are idempotent).

### E-mail
Only auth e-mails exist (no message/notification e-mails): verify, already-registered, password reset,
password changed — `api/src/email/templates.ts` (Turkish, HTML + text). Transport `api/src/email/mailer.ts`:
`smtp` (production, enforced by `config.ts`), `log` (dev — prints links), `memory` (tests).
Production SMTP is Resend (values only in the server `.env`). Links are built from `SITE_URL`
(`/eposta-dogrula?token=…`, `/yeni-sifre?token=…`, `/giris`, `/sifre-yenile`, `/destek`). One-time tokens:
`auth.one_time_tokens`, hashed, verify 24 h / reset 60 min, a new request invalidates older ones.
Sending is fire-and-forget (failures logged, never change the response — prevents enumeration/timing).

### Environment variables
Production values live only in `/srv/kibrisikincielcim/.env` (chmod 600; template `deploy/.env.example`).
Compose maps them; **a variable that is not listed in `deploy/docker-compose.yml` never reaches a container.**

| Consumed by | Variables | When |
|---|---|---|
| api (`api/src/config.ts`, zod-validated, process exits listing bad names) | `DATABASE_URL` (built by compose as `kie_app`), `SITE_URL`, `EXTRA_ORIGINS`, `JWT_SECRET`, `INTERNAL_API_TOKEN`, `TRUST_PROXY_HOPS`, `COOKIE_DOMAIN`, `UPLOAD_DIR`, `MEDIA_URL`, `SERVE_MEDIA`, `MAIL_TRANSPORT`, `SMTP_*`, `MAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET`, `LOG_LEVEL`, `DATABASE_POOL_MAX` | **runtime** — change `.env` → `$DC up -d api` (no rebuild) |
| migrate | `DATABASE_OWNER_URL` (built by compose as `kie_owner`) | runtime |
| db | `POSTGRES_SUPERUSER_PASSWORD`, `KIE_OWNER_PASSWORD`, `KIE_APP_PASSWORD` | role passwords are only applied on **first init** of the data dir; changing them later requires `ALTER ROLE` |
| web build args (`deploy/web.Dockerfile`) | `NEXT_PUBLIC_SITE_URL` (= `SITE_URL`), `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_ADSENSE_*`, `NEXT_PUBLIC_AUTH_GOOGLE` | **build time** — compiled into the bundle; change → `$DC build web && $DC up -d web` |
| web runtime | `API_INTERNAL_URL=http://api:4000`, `INTERNAL_API_TOKEN`, `NEXT_PUBLIC_SITE_URL` | runtime |
| host ops (`/srv/kibrisikincielcim/ops.env`, systemd `EnvironmentFile`) | `SITE_URL` (healthcheck public probe), `ALERT_CMD`, `OFFSITE_CMD`, `KEEP_DAILY`… | read on each timer run |

`NEXT_PUBLIC_WS_URL` is not set in production (same-origin socket). `src/lib/envCheck.ts` fails the build
if a `NEXT_PUBLIC_*` looks like a secret or SITE_URL is invalid. Never put secrets in `NEXT_PUBLIC_*`.

---

## 2. Request flows (verified from code)

**Login (web)**: `src/components/auth/AuthForms.tsx` → `api.post("/auth/login")` (browser, same origin, CSRF
header) → Caddy → `api/src/modules/auth.ts` `/login`: `loginSchema` (shared) → `enforceLimits` (IP 30/15 min,
email 8/15 min) → `auth.users` lookup → Argon2/bcrypt verify (constant-time burn if unknown) → refuse if email
not verified (`403 email_not_verified`) → `createSession` (`auth.sessions` + `auth.refresh_tokens`) →
`Set-Cookie kie_at, kie_rt` → client navigates; next page render: `src/proxy.ts` sees cookie, server components
call `getMe()` (`src/lib/api/server.ts` → `GET /api/v1/me`).

**Signup / verify**: `/auth/signup` (limit 5/h/IP) inserts `auth.users` + `profiles` + `profile_private` as SYSTEM,
issues `email_verify` token, mails link to `/eposta-dogrula?token=` → page posts `/auth/verify-email` → sets
`email_verified_at` and **signs the user in**. Existing email → same response, "already registered" mail.

**Password reset**: `/sifre-yenile` → `/auth/password-reset` (always `{ok:true}`) → mail `/yeni-sifre?token=` →
`/auth/password-reset/confirm`: new hash, **revokes all sessions + closes sockets**, "password changed" mail, new session.

**Create listing**: `/ilan-ver` → `SellWizardClient` (client-only, draft in localStorage via
`src/lib/listingDraft.ts`) → photos uploaded immediately (`PhotoManager` → `/uploads`, keys kept in draft;
removed photos → `/uploads/discard`) → category (`CategoryPicker`) → dynamic attribute fields (`AttributeFields`,
defs from `/taxonomy`, rules in `shared/attributes.ts`) → submit `POST /api/v1/listings` with
`listingCreateSchema` incl. `submissionKey` (idempotency) → `api/src/modules/listings.ts`: leaf + active category,
`validateAttributes` against the category's effective attributes, all photo keys owned by caller →
`public.create_listing(...)` SQL function (quota trigger, `listing_defaults` builds slug/search_text, inserts
`listing_images`, status **pending** for moderation) → `{listing:{id,slug,status}}` → wizard removes the localStorage
draft, shows the "submitted" state and calls `router.refresh()`. Field errors come back as
`error.fields` (`attributes.<key>` mapped to the attribute inputs). Admin approves in `/yonetim/ilanlar` → `POST /admin/listings/:id/approve`
→ status `active` → `on_listing_status_changed` trigger → notification → realtime push.
Editing title/price/photos of an **active** listing puts it back to `pending` (guard + `listing_images_moderation`
triggers); reordering photos does not.

**Search**: `/ilanlar`, `/kategori/[slug]` (server) → `src/lib/search.ts` maps Turkish URL params
(`q, sehir, durum, min, max, sirala, a.<key>…`) to API params → `searchPublic` (`src/lib/api/listings.ts`,
anonymous, Next cache 30 s) → `GET /api/v1/listings` → `parseSearch` (fold Turkish chars, ≤6 words) →
`search_text` + pg_trgm, attribute filters on `attributes` JSONB (`parseAttributeFilters`), facets.
Visibility is RLS ("listing visible": active + seller not sanctioned, or own, or admin).

**Messaging**: listing page `ContactActions` → `POST /api/v1/conversations {listingId}` (one per buyer+listing;
not own listing; listing active) → `/mesajlar?c=<id>` → `ChatThread` loads `GET /conversations/:id/messages`
(keyset paging) → send `POST /conversations/:id/messages` (`messageSchema`; refuses if other user deleted or
blocked; DB `guard_message_insert` + `zz_rate_limit`) → triggers: `on_message_created` (updates
`last_message_at`, one unread `message` notification per conversation) + `zz_realtime_message` (`pg_notify`) →
hub pushes `message` to both participants' sockets → receiver UI appends; `POST /conversations/:id/read`
marks read + clears notification → `read` event. Meeting confirmation `POST /conversations/:id/meeting`
(both sides) → `conversation` event; rating `POST /conversations/:id/rating` only after mutual meeting confirm.

**Image serving**: `<MediaImage>` (`src/components/ui/MediaImage.tsx`) uses URLs from the API
(`imageUrls()` → `/media/<key>/<variant>.webp`) → Caddy serves the file directly.

---

## 3. Codebase Map

| System | Web (Next.js) | API | DB / shared |
|---|---|---|---|
| App shell, providers | `src/app/layout.tsx`, `src/components/Header.tsx`, `Footer.tsx`, `FavoritesProvider.tsx` | — | — |
| Request gate (CSP nonce, session refresh, auth redirects) | `src/proxy.ts`, `src/lib/csp.ts`, `src/lib/safeRedirect.ts` | — | — |
| API clients | `src/lib/api/client.ts` (browser), `server.ts` (SSR, `getMe/getTaxonomy/getUnread/getFavoriteIds`), `listings.ts`, `errors.ts`, **`types.ts` (response shapes)** | `api/src/app.ts` (plugin/route registration, error handler) | — |
| Authentication | `src/app/giris`, `kayit`, `eposta-dogrula`, `sifre-yenile`, `yeni-sifre`, `yonetim/giris`, `auth/callback` (legacy Supabase link redirect); `src/components/auth/*` | `api/src/modules/auth.ts`, `google.ts`; `api/src/auth/{sessions,tokens,passwords,attempts}.ts`; `api/src/http/context.ts` | `db/migrations/0002_auth.sql` (`auth.users/identities/sessions/refresh_tokens/one_time_tokens/attempts`); `shared/schemas.ts` (signup/login/password) |
| Listings (CRUD, detail, moderation status) | `src/app/ilan/[slug]`, `src/app/hesabim/ilanlar`, `src/components/listing/*`, `ListingCard.tsx`, `ListingStatusBadge.tsx`, `account/MyListings.tsx`, `account/EditListing.tsx` | `api/src/modules/listings.ts`, card mapping `common.ts` (`CARD_COLUMNS`, `toCard`) | `listings`, `listing_images` (0001: `create_listing`, `listing_defaults`, `guard_listing_update`, `enforce_listing_quota`, image triggers); `listing_favorite_count` (0006); `shared/schemas.ts` `listingCreateSchema/listingUpdateSchema`; `shared/constants.ts` `LIMITS` |
| Sell flow | `src/app/ilan-ver`, `src/components/sell/{SellWizard,SellWizardClient,PhotoManager,CategoryPicker,AttributeFields}.tsx`, `src/lib/listingDraft.ts` | `POST /listings`, `/uploads` | as above |
| Categories & attributes | `src/app/kategori`, `src/lib/taxonomy.ts`, admin `components/admin/TaxonomyManager.tsx` | `api/src/modules/taxonomy.ts` (60 s in-memory cache, `invalidateTaxonomy()`), admin `/admin/categories`, `/admin/attributes` | `categories`, `category_attributes` (0004), `shared/attributes.ts` (inheritance, validation, filters, spec table) |
| Search / filtering | `src/app/ilanlar`, `src/components/search/{Filters,Results}.tsx`, `src/lib/search.ts`, `src/lib/regions.ts` | `listings.ts` `parseSearch`, `GET /listings`, `GET /sitemap` | `listings.search_text` + pg_trgm, `attributes` JSONB GIN; `regions` |
| Favorites | `FavoritesProvider.tsx`, `src/app/hesabim/favoriler` | `api/src/modules/me.ts` `/me/favorites*` | `favorites` |
| Messaging & meetings | `src/app/mesajlar` (+`[id]`, layout), `src/components/messages/{ChatThread,ConversationList}.tsx`, `src/lib/chat.ts`, `src/lib/meeting.ts` | `api/src/modules/conversations.ts` | `conversations`, `messages`, `blocks` + guard triggers (0001), realtime triggers (0003) |
| Ratings | `src/app/satici/[id]/yorumlar`, `ui/Stars.tsx` | `conversations.ts` `/rating`, `users.ts` `/users/:id/ratings`, admin `DELETE /admin/ratings/:id` | `ratings`, `guard_rating_insert` |
| Notifications | `src/app/hesabim/bildirimler`, `components/account/Notifications.tsx`, `src/lib/liveCounts.ts` | `me.ts` `/me/notifications*`, `/me/counts` | `notifications`; created **only by DB triggers** via `public.notify()` (messages, listing status, ratings, sanctions, verifications, `send_announcement`) |
| Realtime | `src/components/realtime/Realtime.tsx` | `api/src/modules/realtime.ts`, `api/src/realtime/hub.ts` | `db/migrations/0003_realtime.sql` |
| Profile / account / store | `src/app/hesabim/*` (`duzenle`, `ayarlar`, `magaza`, `dogrulama`), `src/app/kurulum`, `src/components/account/*` | `api/src/modules/me.ts` (`/me`, profile, store, settings, contact, verification requests, blocks, sanctions, `/me/delete`) | `profiles`, `profile_private`, `verification_requests`, `delete_my_account()` |
| Public users / stores / reports / support | `src/app/satici/[id]`, `src/app/magazalar`, `src/app/destek`, `listing/ReportDialog.tsx` | `api/src/modules/users.ts` (`/users/:id`, `/stores`, block, report, `/stats`, `/support`) | `reports` (+snapshot), `blocks`, `support_tickets` |
| Admin | `src/app/yonetim/**`, `src/components/admin/*` | `api/src/modules/admin.ts` (prefix `/admin`) | `sanctions`, `announcements`, `admin_audit_log`, `admin_delete_user()` |
| Uploads / images | `components/sell/PhotoManager.tsx`, `ui/MediaImage.tsx`, `ui/Avatar.tsx` | `api/src/modules/uploads.ts`, `api/src/storage/{images,store}.ts` | `uploads`, `listing_images.path`, `profiles.avatar_url` |
| E-mail | — | `api/src/email/{mailer,templates}.ts` | `auth.one_time_tokens` |
| Health / jobs | — | `api/src/modules/health.ts` (`/health`, `/health/ready`), `api/src/jobs.ts` | — |
| Config | `src/lib/site.ts`, `src/lib/envCheck.ts`, `next.config.ts` (security headers, dev rewrites `/api` `/media` → API) | `api/src/config.ts` | — |
| SEO | `src/app/sitemap.ts`, `robots.ts`, `manifest.ts`, `opengraph-image.tsx`, `kategori/[slug]/opengraph-image.tsx`, `src/lib/jsonLd.ts`, `components/JsonLd.tsx`, `src/lib/ogImage.tsx`, `ads.txt/route.ts` | `GET /api/v1/sitemap` | — |
| i18n (TR default, EN) | `src/lib/i18n/*` (`en.json` maps Turkish source → English), `components/i18n/*`, `LanguageToggle.tsx` | API messages are Turkish only | — |
| Ads (off until CMP) | `src/lib/ads.ts`, `components/AdSlot.tsx` | — | — |
| DB access / migrations | — | `api/src/db/pool.ts` (`createDb`, `withActor`, `ANON/SYSTEM`), `api/src/db/migrate.ts` | `db/migrations/0001_baseline … 0006_owner_listing_stats`, `db/init/00-roles.sh` |
| Seed / import | — | `api/scripts/seed.ts` (dev only, `SEED_ALLOW`), `api/scripts/supabase-import.ts`, `supabase-verify.ts` (one-off, done) | `migration/rehearsal/*` |
| Deploy / ops | — | — | `deploy/docker-compose.yml`, `deploy/{api,web}.Dockerfile`, `deploy/Caddyfile`, `deploy/ops/{backup,restore,restore-test,healthcheck,reset-db}.sh`, `deploy/ops/systemd/*` |
| Tests | `tests/*.test.mjs` (node --test: validation, csp, chat, meeting, i18n, json-ld, safe-redirect, env-check…) | `api/test/{auth,google,listings,messaging,admin,uploads,realtime}.test.ts`, `api/test/helpers.ts` (builds `kie_test` DB from migrations) | — |
| Scripts | `scripts/production-smoke.mjs` (read-only, prod-safe), `e2e.mjs` (writes data — **local only**), `responsive-check.mjs`, `i18n-check.mjs`, `i18n-inventory.mjs` | — | — |
| Legacy (reference only) | `supabase/migrations/` (old schema), `src/app/auth/callback` | — | do not build on these |

URLs are Turkish (`/ilanlar`, `/ilan/[slug]`, `/ilan-ver`, `/mesajlar`, `/hesabim`, `/yonetim`, `/satici/[id]`,
`/magazalar`, `/kategori/[slug]`). API is English under `/api/v1`.

---

## 4. Feature Dependency Map

**LISTINGS** — Frontend: `src/app/ilan/[slug]`, `src/app/ilanlar`, `src/app/kategori/[slug]`, `src/app/hesabim/ilanlar`,
`src/components/{ListingCard,ListingStatusBadge}.tsx`, `src/components/listing/*`, `src/components/sell/*`,
`src/components/account/{MyListings,EditListing}.tsx`, `src/lib/api/types.ts`.
API: `api/src/modules/listings.ts`, `common.ts` (card shape), `admin.ts` (moderation, featured, edit/delete).
DB: `listings`, `listing_images`, `uploads`, functions `create_listing`, `listing_defaults`, `guard_listing_update`,
`enforce_listing_quota`, `enforce_listing_image_limit`, `listing_images_moderation`, `increment_listing_view`,
`get_listing_whatsapp`, `listing_favorite_count`, `on_listing_status_changed`. Shared: `shared/schemas.ts`,
`shared/constants.ts`, `shared/attributes.ts`. Uploads: `uploads.ts`, `storage/*`. Tests: `api/test/listings.test.ts`,
`uploads.test.ts`, `tests/attributes.test.mjs`, `tests/validation.test.mjs`, `tests/wizard-draft.test.mjs`.
Related: categories/attributes, favorites, messaging (conversation references listing), reports, sitemap/JSON-LD.

**MESSAGING** — Frontend: `src/app/mesajlar/**`, `src/components/messages/*`, `src/lib/chat.ts`, `src/lib/meeting.ts`,
`listing/ContactActions.tsx`, `realtime/Realtime.tsx`. API: `api/src/modules/conversations.ts`, `realtime.ts`,
`realtime/hub.ts`. DB: `conversations`, `messages`, `blocks`, `ratings`, `notifications`; guards
`guard_conversation_insert/update`, `guard_message_insert/update`, `zz_rate_limit`, `on_message_created`;
realtime triggers in 0003. Authorization: RLS participant policies + `loadConversation` (non-participant → 404),
blocks, sanctions, deleted-user (`recipient_gone`). Tests: `api/test/messaging.test.ts`, `realtime.test.ts`,
`tests/chat.test.mjs`, `tests/meeting.test.mjs`.

**AUTH** — Frontend: `src/components/auth/*`, auth pages (see map), `src/proxy.ts`, `src/lib/api/{client,server}.ts`,
`src/lib/safeRedirect.ts`, account settings sessions/password (`components/account/Settings.tsx`).
API: `api/src/modules/auth.ts`, `google.ts`, `api/src/auth/*`, `api/src/http/context.ts`, `api/src/config.ts`.
DB: `auth.*` (0002), `profiles` (role/status), `app.uid()/app.role()`. Email: `api/src/email/*`.
Security: CSRF, origins (`SITE_URL`/`EXTRA_ORIGINS`), cookie flags, rate limits, enumeration-safe responses,
session revocation + socket close. Tests: `api/test/auth.test.ts`, `google.test.ts`, `tests/auth-origin.test.mjs`,
`tests/safe-redirect.test.mjs`.

**CATEGORIES / ATTRIBUTES** — Frontend: `src/app/kategori/**`, `components/sell/{CategoryPicker,AttributeFields}.tsx`,
`components/search/Filters.tsx`, `components/admin/TaxonomyManager.tsx`, `src/lib/taxonomy.ts`.
API: `taxonomy.ts` (+cache invalidation from `admin.ts`). DB: 0004. Shared: `shared/attributes.ts` (used by both sides —
change once, both follow). Related: every listing (stored `attributes` keys must stay valid for old rows).

**UPLOADS** — see §1. Related: listings, avatars (`me.ts` profile), account deletion (files removed), backups (uploads snapshot).

**ADMIN** — Frontend `src/app/yonetim/**`, `src/components/admin/*`; API `admin.ts`; DB sanctions/reports/
verification_requests/announcements/support_tickets/admin_audit_log. Every new admin action: `requireAdmin` + `audit()`.

---

## 5. How to Change This System

Treat every feature as an **end-to-end change**. Before editing, walk the layers and decide which are touched:

```
UI (src/components, src/app)
 → Next.js server/client boundary (server components use src/lib/api/server.ts; "use client" uses client.ts)
 → API contract (route in api/src/modules/*, response shape mirrored in src/lib/api/types.ts)
 → validation (shared/schemas.ts + shared/constants.ts + DB CHECK/trigger — all three agree)
 → database (new migration; RLS policy; grants; triggers)
 → realtime events (0003 triggers + hub.ts payloadFor + Realtime.tsx event union)
 → email / notifications (templates.ts; public.notify triggers)
 → storage (uploads.ts, storage/*, Caddy /media regex)
 → tests (api/test, tests/)
 → deployment (which images rebuild, migration order, env/compose changes)
```

Never patch only the visible UI when the behaviour also needs API/DB changes.

### Change type matrix

| Change | Examples | Touch / inspect | Must | Usually not needed |
|---|---|---|---|---|
| **UI-only** | colors, spacing, layout, copy, responsive | `src/components`, `src/app`, `globals.css`; new strings → `src/lib/i18n/en.json` (`npm run test:i18n` / `scripts/i18n-check.mjs`) | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; deploy = rebuild **web** only | migration, api rebuild |
| **Frontend behaviour** | form behaviour, filters, account UI, listing UI | components, server/client boundary, `src/lib/api/*`, `src/lib/search.ts`, `shared/schemas.ts`, `src/lib/api/types.ts` | if the API contract changes → change API too (same commit series) | — |
| **API / backend** | new endpoint, auth rule, listing/messaging logic | route in `api/src/modules/*`, register in `app.ts` if new module, `parse(schema)`, `requireViewer/requireAdmin/isSanctioned`, `run()` (RLS) vs `withActor(SYSTEM)` (justify!), rate limits (`consumeLimits` or DB `zz_rate_limit`), CSRF (automatic for non-GET), error codes, logging (no PII/bodies) | `npm run test:api` + new tests; `cd api && npx tsc --noEmit -p .`; deploy = rebuild **api** (and migrate image) | web rebuild unless UI changed |
| **DB / schema** | column, table, constraint, index, policy | new file `db/migrations/0007_<name>.sql` (next free number); RLS `enable` + policies for new tables; grants (default privileges cover new **public** tables/sequences for `kie_app`; **functions need explicit `grant execute … to kie_app`**, `auth`-schema objects need explicit grants); queries; `shared/*`; `types.ts`; backup/restore-test still fine | follow the Database rule below | — |
| **Auth** (security-sensitive) | login, sessions, Google, roles, verification | cookies & flags, JWT/session checks, CSRF/origins, password hashing, one-time tokens, enumeration-safe responses, redirects (`safeRedirect`), account status, admin role, `proxy.ts` refresh | run `auth.test.ts` + `google.test.ts`; never weaken a check to make a feature work | — |
| **Upload / image** | new image kind, sizes, formats | MIME by decode (never trust name/type), size/pixel limits, sharp pipeline, key format **and** `KEY_PATTERN` **and** the Caddy `@variant` regex (all three must agree), DB references, deletion/purge, orphan job, backup | `uploads.test.ts`; never accept a client-supplied path | — |
| **Messaging / realtime** | new message type, unread logic | DB transaction, guards, `pg_notify` payload (ids only, < 8 KB), `hub.ts` `DbEvent` + `payloadFor`, `Realtime.tsx` `RealtimeEvent`, unread counts (`/me/counts`, `liveCounts.ts`), notifications | update REST **and** realtime together; `messaging.test.ts`, `realtime.test.ts` | — |
| **Email** | new mail, link change | `templates.ts` (escape values, Turkish + text version), token issuance/expiry, URL built from `config.siteOrigin`, fire-and-forget `sendMail` | never log/print SMTP credentials or tokens | — |
| **SEO / public URLs** | routes, metadata | canonical (`absoluteUrl`, `SITE.url`), `sitemap.ts` + `/api/v1/sitemap`, `robots.ts`, JSON-LD (`jsonLd.ts` escaping), OG images; keep old URLs working (redirects, e.g. `ilan-ver/[...old]`) | canonical is **https://www.kibrisikincielcim.com** | — |
| **Env / config** | new variable | API: `config.ts` schema **and** `deploy/docker-compose.yml` api `environment` **and** `deploy/.env.example` (+ `api/.env.example`). Web public: Dockerfile `ARG` + compose `build.args` + `.env.example` | tell the user to add it to the server `.env` before deploy | — |

### Feature development workflow
1. **Understand** — read the current implementation; trace frontend → API → DB → related services. No coding from assumptions. This Next.js version differs from training data: check `node_modules/next/dist/docs/` before using Next APIs.
2. **Impact analysis** — briefly state: files/modules affected, migration needed?, API contract change?, frontend?, realtime?, email?, security/auth?
3. **Implement** — reuse existing patterns: `parse()` + shared zod schemas, `run()`/`withActor`, `requireViewer`, `ApiError` helpers, `consumeLimits`, `api`/`apiServer` clients, `src/components/ui/*`, `I18n.*` elements, `audit()` for admin. No duplicate architecture, no new state libraries, no ORM.
4. **Tests** — add/adjust: happy path, invalid input, unauthenticated, wrong user/permissions, regression. `npm test`, `npm run test:api` (needs `docker compose -f docker-compose.dev.yml up -d`; builds its own `kie_test` DB).
5. **Build** — `npm run lint && npm run typecheck && npm run build`; API: `cd api && npx tsc --noEmit -p . && npm run build`.
6. **Review `git diff`** — secrets, debug code, destructive SQL, unrelated edits, **Supabase reintroduced**, weakened RLS/grants/CSRF, env vars missing from compose.
7. **Commit** — logical commits (`type(scope): …`, e.g. `feat(api):`, `fix(web):`, `redesign(web):`, `chore:`), unrelated changes separate.
8. **Deploy only when the user explicitly says so** ("deploy", "canlıya al", "sunucuya geçir", "yayınla"). Finishing code is not permission.

### Database rule
Production PostgreSQL holds real data. Every schema change is a **new forward-only migration**:
- The migrator checksums applied files — **never edit an applied migration** (deploy will refuse); add a new one.
- Each file runs in one transaction. Preserve data: add columns nullable or with a default, backfill in the
  same migration if needed, then constrain; consider existing rows (and old listings' `attributes`).
- Avoid destructive operations (`DROP`, type narrowing, `DELETE`) unless explicitly agreed; prefer expand → migrate → contract across deploys.
- `CREATE INDEX CONCURRENTLY` cannot run inside the migrator's transaction — plain `CREATE INDEX` is fine at this data size.
- New table → `enable row level security` + policies (mirror existing ones), triggers if fields must be guarded.
  New function → `revoke execute … from public` + `grant execute … to kie_app` if the API calls it.
- Test against the dev DB (`npm --prefix api run migrate`) and `npm run test:api` (fresh DB from all migrations).
- Order in production: backup → build → `migrate` → app. Old app code must survive the new schema for the
  seconds between migrate and `up -d` (additive changes do).
- **Never** use `deploy/ops/reset-db.sh` (drops the database — it was for the one-time import), never hand-`ALTER`
  production as a workflow, never "fix" schema by recreating data.

### API contract rule
Frontend and API share shapes: request validation in `shared/schemas.ts` (used by both), responses typed in
`src/lib/api/types.ts` (manually mirrored — update it with the API). When a response changes, grep all
consumers (`src/`, `api/test/`, `scripts/production-smoke.mjs`, `scripts/e2e.mjs`). Web and API deploy as
separate containers: keep changes backward compatible across a rollout when practical (add fields before
removing; tolerate missing fields). The API is also meant for a future mobile app — don't break `/api/v1` shapes casually.

### Legacy Supabase / Vercel
No longer primary. The Supabase project and Vercel deployment are kept **only for rollback — do not delete them**.
**Never reintroduce** a Supabase SDK, Supabase DB/storage/auth calls, or Vercel-specific code. All data belongs to
the self-hosted PostgreSQL and `/srv/kibrisikincielcim/uploads`. `supabase/migrations/` is historical reference.

---

## 6. Production

Stack (compose project `kibrisikincielcim`, file `deploy/docker-compose.yml`, env `/srv/kibrisikincielcim/.env`):

| Service | Image | Ports | Networks | Limits |
|---|---|---|---|---|
| db | postgres:17-bookworm | **none** (must never be published) | `db` (internal) | 1 GB |
| migrate | kibrisikincielcim-api:latest | — | `db` | one-shot |
| api | kibrisikincielcim-api:latest | 127.0.0.1:4100→4000 | `db`, `app` | 512 MB |
| web | kibrisikincielcim-web:latest | 127.0.0.1:3100→3000 | `app` (external `kibrisikincielcim-network`) | 768 MB |

Host paths: `/srv/kibrisikincielcim/{app,data,uploads,backups}`, `.env`, `ops.env`. Only Caddy listens on 80/443;
UFW allows 22/80/443 only. Container names: `kibrisikincielcim-{db,api,web}-1` (ops scripts rely on them).

Caddy: `/etc/caddy/Caddyfile` imports the snippet `deploy/Caddyfile` (`kie_site`). Routing: `www` → app,
`new.` → app, apex → redirect to www. Don't touch Caddy for feature work; when you must: `caddy fmt`,
`caddy validate --config /etc/caddy/Caddyfile`, reload only if valid. Never edit gezeceyik blocks.

### Deployment (only on explicit request) — summary
Full procedure, rollback and troubleshooting: [docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md).
```bash
ssh serkan@91.151.89.238
cd /srv/kibrisikincielcim/app
git status; git branch --show-current; git log -1 --oneline; git diff     # production-only edits may exist — never reset --hard / clean -fd
sudo systemctl start kie-backup.service && sudo journalctl -u kie-backup -n 30 --no-pager   # confirm "done:"
git pull --ff-only origin marketplace-v2   # after handling any local diffs (runbook §3)
DC="docker compose -f deploy/docker-compose.yml --env-file /srv/kibrisikincielcim/.env"
$DC build
$DC run --rm migrate        # must print "applied …" or "database is up to date" — otherwise STOP
$DC up -d
$DC ps                       # db, api, web healthy
curl -I https://www.kibrisikincielcim.com   # HTTP/2 200
curl -I https://kibrisikincielcim.com       # redirect to www
docker run --rm --network host -e SMOKE_BASE_URL=https://www.kibrisikincielcim.com \
  -e NEXT_PUBLIC_SITE_URL=https://www.kibrisikincielcim.com \
  -v /srv/kibrisikincielcim/app:/app:ro -w /app node:24-bookworm-slim node scripts/production-smoke.mjs   # baseline 36/36
```
Not done until the smoke test passes. **On any failure: STOP**, don't run later steps; inspect `$DC ps`,
`$DC logs --tail 200 api web migrate`, `/var/log/caddy/kibrisikincielcim.log`, and work out whether it failed
before/during migration, at container creation, at healthcheck, or in smoke. Preserve data first.
Partial deploys (web-only / api-only) are allowed when you understand the dependency — see runbook §4.

### Secrets
Never copy values from `/srv/kibrisikincielcim/.env` or `ops.env` into the repo, docs, commits, terminal output
or chat. Don't `cat` them; use `grep -c '^NAME=' .env` or `grep '^SITE_URL=' .env` for non-secret keys only.

---

## 7. Open follow-ups (tell the user before doing any of these; don't fold them into unrelated work)
1. **EXTRA_ORIGINS in Git** — committed in this repo (`deploy/docker-compose.yml` api env). The server copy was
   hand-edited; on the next deploy reconcile it (runbook §3) so the pull doesn't conflict or drop it.
2. **`deploy/Caddyfile` in Git still has the production blocks commented out and a `yeni.` staging block**, while
   production serves www/apex/new. Read the live `/etc/caddy/Caddyfile` and the server's `git diff deploy/Caddyfile`,
   then commit the real configuration so a pull/reset can't break routing.
3. **`/srv/kibrisikincielcim/ops.env`** — healthcheck `SITE_URL` must be `https://www.kibrisikincielcim.com`.
4. **Off-site backup** — `OFFSITE_CMD` not confirmed; backups currently live on the same disk as the data.
5. `PROJECT_STATE.md` is pre-launch; refresh it when convenient.
