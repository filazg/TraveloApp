#!/usr/bin/env bash
# One-time install of production deps for every backend service.
# Run from the repo root after `git pull` (or after first clone).
#
#   bash deploy/install.sh
#
# Idempotent — safe to re-run after pulling new code or new deps.

set -euo pipefail

SERVICES=(
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

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for s in "${SERVICES[@]}"; do
  if [ ! -d "$s" ]; then
    echo "SKIP  $s (directory missing)"
    continue
  fi
  echo "==> $s"
  ( cd "$s" && npm ci --omit=dev )
done

echo
echo "All services installed. Next: bash deploy/start.sh"
