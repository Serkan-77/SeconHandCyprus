#!/usr/bin/env bash
# Nightly backup for Kıbrıs İkinci Elcim (run on the VDS host as root, from
# the systemd timer in this folder).
#
#   backups/
#     db/<stamp>/db.dump        pg_dump custom format (compressed)
#     db/<stamp>/manifest.txt   row counts, migration list, sizes
#     db/<stamp>/SHA256SUMS
#     uploads/<stamp>/          rsync snapshot; unchanged files are hard
#                               links to the previous snapshot (cheap)
#     weekly/<stamp> -> kept copies of Sunday's db dump
#
# Retention: KEEP_DAILY dumps/snapshots, KEEP_WEEKLY Sunday dumps. If free
# disk space drops under MIN_FREE_MB the oldest daily copies go first (never
# fewer than 2). The backup aborts before writing if the estimate does not fit.
#
# Off-site copy: set OFFSITE_CMD (e.g. an rclone or restic command reading
# $BACKUP_DIR); without it the backups live on the same disk as the data,
# which protects against mistakes, not against losing the server.
set -Eeuo pipefail
umask 077

ROOT="${KIE_ROOT:-/srv/kibrisikincielcim}"
BACKUP_DIR="${KIE_BACKUP_DIR:-$ROOT/backups}"
UPLOAD_DIR="${KIE_UPLOAD_DIR:-$ROOT/uploads}"
DB_CONTAINER="${KIE_DB_CONTAINER:-kibrisikincielcim-db-1}"
DB_NAME="${KIE_DB:-kibrisikincielcim}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
MIN_FREE_MB="${MIN_FREE_MB:-3072}"

log() { printf '%s backup: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
trap 'die "failed at line $LINENO"' ERR

mkdir -p "$BACKUP_DIR"/{db,uploads,weekly}
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || die "another backup is running"

psql_c() { docker exec -i "$DB_CONTAINER" psql -U postgres -d "$DB_NAME" -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
free_mb() { df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}'; }

docker exec "$DB_CONTAINER" pg_isready -U postgres -d "$DB_NAME" >/dev/null || die "database not ready"

# --- space check -------------------------------------------------------------
db_mb=$(( $(psql_c "select pg_database_size('$DB_NAME')") / 1048576 ))
# Uploads only cost the new files thanks to hard links; budget 10% of the tree.
up_mb=$(( $(du -sm "$UPLOAD_DIR" | cut -f1) / 10 ))
need_mb=$(( db_mb / 2 + up_mb + 50 ))
if (( $(free_mb) - need_mb < MIN_FREE_MB )); then
  log "low disk ($(free_mb) MB free, need ~${need_mb} MB + ${MIN_FREE_MB} MB reserve); pruning first"
  KEEP_DAILY=2
fi

prune() { # prune <dir> <keep>
  local dir=$1 keep=$2
  find "$dir" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort -r | tail -n +"$((keep + 1))" |
    while read -r old; do log "prune $old"; rm -rf -- "$old"; done
}
prune "$BACKUP_DIR/db" "$KEEP_DAILY"
prune "$BACKUP_DIR/uploads" "$KEEP_DAILY"
(( $(free_mb) - need_mb >= 1024 )) || die "not enough disk space for a backup ($(free_mb) MB free)"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$BACKUP_DIR/db/$stamp"
mkdir "$out.partial"

# --- database ----------------------------------------------------------------
log "dumping $DB_NAME (~${db_mb} MB on disk)"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d "$DB_NAME" -Fc -Z 6 >"$out.partial/db.dump"
# A dump that pg_restore cannot list is not a backup.
docker exec -i "$DB_CONTAINER" pg_restore --list <"$out.partial/db.dump" >/dev/null || die "dump is unreadable"

{
  echo "created_at=$stamp"
  echo "database=$DB_NAME"
  echo "dump_bytes=$(stat -c %s "$out.partial/db.dump")"
  echo "# migrations"
  psql_c "select name || ' ' || checksum from public.schema_migrations order by name"
  # Counted right after the dump; busy tables may move a little meanwhile.
  echo "# row counts"
  psql_c "select table_schema || '.' || table_name || '=' ||
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
    from information_schema.tables
    where table_schema in ('public', 'auth') and table_type = 'BASE TABLE' order by 1"
} >"$out.partial/manifest.txt"

# --- uploads -----------------------------------------------------------------
snap="$BACKUP_DIR/uploads/$stamp"
prev=$(find "$BACKUP_DIR/uploads" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort -r | head -n 1 || true)
log "snapshotting uploads${prev:+ (linked to $(basename "$prev"))}"
rsync -a --delete ${prev:+--link-dest="$prev"} "$UPLOAD_DIR"/ "$snap.partial"/
mv "$snap.partial" "$snap"

(cd "$out.partial" && sha256sum db.dump manifest.txt >SHA256SUMS)
mv "$out.partial" "$out"

# --- weekly copy (Sunday) ----------------------------------------------------
if [[ $(date -u +%u) == 7 ]]; then
  mkdir -p "$BACKUP_DIR/weekly/$stamp"
  cp -l "$out"/* "$BACKUP_DIR/weekly/$stamp/" 2>/dev/null || cp "$out"/* "$BACKUP_DIR/weekly/$stamp/"
  prune "$BACKUP_DIR/weekly" "$KEEP_WEEKLY"
fi

# --- off-site ----------------------------------------------------------------
if [[ -n "${OFFSITE_CMD:-}" ]]; then
  log "off-site copy"
  BACKUP_DIR="$BACKUP_DIR" bash -c "$OFFSITE_CMD" || die "off-site copy failed"
fi

date -u +%FT%TZ >"$BACKUP_DIR/LAST_SUCCESS"
log "done: $out ($(du -sh "$out" | cut -f1)), uploads $(du -sh "$snap" | cut -f1) apparent, $(free_mb) MB free"
