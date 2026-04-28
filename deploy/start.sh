#!/usr/bin/env bash
# Boot the backend stack on the test VM.
# Starts control-service first (because every other service fetches its config
# from it at boot), waits until it's reachable, then starts the rest.
#
#   bash deploy/start.sh
#
# Re-run anytime — pm2 will replace existing processes.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ECO="ecosystem.test_do.js"

echo "==> control-service first"
pm2 start "$ECO" --only travelo-control-service --update-env

echo -n "==> waiting for control-service /health"
for i in $(seq 1 20); do
  if curl -sf http://localhost:5000/health >/dev/null 2>&1; then
    echo " — up"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" = 20 ]; then
    echo
    echo "ERROR: control-service did not respond on :5000 within 20s"
    pm2 logs travelo-control-service --lines 30 --nostream || true
    exit 1
  fi
done

echo "==> remaining services"
pm2 start "$ECO" --update-env

echo "==> save"
pm2 save

echo
pm2 status
echo
echo "Done. Tail logs with: pm2 logs <name> --lines 50"
