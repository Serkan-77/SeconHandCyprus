#!/usr/bin/env bash
# Full local rehearsal of the Supabase → PostgreSQL import, end to end:
#   old schema + data → dry run → import → verify → real API on the result.
#
# Needs: Docker, the dev database (docker-compose.dev.yml, 127.0.0.1:55432)
# and `npm ci` in api/. Creates and drops only `kie_import_test` there and a
# throwaway kie-supa-src container. Run from anywhere:
#
#   bash migration/rehearsal/rehearse.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
WORK="${REHEARSAL_DIR:-$ROOT/.rehearsal}"
DEV_DB=web-db-1
TARGET_DB=kie_import_test
SU_PW=dev-superuser-password # docker-compose.dev.yml placeholders
APP_PW=dev-app-password
OWNER_PW=dev-owner-password
PORT=4400

step() { printf '\n== %s\n' "$*"; }
rm -rf "$WORK" && mkdir -p "$WORK"

step "source: old Supabase schema + rehearsal data"
bash migration/rehearsal/build-source.sh "$WORK/storage"

step "target: fresh database, migrations"
q() { docker exec -i "$DEV_DB" psql -U postgres -XAtq -v ON_ERROR_STOP=1 "$@"; }
q -d postgres -c "drop database if exists $TARGET_DB with (force)" \
  -c "create database $TARGET_DB owner kie_owner template template0 lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8'" \
  -c "grant connect, temporary on database $TARGET_DB to kie_app"
q -d "$TARGET_DB" -c "create extension pg_trgm; create extension citext; revoke create on schema public from public; alter schema public owner to kie_owner;"
(cd api && node build.mjs >/dev/null && MIGRATIONS_DIR=dist/migrations DATABASE_OWNER_URL="postgres://kie_owner:$OWNER_PW@127.0.0.1:55432/$TARGET_DB" node dist/migrate.js)

export SOURCE_DATABASE_URL="postgres://postgres:rehearsal@127.0.0.1:55433/postgres"
export TARGET_DATABASE_URL="postgres://postgres:$SU_PW@127.0.0.1:55432/$TARGET_DB"
export STORAGE_SOURCE="$WORK/storage"
export UPLOAD_DIR="$WORK/uploads"
export IMPORT_STATE="$WORK/import-state.json"

step "import: dry run"
(cd api && node dist/supabase-import.js --dry-run)
step "import"
(cd api && node dist/supabase-import.js --report="$WORK/import-report.json")
step "verify"
(cd api && node dist/supabase-verify.js)

step "application checks (API on :$PORT against the imported data)"
cd api
DATABASE_URL="postgres://kie_app:$APP_PW@127.0.0.1:55432/$TARGET_DB" PORT=$PORT UPLOAD_DIR="$UPLOAD_DIR" SERVE_MEDIA=1 \
  node --env-file=.env dist/server.js >"$WORK/api.log" 2>&1 &
API_PID=$! # the node process itself, so the trap really stops it
cd "$ROOT"
trap 'kill $API_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -sf "http://127.0.0.1:$PORT/health/ready" >/dev/null && break; sleep 1; done
node migration/rehearsal/app-check.mjs "http://127.0.0.1:$PORT"

step "rehearsal passed"
echo "report: $WORK/import-report.json"
