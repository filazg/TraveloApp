#!/usr/bin/env bash
# One-time install of production deps for every backend service.
# Run from the repo root after `git pull` (or after first clone).
#
#   bash deploy/install.sh
#
# Idempotent — safe to re-run after pulling new code or new deps.

set -euo pipefail

BACKEND=(
  travelo-control-service
  travelo-auth-service
  travelo-backoffice-service
  travelo-boat-service
  travelo-gateway-service
  travelo-sales-service
  travelo-transactions-service
  travelo-booking-service
  travelo-akd-service
  travelo-channel-api-service
  travelo-channel-terminals-service
  travelo-web-sales-service
  travelo-web_portal-service
)

# SPAs koje vrtimo kao Vite dev — Vite je devDependency pa BEZ --omit=dev.
FRONTEND=(
  travelo-portal
  travelo-web-sales
  travelo-partner-sales
)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for s in "${BACKEND[@]}"; do
  if [ ! -d "$s" ]; then
    echo "SKIP  $s (directory missing)"
    continue
  fi
  echo "==> backend: $s"
  ( cd "$s" && npm ci --omit=dev )
done

for s in "${FRONTEND[@]}"; do
  if [ ! -d "$s" ]; then
    echo "SKIP  $s (directory missing)"
    continue
  fi
  echo "==> frontend (with devDeps for Vite): $s"
  ( cd "$s" && npm ci )
done

echo
echo "All services installed. Next: bash deploy/start.sh"
