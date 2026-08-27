#!/usr/bin/env bash
# Build SPA-ova za posluživanje kroz `vite preview` (SPA_MODE=preview).
#
#   bash deploy/spa_build.sh
#
# Pokreni nakon svakog `git pull` koji dira SPA kod — preview poslužuje ono što
# je u `dist/`, pa bez builda ostaje stara verzija.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for spa in travelo-portal travelo-partner-sales travelo-web-sales; do
  if [ ! -d "$spa" ]; then
    echo "SKIP  $spa (nema direktorija)"
    continue
  fi
  echo "==> $spa"
  ( cd "$spa" && npm run build )
done

echo "==> gotovo — restartaj SPA procese:"
echo "    SPA_MODE=preview pm2 restart ecosystem.config.js --update-env"
