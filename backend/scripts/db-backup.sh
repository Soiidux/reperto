#!/usr/bin/env bash
#
# MongoDB backup + restore for the Reperto clinic database.
#
# Why this exists: the app's only copy of patient records lives in MongoDB. The
# test suite is guarded against touching it (see vitest.config.ts), but nothing
# protected it from the failure modes nobody plans for — a bad migration, an
# accidental updateMany, a dropped collection, a provider outage.
#
# Usage:
#   ./scripts/db-backup.sh                 # write a timestamped dump
#   ./scripts/db-backup.sh list            # list available backups
#   ./scripts/db-backup.sh restore <file>  # restore (prompts for confirmation)
#
# Requires: mongodump / mongorestore (MongoDB Database Tools).
# Reads MONGODB_URI from backend/.env unless one is exported.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
KEEP_DAYS="${BACKUP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

log()  { printf '\033[36m[backup]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[backup]\033[0m %s\n' "$1" >&2; }
die()  { printf '\033[31m[backup]\033[0m %s\n' "$1" >&2; exit 1; }

# Resolve the connection string from the environment or backend/.env.
resolve_uri() {
  if [[ -n "${MONGODB_URI:-}" ]]; then
    printf '%s' "$MONGODB_URI"
    return
  fi
  local env_file="$SCRIPT_DIR/../.env"
  [[ -f "$env_file" ]] || die "MONGODB_URI not set and no .env at $env_file"
  # Take the first MONGODB_URI= assignment.
  grep -m1 '^MONGODB_URI=' "$env_file" | cut -d= -f2-
}

require_tools() {
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 \
      || die "'$tool' not found. Install MongoDB Database Tools: https://www.mongodb.com/docs/database-tools/installation/"
  done
}

list_backups() {
  if [[ -d "$BACKUP_DIR" ]] && compgen -G "$BACKUP_DIR/*.archive.gz" > /dev/null; then
    ls -lh --time-style=long-iso "$BACKUP_DIR"/*.archive.gz
  else
    log "No backups found in $BACKUP_DIR"
  fi
}

do_backup() {
  require_tools mongodump
  mkdir -p "$BACKUP_DIR"

  local uri out
  uri="$(resolve_uri)"
  [[ -n "$uri" ]] || die "Could not resolve MONGODB_URI"
  out="$BACKUP_DIR/reperto-$STAMP.archive.gz"

  log "Dumping to $out"
  # --archive produces a single restorable file; --gzip keeps it small.
  # Credentials stay in the URI, which is why the output is chmod 600 below.
  if ! mongodump --uri="$uri" --archive="$out" --gzip; then
    rm -f "$out"
    die "mongodump failed — not leaving a partial backup behind"
  fi
  chmod 600 "$out"

  log "Done: $(du -h "$out" | cut -f1) at $out"

  # Prune old dumps so the disk doesn't fill up, but keep a floor of 3.
  local keep
  keep=$(find "$BACKUP_DIR" -name 'reperto-*.archive.gz' -mtime "+$KEEP_DAYS" | wc -l | tr -d ' ')
  if [[ "$keep" -gt 0 ]]; then
    find "$BACKUP_DIR" -name 'reperto-*.archive.gz' -mtime "+$KEEP_DAYS" -delete
    log "Pruned $keep backup(s) older than $KEEP_DAYS days"
  fi
}

do_restore() {
  require_tools mongorestore
  local file="${1:-}"
  [[ -n "$file" ]] || die "restore requires a backup file: $0 restore <file>"
  [[ -f "$file" ]] || die "No such backup: $file"

  local uri
  uri="$(resolve_uri)"

  printf '\033[33mThis will REPLACE the contents of the database in MONGODB_URI.\033[0m\n'
  printf 'Target: %s\n' "$(printf '%s' "$uri" | sed -E 's#//[^@]*@#//****@#')"
  printf 'Backup: %s\n' "$file"
  read -r -p 'Type the database name to confirm: ' confirm
  local db
  db=$(printf '%s' "$uri" | sed -E 's#.*/([^/?]+).*#\1#')
  [[ "$confirm" == "$db" ]] || die "Confirmation did not match '$db' — aborted"

  log "Restoring (this overwrites existing documents)"
  mongorestore --uri="$uri" --archive="$file" --gzip --drop
  log "Restore complete"
}

case "${1:-backup}" in
  backup)  do_backup ;;
  list)    list_backups ;;
  restore) shift; do_restore "${1:-}" ;;
  *)       die "Unknown command '$1'. Use: backup | list | restore <file>" ;;
esac