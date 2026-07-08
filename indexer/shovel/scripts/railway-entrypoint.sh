#!/usr/bin/env bash
# Railway / container entrypoint — probe RPC, render config, run Shovel + health listener.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: $name" >&2
    exit 1
  fi
}

# Postgres: prefer direct session URL for long-running Shovel writes.
if [[ -z "${SHOVEL_PG_URL:-}" ]]; then
  if [[ -n "${DIRECT_URL:-}" ]]; then
    export SHOVEL_PG_URL="$DIRECT_URL"
  elif [[ -n "${DATABASE_URL:-}" ]]; then
    export SHOVEL_PG_URL="$DATABASE_URL"
  fi
fi
require_env SHOVEL_PG_URL

if [[ "$SHOVEL_PG_URL" != *sslmode=* ]]; then
  export SHOVEL_PG_URL="${SHOVEL_PG_URL}$( [[ "$SHOVEL_PG_URL" == *'?'* ]] && echo '&' || echo '?' )sslmode=require"
fi

export SHOVEL_BASE_START_BLOCK="${SHOVEL_BASE_START_BLOCK:-48345250}"
export DEPLOYMENT_BATCHER="${DEPLOYMENT_BATCHER:-0x02D7abC547F8B1e7E2D7a919D8D1005918361750}"
export LOTTERY_MANAGER="${LOTTERY_MANAGER:-0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1}"
export SHOVEL_PROBE_HEADER_BATCH="${SHOVEL_PROBE_HEADER_BATCH:-200}"

echo "[shovel-railway] probing RPC candidates..." >&2
RPC_EXPORT="$(python3 "$ROOT/scripts/probe-shovel-rpc.py" --export)" || {
  echo "[shovel-railway] RPC probe failed — set BASE_LOGS_RPC_URL or BASE_READ_RPC_URL" >&2
  exit 1
}
# shellcheck disable=SC1090
eval "$RPC_EXPORT"
echo "[shovel-railway] using RPC host $(python3 -c "from urllib.parse import urlparse; print(urlparse('${BASE_LOGS_RPC_URL}').hostname or '?')") batch=${SHOVEL_BATCH_SIZE}" >&2

export SHOVEL_CONCURRENCY="${SHOVEL_CONCURRENCY:-1}"
node "$ROOT/render-config.mjs" --write

if [[ ! -x "$ROOT/shovel-main" ]]; then
  curl -fsSL -o "$ROOT/shovel-main" https://indexsupply.net/bin/main/linux/amd64/shovel
  chmod +x "$ROOT/shovel-main"
fi

node "$ROOT/scripts/health-server.mjs" &
echo "[shovel-railway] starting shovel-main (foreground)" >&2
exec "$ROOT/shovel-main" -config "$ROOT/config.generated.json"
