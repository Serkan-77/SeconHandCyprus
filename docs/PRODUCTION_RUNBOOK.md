# Production Runbook — Kıbrıs İkinci Elcim

Operational procedures for the live system. Architecture and development rules:
[`CLAUDE.md`](../CLAUDE.md). Background (Turkish): `DEPLOYMENT.md`,
`BACKUP_RESTORE.md`, `MIGRATION.md`, `SECURITY.md`.

> **Ground rules**
> - Deploy only when the owner explicitly asks ("deploy", "canlıya al", "sunucuya geçir", "yayınla").
> - `/srv/gezeceyik-kibris` is another application on the same server. Never touch its
>   directory, containers, network or Caddy blocks.
> - Never print, copy or commit values from `/srv/kibrisikincielcim/.env` or `ops.env`.
> - Never `git reset --hard` / `git clean -fd` on the server, never `reset-db.sh`, never publish the DB port.
> - If any step fails: **STOP**. Do not run the next command. Diagnose (§8), preserve data first.

## 0. Facts

| | |
|---|---|
| SSH | `ssh serkan@91.151.89.238` (Ubuntu 24.04) |
| Code | `/srv/kibrisikincielcim/app` (git, branch `marketplace-v2`) |
| Env | `/srv/kibrisikincielcim/.env` (600), `/srv/kibrisikincielcim/ops.env` (600, systemd ops) |
| Data | `/srv/kibrisikincielcim/data/postgres`, `/srv/kibrisikincielcim/uploads` (uid 1000, 755), `/srv/kibrisikincielcim/backups` (700) |
| Compose | `deploy/docker-compose.yml`, project `kibrisikincielcim`, services `db`, `migrate`, `api`, `web` |
| Containers | `kibrisikincielcim-db-1`, `kibrisikincielcim-api-1`, `kibrisikincielcim-web-1` |
| Ports | web 127.0.0.1:3100→3000, api 127.0.0.1:4100→4000, db **not published** |
| Networks | `kibrisikincielcim_db` (internal), `kibrisikincielcim-network` (external, must exist) |
| Caddy | `/etc/caddy/Caddyfile` imports `/srv/kibrisikincielcim/app/deploy/Caddyfile`; log `/var/log/caddy/kibrisikincielcim.log` |
| Domains | `www.kibrisikincielcim.com` (canonical), apex → www, `new.kibrisikincielcim.com` (direct) |
| Timers | `kie-backup.timer` (03:30 UTC daily), `kie-restore-test.timer` (Mon 05:00), `kie-healthcheck.timer` (every 5 min) |

Shell helper used throughout:

```bash
cd /srv/kibrisikincielcim/app
DC="docker compose -f deploy/docker-compose.yml --env-file /srv/kibrisikincielcim/.env"
```

## 1. Pre-deploy checks (local machine)

1. Working tree clean, intended commits only: `git status`, `git log origin/marketplace-v2..HEAD --oneline`.
2. Tests/builds for what changed (see CLAUDE.md §5):
   - web: `npm run lint && npm run typecheck && npm test && npm run build`
   - api: `cd api && npx tsc --noEmit -p . && cd .. && npm run test:api`
