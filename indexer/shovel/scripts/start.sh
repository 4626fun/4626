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
if [[ ! -x "$ROOT/shovel-main" ]]; then
  curl -sL -o "$ROOT/shovel-main" https://indexsupply.net/bin/main/linux/amd64/shovel
  chmod +x "$ROOT/shovel-main"
fi
SHOVEL_BIN="$ROOT/shovel-main"

if pgrep -f "$SHOVEL_BIN -config $ROOT/config.generated.json" >/dev/null 2>&1; then
  echo "Shovel already running (pid $(pgrep -f "$SHOVEL_BIN -config $ROOT/config.generated.json" | head -1))"
  exit 0
fi

# Host-native Shovel avoids Docker eth_getLogs 502s against some RPC providers.
docker compose down >/dev/null 2>&1 || true

nohup "$SHOVEL_BIN" -config "$ROOT/config.generated.json" >>"$ROOT/.run/shovel.log" 2>&1 &
echo "Shovel started pid $! ($($SHOVEL_BIN -version | head -1)) — tail -f $ROOT/.run/shovel.log"
