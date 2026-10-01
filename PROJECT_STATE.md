# PROJECT_STATE — Kıbrıs İkinci Elcim v2 (branch `marketplace-v2`)

Read this first when resuming. Keep it current after every atomic unit of work.

## Overall goal

Replace Supabase (Postgres/RLS, Auth, Storage, Realtime) with an
application-owned stack on the VDS (Docker: Caddy on host → Next.js web +
Fastify API + PostgreSQL), while upgrading the marketplace (category tree,
dynamic attributes, search/filters, listing flow, detail page, chat, admin,
design system). Production (Vercel + Supabase) stays live until an explicit
cutover confirmation.

## Status: **code complete, verified locally; waiting on external inputs for the server**

Nothing has been deployed to the VDS. DNS, Supabase and Vercel are untouched.

## Checklist

- [x] A — audit (code, 15 Supabase migrations, security scripts, pages)
- [x] B — target architecture (docs/ARCHITECTURE.md)
- [x] C–D — api/ skeleton, shared/, db/migrations 0001–0006
- [x] E–I — API: auth, listings, uploads, messaging, realtime, admin; security suites
- [x] J–Q — web rebuilt on the API (home, search, listing page, sell wizard, chat, account, stores, admin + taxonomy manager)
- [x] R — design system; responsive QA in a real browser (33 pages × 5 widths)
- [x] S/T — CSP without Supabase, privacy text, LCP logo, i18n check, Google sign-in restored
- [x] U — E2E critical path (`npm run e2e`), production smoke rewritten (`npm run smoke`)
- [x] V — Dockerfiles, compose, Caddy snippet; prod stack run locally (restart/persistence checked)
- [x] W — backup, weekly restore drill, disaster restore, health checks + systemd timers
- [x] X — Supabase import + verify + end-to-end rehearsal (also inside the production image)
- [x] Docs — README, ARCHITECTURE, SECURITY, DEPLOYMENT, BACKUP_RESTORE, MIGRATION
- [ ] Y — server deployment, real-data rehearsal, cutover (needs the inputs below)

## Next exact action (on the VDS, once SSH access is available)

Follow docs/DEPLOYMENT.md §1–5 with a temporary hostname (e.g.
`yeni.kibrisikincielcim.com`), then docs/MIGRATION.md §4 (real-data
rehearsal), then stop at the cutover checkpoint (MIGRATION.md §5) for an
explicit go.

## Inputs needed from the owner (blockers)

| # | Input | Used for |
|---|---|---|
| 1 | SSH user + key for the VDS (91.151.89.238) | everything on the server |
| 2 | SMTP host/port/user/password + sender address; SPF/DKIM/DMARC DNS records | verification and password-reset e-mail (required) |
| 3 | DNS: an A record for a temporary hostname → VDS | staging verification before cutover |
| 4 | Supabase **Session pooler** connection string (read-only use) and the project ref | data import |
| 5 | Is Google sign-in on in production? If yes: OAuth client id/secret (existing client is fine) + add redirect URI | Google sign-in |
| 6 | Off-site backup target (e.g. an S3/B2 bucket + rclone config) | backups survive losing the server |
| 7 | Go/no-go for the write freeze and for the DNS switch | cutover (explicit confirmation required) |

## Test results (2026-10-01)

| Suite | Result |
|---|---|
| API (`npm run test:api`): auth, google, listings, messaging, admin, uploads, realtime | 94/94 |
| Web unit (`npm test`) | 61/61 |
| Web typecheck, lint, production build (Docker) | pass |
| E2E critical path (`npm run e2e`, dev stack) | pass (twice) |
| Responsive (`npm run responsive`) | no overflow / runtime errors |
| Language check (`npm run test:i18n`) | pass |
| Production smoke on the production image | 36/36 |
| Import rehearsal (`migration/rehearsal/rehearse.sh`) | pass: verify OK + 23/23 application checks |
| Backup → restore drill → disaster restore (local) | pass; tampered dump refused |

## Important commands

```bash
docker compose -f docker-compose.dev.yml up -d        # dev Postgres on 127.0.0.1:55432
npm run dev:api & npm run dev                          # API :4000, web :3000
npm run test:all                                       # web unit + API suites
E2E_PASSWORD=<SEED_PASSWORD> npm run e2e               # browser critical path (dev data)
bash migration/rehearsal/rehearse.sh                   # Supabase import rehearsal
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.localtest up -d --build   # local prod stack
```

## Migrations (new stack)

0001_baseline, 0002_auth, 0003_realtime, 0004_taxonomy_attributes,
0005_grants, 0006_owner_listing_stats. Applied only locally (dev, test,
local prod stack). Next new migration: 0007.

## Known gaps / decisions

- Phone OTP sign-in (off in production) is not carried over.
- No automatic reverse sync after cutover; rollback after DNS switch loses
  writes made on the new system (MIGRATION.md §6).
- Users sign in once more after the move (sessions are not migrated); same passwords.
- Mobile app: API ready (Bearer tokens, `{"client":"mobile"}`); native Google
  sign-in endpoint (ID token from the SDK) not built yet.
- `deploy/.env.localtest`, `api/.env`, `.env.local`, `.env.local.supabase-backup`
  are local only (gitignored).
