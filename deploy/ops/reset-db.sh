#!/usr/bin/env bash
# Empties the application database and re-applies the migrations: used once,
# between the import rehearsal on the server and the final import (MIGRATION.md).
# Destructive. A safety dump is written first. Uploaded files are kept (the
# importer reuses processed images via its state file).
#
#   reset-db.sh --yes-delete-all-data
set -Eeuo pipefail
umask 077

ROOT="${KIE_ROOT:-/srv/kibrisikincielcim}"
BACKUP_DIR="${KIE_BACKUP_DIR:-$ROOT/backups}"
DB_CONTAINER="${KIE_DB_CONTAINER:-kibrisikincielcim-db-1}"
DB_NAME="${KIE_DB:-kibrisikincielcim}"
COMPOSE=(docker compose -f "${KIE_COMPOSE_FILE:-$ROOT/app/deploy/docker-compose.yml}" --env-file "${KIE_ENV_FILE:-$ROOT/.env}")

log() { printf '%s reset-db: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
[[ "${1:-}" == "--yes-delete-all-data" ]] || die "refusing without --yes-delete-all-data"

q() { docker exec -i "$DB_CONTAINER" psql -U postgres -d "$1" -XAtq -v ON_ERROR_STOP=1 -c "$2"; }
log "current data: $(q "$DB_NAME" "select count(*) from auth.users") accounts, $(q "$DB_NAME" "select count(*) from public.listings") listings"

"${COMPOSE[@]}" stop web api
safety="$BACKUP_DIR/pre-reset-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d "$DB_NAME" -Fc >"$safety"
log "safety dump: $safety"

q postgres "drop database if exists $DB_NAME with (force)"
q postgres "create database $DB_NAME owner kie_owner template template0 lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8'"
q postgres "revoke all on database $DB_NAME from public; grant connect, temporary on database $DB_NAME to kie_app"
q "$DB_NAME" "create extension if not exists pg_trgm; create extension if not exists citext; revoke create on schema public from public; alter schema public owner to kie_owner"

"${COMPOSE[@]}" run --rm migrate
log "empty database ready; api and web are stopped (start them after the import)"
