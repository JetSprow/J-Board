#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
DEFAULT_APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
COMPOSE="${COMPOSE:-docker compose}"
BACKUP="${BACKUP:-1}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/public/app-info}"

cd "$APP_DIR"

load_resource_helpers() {
  if [ -f "$APP_DIR/scripts/lib-resource-profile.sh" ]; then
    # shellcheck disable=SC1091
    . "$APP_DIR/scripts/lib-resource-profile.sh"
  fi
}

load_resource_helpers

compose() {
  $COMPOSE "$@"
}

backup_sqlite_database() {
  mkdir -p backups

  local backup_path="backups/jboard-sqlite-$(date +%F-%H%M%S).tar.gz"
  local backed_up="0"
  local backup_cmd='cd /app/storage 2>/dev/null && if [ -f jboard.db ]; then set -- jboard.db; [ -f jboard.db-wal ] && set -- "$@" jboard.db-wal; [ -f jboard.db-shm ] && set -- "$@" jboard.db-shm; tar -czf - "$@"; fi'

  if compose ps --services --filter status=running 2>/dev/null | grep -qx app; then
    if compose exec -T app sh -lc "$backup_cmd" > "$backup_path"; then
      backed_up="1"
    fi
  fi

  if [ "$backed_up" != "1" ] || [ ! -s "$backup_path" ]; then
    if compose --profile setup run --rm -T --entrypoint sh init -lc "$backup_cmd" > "$backup_path"; then
      backed_up="1"
    fi
  fi

  if [ "$backed_up" = "1" ] && [ -s "$backup_path" ]; then
    echo "SQLite backup saved: $backup_path"
  else
    rm -f "$backup_path"
    echo "No existing SQLite database found; skipping database backup."
  fi
}

build_updated_images() {
  if command -v jboard_prepare_docker_build_env >/dev/null 2>&1; then
    jboard_prepare_docker_build_env
    jboard_print_build_profile
    if jboard_is_low_resource_build; then
      compose build "${JBOARD_DOCKER_BUILD_ARGS[@]}" init
      compose build "${JBOARD_DOCKER_BUILD_ARGS[@]}" app
    else
      compose build "${JBOARD_DOCKER_BUILD_ARGS[@]}" init app
    fi
  else
    compose build init app
  fi
}

echo "[1/7] Pulling latest code..."
git pull --ff-only
load_resource_helpers

if [ "$BACKUP" = "1" ]; then
  echo "[2/7] Backing up SQLite database..."
  backup_sqlite_database
else
  echo "[2/7] Skipping database backup..."
fi

echo "[3/7] Building updated images..."
build_updated_images

echo "[4/7] Syncing Prisma schema inside Docker network..."
compose --profile setup run --rm init sh -lc 'npm run db:push'

echo "[5/7] Restarting services..."
compose up -d app

echo "[6/7] Waiting for app to boot..."
sleep 8

echo "[7/7] Checking service status..."
compose ps

echo
echo "App health:"
curl -fsS "$HEALTH_URL" || true

echo
echo "Recent app logs:"
compose logs --tail=80 app || true

echo
echo "Upgrade complete."
