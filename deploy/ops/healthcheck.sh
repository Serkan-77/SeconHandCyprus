#!/usr/bin/env bash
# Lightweight monitoring, every 5 minutes from the systemd timer. Prints one
# line per problem and exits 1 if anything is wrong, so the journal (and an
# optional ALERT_CMD, e.g. a mail or webhook command reading stdin) shows it.
#
# Checks: API readiness, web, public site through Caddy, disk space, backup
# freshness, restore-drill freshness, container restarts.
set -uo pipefail

ROOT="${KIE_ROOT:-/srv/kibrisikincielcim}"
BACKUP_DIR="${KIE_BACKUP_DIR:-$ROOT/backups}"
SITE_URL="${SITE_URL:-}"
MIN_FREE_PCT="${MIN_FREE_PCT:-15}"
problems=()

curl -fsS -m 5 "http://127.0.0.1:${KIE_API_PORT:-4100}/health/ready" >/dev/null 2>&1 || problems+=("api not ready")
curl -fsS -m 10 -o /dev/null "http://127.0.0.1:${KIE_WEB_PORT:-3100}/robots.txt" 2>/dev/null || problems+=("web not responding")
if [[ -n "$SITE_URL" ]]; then
  curl -fsS -m 10 -o /dev/null "$SITE_URL/" 2>/dev/null || problems+=("public site $SITE_URL failing")
fi

for dir in "$ROOT" /var/lib/docker; do
  [[ -d "$dir" ]] || continue
  used=$(df -P "$dir" | awk 'NR==2 {gsub("%", "", $5); print $5}')
  (( 100 - used >= MIN_FREE_PCT )) || problems+=("disk $dir ${used}% used")
done

age_h() { [[ -f "$1" ]] && echo $(( ($(date +%s) - $(date -d "$(cat "$1")" +%s)) / 3600 )) || echo 9999; }
(( $(age_h "$BACKUP_DIR/LAST_SUCCESS") <= 26 )) || problems+=("last successful backup older than 26h")
(( $(age_h "$BACKUP_DIR/LAST_RESTORE_TEST") <= 8 * 24 )) || problems+=("last restore drill older than 8 days")

for c in kibrisikincielcim-db-1 kibrisikincielcim-api-1 kibrisikincielcim-web-1; do
  state=$(docker inspect -f '{{.State.Status}} {{.RestartCount}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null) ||
    { problems+=("$c missing"); continue; }
  read -r status restarts health <<<"$state"
  [[ "$status" == running ]] || problems+=("$c $status")
  [[ -z "$health" || "$health" == healthy ]] || problems+=("$c $health")
  (( restarts < 5 )) || problems+=("$c restarted $restarts times")
done

if (( ${#problems[@]} )); then
  msg=$(printf 'kibrisikincielcim: %s\n' "${problems[@]}")
  echo "$msg"
  [[ -n "${ALERT_CMD:-}" ]] && bash -c "$ALERT_CMD" <<<"$msg"
  exit 1
fi
echo "ok"
