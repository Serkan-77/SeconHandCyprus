#!/usr/bin/env bash
# Builds a disposable stand-in for the old Supabase database (schema from
# supabase/migrations + rehearsal data) and a fake Storage directory, for the
# import rehearsal. Local only: binds 127.0.0.1:55433.
#
#   migration/rehearsal/build-source.sh <storage-dir>
set -euo pipefail
cd "$(dirname "$0")/../.."
STORAGE_DIR="${1:?usage: build-source.sh <storage-dir>}"
NAME=kie-supa-src

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=rehearsal -p 127.0.0.1:55433:5432 postgres:17-bookworm >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2

{
  cat migration/rehearsal/00-supabase-stub.sql
  for f in supabase/migrations/*.sql; do cat "$f"; echo; done
} | docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q 2>&1 | grep -vE "NOTICE|wal_level|HINT" || true
docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -1 <migration/rehearsal/10-seed.sql

# Storage objects: real images for most rows, a corrupt file, one missing.
node migration/rehearsal/make-images.mjs "$STORAGE_DIR"
echo "source ready: postgres://postgres:rehearsal@127.0.0.1:55433/postgres, storage at $STORAGE_DIR"
