#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
DEFAULT_APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${APP_DIR:-$DEFAULT_APP_DIR}"
COMPOSE="${COMPOSE:-docker compose}"
BACKUP="${BACKUP:-1}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/public/app-info}"

cd "$APP_DIR"

echo "[1/7] Pulling latest code..."
git pull --ff-only

if [ "$BACKUP" = "1" ]; then
  echo "[2/7] Backing up database..."
  mkdir -p backups
  $COMPOSE exec -T db pg_dump -U jboard jboard > "backups/jboard-db-$(date +%F-%H%M%S).sql"
else
  echo "[2/7] Skipping database backup..."
fi

echo "[3/7] Building updated images..."
$COMPOSE build init app

echo "[4/7] Syncing Prisma schema inside Docker network..."
$COMPOSE --profile setup run --rm init sh -lc 'npm run db:push'

echo "[5/7] Restarting services..."
$COMPOSE up -d app

echo "[6/7] Waiting for app to boot..."
sleep 8

echo "[7/7] Checking service status..."
$COMPOSE ps

echo
echo "App health:"
curl -fsS "$HEALTH_URL" || true

echo
echo "Recent app logs:"
$COMPOSE logs --tail=80 app || true

echo
echo "Upgrade complete."
