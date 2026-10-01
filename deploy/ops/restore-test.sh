#!/usr/bin/env bash
# Restore drill: proves the newest (or a given) backup can be restored,
# without touching the live database. Run weekly from the systemd timer and
# after every change to the backup setup.
#
#   restore-test.sh [backups/db/<stamp>]
#
# 1. verifies the checksums
# 2. restores the dump into a scratch database (kie_restore_test) in the same
#    PostgreSQL server
# 3. checks the migration list matches the manifest, foreign keys hold,
#    row counts are in line with the manifest, and RLS is still enabled
# 4. checks a sample of image paths exists in the matching uploads snapshot
# 5. drops the scratch database
set -Eeuo pipefail
umask 077

ROOT="${KIE_ROOT:-/srv/kibrisikincielcim}"
BACKUP_DIR="${KIE_BACKUP_DIR:-$ROOT/backups}"
DB_CONTAINER="${KIE_DB_CONTAINER:-kibrisikincielcim-db-1}"
SCRATCH=kie_restore_test

log() { printf '%s restore-test: %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "FAILED: $*"; exit 1; }

src="${1:-$(find "$BACKUP_DIR/db" -mindepth 1 -maxdepth 1 -type d -name '20*' ! -name '*.partial' | sort -r | head -n 1)}"
[[ -n "$src" && -f "$src/db.dump" ]] || die "no backup found"
stamp=$(basename "$src")
log "testing $src"

(cd "$src" && sha256sum --quiet -c SHA256SUMS) || die "checksum mismatch"

q() { docker exec -i "$DB_CONTAINER" psql -U postgres -d "$1" -XAtq -v ON_ERROR_STOP=1 -c "$2"; }
cleanup() { q postgres "drop database if exists $SCRATCH with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
q postgres "create database $SCRATCH owner kie_owner template template0 lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8'"
start=$(date +%s)
docker exec -i "$DB_CONTAINER" pg_restore -U postgres -d "$SCRATCH" --exit-on-error --no-comments <"$src/db.dump" ||
  die "pg_restore failed"
log "restored in $(( $(date +%s) - start ))s"

# Migrations: exactly what the manifest recorded.
expected=$(sed -n '/^# migrations/,/^# /{/^#/d;p}' "$src/manifest.txt")
actual=$(q "$SCRATCH" "select name || ' ' || checksum from public.schema_migrations order by name")
[[ "$expected" == "$actual" ]] || die "migration list differs from manifest"
log "migrations: $(wc -l <<<"$actual") match"

# Foreign keys are re-validated by pg_restore; re-check NOT VALID ones too.
bad=$(q "$SCRATCH" "select count(*) from pg_constraint where contype='f' and not convalidated")
[[ "$bad" == 0 ]] || die "$bad unvalidated foreign keys"

# RLS must survive the round trip.
norls=$(q "$SCRATCH" "select string_agg(relname, ',') from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and relname in ('listings','messages','conversations','profiles','favorites','notifications')
  and not relrowsecurity")
[[ -z "$norls" ]] || die "row level security missing on: $norls"

# Row counts against the manifest. Busy tables (rate limits, sessions) may
# move between the dump and the count: allow 1% + 25 rows of drift.
while IFS='=' read -r table n; do
  [[ "$table" =~ ^(public|auth)\.[a-z_]+$ && "$n" =~ ^[0-9]+$ ]] || continue
  got=$(q "$SCRATCH" "select count(*) from $table")
  diff=$(( got > n ? got - n : n - got ))
  (( diff <= n / 100 + 25 )) || die "row count for $table: manifest $n, restored $got"
done < <(sed -n '/^# row counts/,${/^#/d;p}' "$src/manifest.txt")
log "row counts consistent; listings=$(q "$SCRATCH" "select count(*) from public.listings"), users=$(q "$SCRATCH" "select count(*) from public.profiles")"

# Images: every sampled listing image must exist in the same night's snapshot.
snap="$BACKUP_DIR/uploads/$stamp"
if [[ -d "$snap" ]]; then
  missing=0; checked=0
  while read -r p; do
    [[ -z "$p" ]] && continue
    checked=$((checked + 1))
    [[ -f "$snap/$p/md.webp" ]] || { missing=$((missing + 1)); log "missing image $p"; }
  done < <(q "$SCRATCH" "select path from public.listing_images order by random() limit 200")
  (( missing == 0 )) || die "$missing of $checked sampled images missing from $snap"
  log "images: $checked sampled, all present"
else
  log "WARNING: no uploads snapshot for $stamp"
fi

date -u +%FT%TZ >"$BACKUP_DIR/LAST_RESTORE_TEST"
log "OK ($stamp)"