3. New migration? Re-read it for data safety (nullable/defaults, no destructive statements, RLS + grants).
4. New env variable? It must be in `api/src/config.ts` **and** `deploy/docker-compose.yml` **and** `deploy/.env.example`.
   Tell the owner which key to add to the server `.env` (they add the value; don't ask for it in chat).
5. Push: `git push origin marketplace-v2`.

## 2. Inspect the server before touching anything

```bash
ssh serkan@91.151.89.238
cd /srv/kibrisikincielcim/app
git status
git branch --show-current          # marketplace-v2
git log -1 --oneline
git diff --stat; git diff          # production-only edits may exist (compose, Caddyfile)
stat -c '%U' .git                  # if root-owned, use "sudo git" for the git commands below
$DC ps                             # all healthy before you start?
df -h /srv /var/lib/docker         # room for images + backup
```

Write down the current commit (`git rev-parse HEAD`) — it is your rollback target.

## 3. Reconcile production-only edits (never discard blindly)

Known case: `EXTRA_ORIGINS: ${EXTRA_ORIGINS:-}` was added by hand to the api `environment` in
`deploy/docker-compose.yml`. It is now committed in Git as well. The `deploy/Caddyfile` may also be edited
on the server (production blocks enabled, `new.` hostname) — the Git copy still has them commented out.

```bash
git fetch origin
git diff > ~/server-local-$(date +%F).patch          # keep a copy (check it holds no secrets)
git diff HEAD origin/marketplace-v2 -- deploy/       # what the update changes in the same files
```

For each locally modified file:

- **Local edit is already identical in `origin/marketplace-v2`** (e.g. the EXTRA_ORIGINS line): it is safe to drop
  the local copy of that one file — `git checkout -- deploy/docker-compose.yml` — then verify after the pull that the
  line is present: `grep -n EXTRA_ORIGINS deploy/docker-compose.yml`.
- **Local edit not in Git** (e.g. Caddyfile): do not deploy over it. `git stash` → `git pull --ff-only` → `git stash pop`,
  resolve, and afterwards commit the real production version to the repo from the dev machine so the server becomes clean.
  For Caddyfile changes always run `caddy validate` (§6) before any reload.

Then:

```bash
git pull --ff-only origin marketplace-v2
git log -1 --oneline
grep -n 'EXTRA_ORIGINS' deploy/docker-compose.yml   # must be present
```

If `--ff-only` refuses, the server has local commits or diverged — stop and investigate, don't force.

## 4. Deploy

### 4.1 Backup (before every deploy; mandatory before migrations or data operations)

```bash
sudo systemctl start kie-backup.service
sudo journalctl -u kie-backup -n 30 --no-pager      # last line must be "backup: done: …"
cat /srv/kibrisikincielcim/backups/LAST_SUCCESS     # just now
```

Optional fast rollback: keep the running images under a second tag.

```bash
docker tag kibrisikincielcim-api:latest kibrisikincielcim-api:prev
docker tag kibrisikincielcim-web:latest kibrisikincielcim-web:prev
```

### 4.2 Full deploy (default, safest)

```bash
$DC build                 # builds the api image (via "migrate") and web; site keeps serving the old containers
$DC run --rm migrate      # expect "applied 00xx_…" or "database is up to date"
$DC up -d                 # recreates changed containers (migrate runs again: no-op)
$DC ps                    # db, api, web → healthy (web waits for api)
```

If `build` fails: nothing changed in production — fix and retry.
If `migrate` fails: each migration runs in its own transaction, so the failing one left no changes; earlier
ones in the same run are committed. Old containers are still serving. **Do not run `up -d`.** Read the error (§8).

### 4.3 Partial deploys (only when you understand the dependency)

| Change | Commands | Notes |
|---|---|---|
| Web/UI only (no API contract change) | `$DC build web && $DC up -d --no-deps web` | `NEXT_PUBLIC_*` changes also need this (build-time values) |
| API only, no migration | `$DC build migrate && $DC up -d --no-deps api` | `migrate` builds the shared api image |
| API + migration | `$DC build migrate && $DC run --rm migrate && $DC up -d --no-deps api` | migrate **before** the new api; the old api must tolerate the new schema briefly (additive migrations do) |
| Runtime env change (API) | edit `.env` → `$DC up -d --no-deps api` | no rebuild; compose must already map the variable |
| Contract change web + api | full deploy (4.2); api first is preferable — the new web expects the new API | keep changes backward compatible when practical |

When unsure, use 4.2.

## 5. Verify

```bash
$DC ps
curl -s http://127.0.0.1:4100/health/ready          # {"status":"ok","checks":{"database":"ok","disk":"ok"}}
curl -sI http://127.0.0.1:3100/robots.txt | head -1 # 200
curl -I https://www.kibrisikincielcim.com            # HTTP/2 200
curl -I https://kibrisikincielcim.com                # 301 → https://www.kibrisikincielcim.com/
docker ps --format '{{.Names}} {{.Ports}}' | grep kibrisikincielcim   # db shows only "5432/tcp" (unpublished)
$DC logs --tail 50 api web
```

Production smoke test (read-only, safe; runs in a Node container so the host needs no Node):

```bash
docker run --rm \
  --network host \
  -e SMOKE_BASE_URL=https://www.kibrisikincielcim.com \
  -e NEXT_PUBLIC_SITE_URL=https://www.kibrisikincielcim.com \
  -v /srv/kibrisikincielcim/app:/app:ro \
  -w /app \
  node:24-bookworm-slim \
  node scripts/production-smoke.mjs
```

Known-good baseline: **36/36 kontrol geçti.** The deploy is not complete until this passes. If the number of
checks changes because the script changed, note the new baseline in CLAUDE.md.

Manual spot checks after risky changes (use a real test account, never the e2e script against production —
`scripts/e2e.mjs` writes data): sign in, open a listing with photos, send a message and see it arrive live in a
second browser, admin panel loads.

## 6. Caddy changes (rare)

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%F-%H%M)
# edit /etc/caddy/Caddyfile or deploy/Caddyfile (only the kie blocks; never gezeceyik's)
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile     # must say "Valid configuration"
sudo systemctl reload caddy                            # only after a valid result
sudo journalctl -u caddy -n 30 --no-pager
curl -I https://www.kibrisikincielcim.com; curl -I https://kibrisikincielcim.com; curl -I https://new.kibrisikincielcim.com
```

Keep the `/media` regex, `/health` → 404, `/api/*` 14 MB body limit and `X-Request-Id` header_up intact.
If upload key format changes in code (`KEY_PATTERN`), the Caddy `@variant` regex must change with it.

## 7. Rollback

**Application only (no migration in the release):**

```bash
# fastest, if you tagged :prev in 4.1
docker tag kibrisikincielcim-api:prev kibrisikincielcim-api:latest
docker tag kibrisikincielcim-web:prev kibrisikincielcim-web:latest
$DC up -d --no-deps api web
# otherwise
git checkout <previous-commit>      # detached HEAD; return to the branch afterwards
$DC build && $DC up -d
```

**Release included a migration:** migrations are forward-only. If the old code still works with the new
schema (additive change), roll back the application only. If not, fix forward, or restore the pre-deploy
backup — this **loses every write since the backup** and needs the owner's explicit go:

```bash
sudo bash deploy/ops/restore.sh /srv/kibrisikincielcim/backups/db/<stamp> --yes-replace-production
# add --with-uploads only if files were damaged; it rsyncs (with --delete) the snapshot over uploads/
```

`restore.sh` verifies checksums, stops api/web, writes a safety dump, recreates the DB, restores, starts the
stack (migrations run) and waits for health. Then run §5.

## 8. Troubleshooting (failure → where to look)

| Stage | Symptoms | Look at |
|---|---|---|
| build | compose build error | build output; `df -h` (disk); `docker system df` |
| migrate | non-zero exit, `Migration X was changed after it was applied` | `$DC run --rm migrate` output. "changed after applied" = someone edited an applied migration → revert that edit, add a new migration |
| container start | api restarting | `$DC logs --tail 200 api` — `Invalid environment:` lists missing/bad variable **names** (check `.env` + compose mapping) |
| healthcheck | api `unhealthy` | `curl -s 127.0.0.1:4100/health/ready` (database down? disk low?); `$DC logs db` |
| web | web `unhealthy` / 502 from Caddy | `$DC logs web`; web waits for api health; `Ortam değişkenleri hatalı` = bad NEXT_PUBLIC env at build |
| routing / TLS | 502/404 at the domain | `sudo journalctl -u caddy`, `/var/log/caddy/kibrisikincielcim.log` (JSON; search by `x-request-id`), `ss -tlnp \| grep -E ':(3100\|4100)'` |
| CSRF 403 "İstek doğrulanamadı" on writes from a hostname | Origin not allowed | `SITE_URL`/`EXTRA_ORIGINS` in `.env` **and** mapped in compose; `$DC up -d --no-deps api` |
| e-mail not arriving | | `$DC logs api \| grep "mail delivery failed"`; SMTP settings (Resend) in `.env`; SPF/DKIM/DMARC |
| smoke fails | | the failing check's name; compare with `scripts/production-smoke.mjs` |

Logs: `$DC logs -f api web` (json-file 5×10 MB), slow queries `$DC logs db` (≥500 ms), ops
`journalctl -u kie-backup -u kie-restore-test -u kie-healthcheck`. Every response has `x-request-id`.

Database shell (read-only investigation; prefer `SELECT`, never hand-edit schema):

```bash
docker exec -it kibrisikincielcim-db-1 psql -U postgres -d kibrisikincielcim
select name, applied_at from public.schema_migrations order by name;
```

## 9. Backups, restore drill, health

- Nightly `deploy/ops/backup.sh`: `pg_dump -Fc` + manifest + SHA256SUMS in `backups/db/<stamp>/`, hard-linked
  rsync snapshot of uploads in `backups/uploads/<stamp>/`, Sunday copies in `weekly/`; keeps 7 daily / 4 weekly;
  writes `backups/LAST_SUCCESS`. Runs `OFFSITE_CMD` from `ops.env` if set.
- Weekly `restore-test.sh` restores the newest dump into a scratch DB and checks it; writes `LAST_RESTORE_TEST`.
- `healthcheck.sh` every 5 min: api ready, web, public `SITE_URL` (from `ops.env`), disk, backup age ≤26 h,
  drill age ≤8 days, container health/restarts; runs `ALERT_CMD` on problems.

```bash
systemctl list-timers 'kie-*'
sudo journalctl -u kie-healthcheck -n 20 --no-pager
sudo systemctl start kie-restore-test.service && sudo journalctl -u kie-restore-test -n 30 --no-pager
```

After changing anything under `deploy/ops/systemd/`: copy the units to `/etc/systemd/system/` and
`sudo systemctl daemon-reload`. The services run scripts straight from `/srv/kibrisikincielcim/app/deploy/ops/`,
so a `git pull` changes their behaviour immediately.

## 10. Secrets handling

- Check presence without printing values: `sudo grep -c '^JWT_SECRET=' /srv/kibrisikincielcim/.env`.
  Non-secret keys may be read: `sudo grep -E '^(SITE_URL|EXTRA_ORIGINS)=' /srv/kibrisikincielcim/.env`.
- Don't run `docker inspect` / `$DC config` in shared output — both print environment values.
- `JWT_SECRET` rotation invalidates every current access token; sessions/refresh tokens survive, but users may
  look signed out until their 15-minute access cookie expires and gets refreshed. Do it only when needed.
  Changing DB role passwords requires `ALTER ROLE` inside the DB as well as `.env` (init only runs once).

## 11. Known follow-ups (owner to confirm before acting)

1. Reconcile the server's hand-edited `deploy/docker-compose.yml` with the committed EXTRA_ORIGINS line (§3) on the next deploy.
2. Commit the real production `deploy/Caddyfile` (www, apex redirect, `new.`) — the repo copy is still the pre-cutover template.
3. `/srv/kibrisikincielcim/ops.env`: `SITE_URL=https://www.kibrisikincielcim.com` for the healthcheck.
4. Off-site backups: configure `OFFSITE_CMD` (e.g. rclone to a versioned bucket) and confirm a run.
5. Supabase project and Vercel deployment stay untouched for rollback until the owner decides otherwise.
