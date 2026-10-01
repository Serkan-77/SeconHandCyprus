#!/usr/bin/env bash
# Restores the LIVE database (and optionally uploads) from a backup.
# Destructive: replaces the current data. Read BACKUP_RESTORE.md first.
#
#   restore.sh backups/db/<stamp> [--with-uploads] --yes-replace-production
#
# Steps: checksum → stop api/web → keep a safety dump of the current DB →
# recreate the database → pg_restore → (rsync uploads) → start → health check.
set -Eeuo pipefail
umask 077

ROOT="${KIE_ROOT:-/srv/kibrisikincielcim}"
BACKUP_DIR="${KIE_BACKUP_DIR:-$ROOT/backups}"
UPLOAD_DIR="${KIE_UPLOAD_DIR:-$ROOT/uploads}"
DB_CONTAINER="${KIE_DB_CONTAINER:-kibrisikincielcim-db-1}"
DB_NAME="${KIE_DB:-kibrisikincielcim}"
COMPOSE=(docker compose -f "${KIE_COMPOSE_FILE:-$ROOT/app/deploy/docker-compose.yml}" --env-file "${KIE_ENV_FILE:-$ROOT/.env}")

log() { printf '%s restore: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

src=""; uploads=0; confirmed=0
for a in "$@"; do
  case "$a" in
    --with-uploads) uploads=1 ;;
    --yes-replace-production) confirmed=1 ;;
    -*) die "unknown option $a" ;;
    *) src="$a" ;;
  esac
done
[[ -f "$src/db.dump" ]] || die "usage: restore.sh <backup dir> [--with-uploads] --yes-replace-production"
(( confirmed )) || die "refusing without --yes-replace-production"
stamp=$(basename "$src")
(cd "$src" && sha256sum --quiet -c SHA256SUMS) || die "checksum mismatch"
if (( uploads )); then [[ -d "$BACKUP_DIR/uploads/$stamp" ]] || die "no uploads snapshot for $stamp"; fi

q() { docker exec -i "$DB_CONTAINER" psql -U postgres -d "$1" -XAtq -v ON_ERROR_STOP=1 -c "$2"; }

log "stopping api and web"
"${COMPOSE[@]}" stop web api

safety="$BACKUP_DIR/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).dump"
log "safety dump of the current database → $safety"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d "$DB_NAME" -Fc >"$safety"

log "recreating $DB_NAME"
q postgres "drop database if exists $DB_NAME with (force)"
q postgres "create database $DB_NAME owner kie_owner template template0 lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8'"
q postgres "revoke all on database $DB_NAME from public; grant connect, temporary on database $DB_NAME to kie_app"

log "pg_restore $stamp"
docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d "$DB_NAME" --exit-on-error <"$src/db.dump"

if (( uploads )); then
  log "restoring uploads from snapshot $stamp"
  rsync -a --delete "$BACKUP_DIR/uploads/$stamp"/ "$UPLOAD_DIR"/
fi

log "starting api and web (migrations run first)"
"${COMPOSE[@]}" up -d
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${KIE_API_PORT:-4100}/health/ready" >/dev/null 2>&1; then
    log "healthy. Safety dump kept at $safety (delete it once satisfied)."
    exit 0
  fi
  sleep 2
done
die "API did not become healthy; check: ${COMPOSE[*]} logs api"
