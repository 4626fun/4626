#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/sync-env-from-frontend.sh"

set -a
# shellcheck disable=SC1091
source .env
set +a

node render-config.mjs --write

mkdir -p "$ROOT/.run"
if [[ ! -x "$ROOT/shovel" ]]; then
  curl -sL -o "$ROOT/shovel" https://indexsupply.net/bin/1.6/linux/amd64/shovel
  chmod +x "$ROOT/shovel"
fi

if pgrep -f "$ROOT/shovel -config $ROOT/config.generated.json" >/dev/null 2>&1; then
  echo "Shovel already running (pid $(pgrep -f "$ROOT/shovel -config $ROOT/config.generated.json" | head -1))"
  exit 0
fi

# Host-native Shovel avoids Docker eth_getLogs 502s against some RPC providers.
docker compose down >/dev/null 2>&1 || true

nohup "$ROOT/shovel" -config "$ROOT/config.generated.json" >>"$ROOT/.run/shovel.log" 2>&1 &
echo "Shovel started pid $! — tail -f $ROOT/.run/shovel.log"
