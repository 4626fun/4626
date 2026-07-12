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
export SHOVEL_BATCH_SIZE="${SHOVEL_BATCH_SIZE:-200}"
export SHOVEL_HEALTH_MAX_LAG_BLOCKS="${SHOVEL_HEALTH_MAX_LAG_BLOCKS:-256}"
export SHOVEL_HEALTH_WARMUP_MS="${SHOVEL_HEALTH_WARMUP_MS:-180000}"
export SHOVEL_STATUS_LOG_MS="${SHOVEL_STATUS_LOG_MS:-60000}"
export SHOVEL_RLS_RETRY_SECONDS="${SHOVEL_RLS_RETRY_SECONDS:-30}"
export SHOVEL_RLS_RETRY_MAX="${SHOVEL_RLS_RETRY_MAX:-60}"
node "$ROOT/render-config.mjs" --write

if [[ ! -x "$ROOT/shovel-main" ]]; then
  curl -fsSL -o "$ROOT/shovel-main" https://indexsupply.net/bin/main/linux/amd64/shovel
  chmod +x "$ROOT/shovel-main"
fi

# Deferred RLS: Shovel creates protocol_* tables on first converge. Apply after
# schema exists instead of before shovel-main starts.
(
  attempt=1
  while (( attempt <= SHOVEL_RLS_RETRY_MAX )); do
    sleep "$SHOVEL_RLS_RETRY_SECONDS"
    if bash "$ROOT/scripts/apply-protocol-index-rls.sh"; then
      echo "[shovel-rls] deferred apply succeeded on attempt ${attempt}" >&2
      exit 0
    fi
    echo "[shovel-rls] deferred attempt ${attempt}/${SHOVEL_RLS_RETRY_MAX} not ready yet" >&2
    attempt=$((attempt + 1))
  done
  echo "[shovel-rls] deferred apply exhausted retries — apply manually after converge" >&2
  exit 1
) &

node "$ROOT/scripts/health-server.mjs" &
echo "[shovel-railway] starting shovel-main (foreground)" >&2
exec "$ROOT/shovel-main" -config "$ROOT/config.generated.json"
