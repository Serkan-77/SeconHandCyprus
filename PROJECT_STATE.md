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
- [ ] Phase F — authorization test suites (listings, messaging, admin, uploads, DB-level, realtime)
- [ ] Phase G — remaining API polish found by tests
- [ ] Phase H — image pipeline tests (EXIF strip, MIME spoofing, traversal)
- [ ] Phase I — realtime tests
- [ ] Phase J–Q — web app: replace Supabase client with API client; new pages/flows
- [ ] Phase R — design system + responsive
- [ ] Phase S/T — a11y/perf/SEO/security hardening (CSP for new origins)
- [ ] Phase U — test expansion, E2E (Playwright) on the new stack
- [ ] Phase V — Dockerfiles, compose, Caddy snippet
- [ ] Phase W — backups/restore/observability
- [ ] Phase X — Supabase → Postgres migration tooling + rehearsal
- [ ] Phase Y — readiness report + cutover checkpoint

## Current task

Phase F: authorization/security test suites for the API.

## Next exact action

Write `api/test/listings.test.ts`, `messaging.test.ts`, `admin.test.ts`,
`uploads.test.ts`, `db-invariants.test.ts`, `realtime.test.ts`; run
`cd api && npm test`; fix failures in the app (never weaken tests).

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
| api/test/auth.test.ts | 19/19 pass |

## Known issues / notes

- Web app still uses Supabase; untouched so far on this branch.
- Phone OTP login (off in production) is not carried over; documented.
- Google OAuth: planned in API behind GOOGLE_CLIENT_ID/SECRET (not yet built).

## Production blockers (external)

- SMTP credentials for transactional mail (verification/reset).
- SSH access details for the VDS (host 91.151.89.238 is in known_hosts; user unknown).
- Supabase production DB connection string / service key for the data export.
- DNS cutover (explicit confirmation required).
