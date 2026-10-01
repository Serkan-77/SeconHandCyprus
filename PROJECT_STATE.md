# PROJECT_STATE — Kıbrıs İkinci Elcim v2 (branch `marketplace-v2`)

Read this first when resuming. Keep it current after every atomic unit of work.

## Overall goal

Replace Supabase (Postgres/RLS, Auth, Storage, Realtime) with an
application-owned stack on the VDS (Docker: Caddy on host → Next.js web +
Fastify API + PostgreSQL), while upgrading the marketplace (category tree,
dynamic attributes, search/filters, listing flow, detail page, chat, admin,
design system). Production (Vercel + Supabase) stays live until an explicit
cutover confirmation.

## Architecture decisions (details in ARCHITECTURE.md)

| # | Decision | Why |
|---|----------|-----|
| 1 | Fastify modular monolith in `api/` | Low RAM on a 6 GB VDS; mobile + web share one API |
| 2 | `postgres.js`, hand-written parameterized SQL, no ORM | Security model lives in triggers/RLS/constraints; ORM would hide it |
| 3 | RLS + guard triggers ported 1:1; API sets `app.user_id` / `app.role` per transaction | DB stays a second line of defense behind API checks |
| 4 | Roles: `kie_owner` (migrations), `kie_app` (runtime, RLS applies, no DDL) | Least privilege |
| 5 | Auth: Argon2id; JWT access (15 min) + rotating opaque refresh (hash stored), reuse ⇒ session revoked; 20 s grace for concurrent tabs | Web (HttpOnly cookies) and mobile (Bearer) |
| 6 | Supabase bcrypt hashes imported and verified once, then rehashed | Users keep passwords after migration |
| 7 | CSRF: `X-KIE-CSRF: 1` required on cookie-authenticated unsafe requests + Origin allow-list | No CORS is ever granted |
| 8 | Realtime: WebSocket, push-only, per-user fan-out from `LISTEN app_events` (DB computes recipients) | Clients cannot subscribe to others' rooms |
| 9 | Images: sharp decode → WebP sm/md/lg, EXIF stripped, originals not kept; local disk behind `ObjectStore` | Disk-bounded, safe, S3-ready |
| 10 | Categories: tree; attribute definitions relational (inheritable, overridable, hideable); values JSONB (GIN) | Scales without nullable-column sprawl |
| 11 | Regions stay the 8 existing Cyprus regions, now a reference table | Evidence: current model |
| 12 | No Redis/queues/search engine: pg_trgm + folded search column | Evidence-based, fits the box |

## Checklist

- [x] Phase A — audit (code, 15 migrations, security scripts, pages)
- [x] Phase B — target architecture
- [x] Phase C — api/ skeleton, shared/ package, dev Postgres (docker-compose.dev.yml)
- [x] Phase D — db/migrations 0001–0005 (baseline, auth, realtime, taxonomy, grants); apply cleanly
- [x] Phase E — auth API (19 tests passing)
- [x] Phase F–I — API security suites: 82 tests pass (auth, listings, messaging, admin, uploads, realtime)
- [x] Phase J–Q — web app rebuilt on the API (home, search/filters, listing page, sell wizard, edit, chat, account, seller/store, auth, admin + taxonomy manager)
- [x] Phase R — design system (tokens, UI kit); responsive QA in a real browser NOT yet done
- [ ] Phase S/T — a11y/perf/SEO/security hardening (CSP for new origins)
- [ ] Phase U — test expansion, E2E (Playwright) on the new stack
- [ ] Phase V — Dockerfiles, compose, Caddy snippet
- [ ] Phase W — backups/restore/observability
- [ ] Phase X — Supabase → Postgres migration tooling + rehearsal
- [ ] Phase Y — readiness report + cutover checkpoint

## Current task

Local end-to-end run of the new stack (API + Next dev + seeded DB) and browser QA.

## Next exact action

1. `docker compose -f docker-compose.dev.yml up -d` (Docker Desktop must be running).
2. Recreate dev DB `kibrisikincielcim` (0001 changed since first dev apply): drop/create as
   postgres, `create extension pg_trgm, citext`, `alter schema public owner to kie_owner`
   (same steps as api/test/helpers.ts resetDatabase), then `npm --prefix api run migrate`
   and `npm --prefix api run seed` (api/.env already has dev settings + SEED_*; NOT committed).
3. Run `npm run dev:api` and `npm run dev`; QA pages at 360/768/1280/1440 px, fix issues.
4. Then: Dockerfiles + compose + Caddy (Phase V), backups (W), Supabase export/import
   tooling (X), docs (README/ARCHITECTURE/SECURITY/DEPLOYMENT/BACKUP_RESTORE/MIGRATION), cutover checkpoint (Y).

Note: the old Supabase .env.local was saved as `.env.local.supabase-backup` (gitignored);
`.env.local` now points the web app at the local API.

## Important commands

```bash
docker compose -f docker-compose.dev.yml up -d        # dev Postgres on 127.0.0.1:55432
cd api && npm test                                     # API tests (fresh kie_test DB each file)
cd api && npx tsc --noEmit -p .                        # API typecheck
DATABASE_OWNER_URL=postgres://kie_owner:dev-owner-password@127.0.0.1:55432/kibrisikincielcim npm --prefix api run migrate
```

## Migrations completed (new stack, dev only)

0001_baseline, 0002_auth, 0003_realtime, 0004_taxonomy_attributes, 0005_grants.
Not applied anywhere but local dev/test.

## Tests

| Suite | Result |
|-------|--------|
| api (auth, listings, messaging, admin, uploads, realtime) | 82/82 pass |
| web unit tests (npm test) | 61/61 pass |
| web typecheck, lint, `next build` | pass |

## Known issues / notes

- Not yet verified in a real browser; no E2E (Playwright) suite for the new stack yet.
- `scripts/production-smoke.mjs` still targets Supabase; must be rewritten.
- Phone OTP login (off in production) is not carried over; documented.
- Google OAuth: planned in API behind GOOGLE_CLIENT_ID/SECRET (not yet built).

## Production blockers (external)

- SMTP credentials for transactional mail (verification/reset).
- SSH access details for the VDS (host 91.151.89.238 is in known_hosts; user unknown).
- Supabase production DB connection string / service key for the data export.
- DNS cutover (explicit confirmation required).
