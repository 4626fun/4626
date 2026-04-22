#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCAL_BATCHER_HELPER="$FRONTEND_DIR/scripts/deploy-local-batcher.ts"
DEFAULT_PRESET_FILE="$FRONTEND_DIR/.env.deploy-dry-run.example"
LOCAL_PRESET_FILE="$FRONTEND_DIR/.env.deploy-dry-run.local"
PRESET_FILE="${DEPLOY_DRY_RUN_ENV_FILE:-}"

if [[ -z "$PRESET_FILE" ]]; then
  if [[ -f "$LOCAL_PRESET_FILE" ]]; then
    PRESET_FILE="$LOCAL_PRESET_FILE"
  else
    PRESET_FILE="$DEFAULT_PRESET_FILE"
  fi
fi

if [[ ! -f "$PRESET_FILE" ]]; then
  echo "Missing deploy dry-run preset: $PRESET_FILE" >&2
  exit 1
fi

if ! command -v anvil >/dev/null 2>&1; then
  echo "Anvil is required for deploy dry-run local dev. Install Foundry and ensure 'anvil' is on PATH." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for deploy dry-run local dev readiness checks." >&2
  exit 1
fi

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return $?
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"
    return $?
  fi
  return 1
}

replace_local_origin_port() {
  local origin="$1"
  local from_port="$2"
  local to_port="$3"
  if [[ "$origin" == "http://localhost:${from_port}"* ]]; then
    echo "${origin/http:\/\/localhost:${from_port}/http:\/\/localhost:${to_port}}"
    return 0
  fi
  if [[ "$origin" == "http://127.0.0.1:${from_port}"* ]]; then
    echo "${origin/http:\/\/127.0.0.1:${from_port}/http:\/\/127.0.0.1:${to_port}}"
    return 0
  fi
  echo "$origin"
}

USE_LOCAL_BATCHER="${DEPLOY_DRY_RUN_USE_LOCAL_BATCHER:-1}"
if [[ "$USE_LOCAL_BATCHER" == "1" ]]; then
  if ! command -v forge >/dev/null 2>&1; then
    echo "forge is required when DEPLOY_DRY_RUN_USE_LOCAL_BATCHER=1." >&2
    exit 1
  fi
  if [[ ! -f "$LOCAL_BATCHER_HELPER" ]]; then
    echo "Missing local batcher helper: $LOCAL_BATCHER_HELPER" >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1090
source "$PRESET_FILE"
set +a

: "${BASE_FORK_UPSTREAM_RPC_URL:?Set BASE_FORK_UPSTREAM_RPC_URL in $PRESET_FILE or your shell environment.}"

FORK_HOST="${DEPLOY_DRY_RUN_FORK_HOST:-127.0.0.1}"
FORK_PORT="${DEPLOY_DRY_RUN_FORK_PORT:-8545}"
FORK_CHAIN_ID="${DEPLOY_DRY_RUN_FORK_CHAIN_ID:-8453}"
ANVIL_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-anvil.log"
export VITE_ALLOW_CONTRACT_OVERRIDES="${VITE_ALLOW_CONTRACT_OVERRIDES:-0}"
export ALLOW_API_CONTRACT_OVERRIDES="${ALLOW_API_CONTRACT_OVERRIDES:-0}"
# Use a dedicated deterministic namespace on local forks so dry-runs do not
# collide with live Base deployments that share the repo's normal version tag.
export VITE_DEPLOYMENT_VERSION="${VITE_DEPLOYMENT_VERSION:-v1.9.1-dryrun}"

ANVIL_PID=""

cleanup() {
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" >/dev/null 2>&1; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

ORIG_FORK_PORT="$FORK_PORT"
if port_in_use "$FORK_PORT"; then
  for candidate in 8546 8547 8548 8549; do
    if [[ "$candidate" != "$ORIG_FORK_PORT" ]] && ! port_in_use "$candidate"; then
      FORK_PORT="$candidate"
      break
    fi
  done
  if [[ "$FORK_PORT" != "$ORIG_FORK_PORT" ]]; then
    echo "Fork port ${ORIG_FORK_PORT} is busy; using ${FORK_PORT}."
  else
    echo "Fork port ${ORIG_FORK_PORT} is already in use and no fallback port (8546-8549) is available." >&2
    exit 1
  fi
fi

LOCAL_RPC_URL="http://${FORK_HOST}:${FORK_PORT}"
# Always point server + browser RPC reads to the selected local fork port.
export BASE_RPC_URL="$LOCAL_RPC_URL"
export VITE_BASE_RPC="$LOCAL_RPC_URL"
export DEPLOY_DRY_RUN_FORK_PORT="$FORK_PORT"
FALLBACK_FORK_UPSTREAM_RPC_URL="${DEPLOY_DRY_RUN_FORK_FALLBACK_RPC_URL:-https://mainnet.base.org}"

stop_anvil() {
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" >/dev/null 2>&1; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
  ANVIL_PID=""
}

start_anvil_with_fork_url() {
  local fork_url="$1"
  echo "Starting Base fork on ${LOCAL_RPC_URL}..."
  anvil \
    --host "$FORK_HOST" \
    --port "$FORK_PORT" \
    --chain-id "$FORK_CHAIN_ID" \
    --code-size-limit "${DEPLOY_DRY_RUN_FORK_CODE_SIZE_LIMIT:-393216}" \
    --fork-url "$fork_url" \
    >"$ANVIL_LOG_FILE" 2>&1 &
  ANVIL_PID="$!"
}

wait_for_anvil_ready() {
  for _ in $(seq 1 40); do
    if curl -sSf \
      -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
      "$LOCAL_RPC_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

start_anvil_with_fork_url "$BASE_FORK_UPSTREAM_RPC_URL"
if ! wait_for_anvil_ready; then
  echo "Primary fork RPC did not become ready. Recent Anvil log output:" >&2
  tail -n 40 "$ANVIL_LOG_FILE" >&2 || true
  if [[ -n "$FALLBACK_FORK_UPSTREAM_RPC_URL" ]] && [[ "$FALLBACK_FORK_UPSTREAM_RPC_URL" != "$BASE_FORK_UPSTREAM_RPC_URL" ]]; then
    echo "Retrying with fallback fork RPC..." >&2
    stop_anvil
    start_anvil_with_fork_url "$FALLBACK_FORK_UPSTREAM_RPC_URL"
    if ! wait_for_anvil_ready; then
      echo "Timed out waiting for Anvil fork to start (fallback RPC). Recent log output:" >&2
      tail -n 40 "$ANVIL_LOG_FILE" >&2 || true
      exit 1
    fi
  else
    exit 1
  fi
fi

echo "Base fork ready. Logs: $ANVIL_LOG_FILE"
if [[ "$USE_LOCAL_BATCHER" == "1" ]]; then
  echo "Deploying local DeploymentBatcher override onto the fork..."
  LOCAL_BATCHER_ADDRESS="$(
    cd "$FRONTEND_DIR"
    BASE_RPC_URL="$LOCAL_RPC_URL" \
    VITE_BASE_RPC="$LOCAL_RPC_URL" \
    pnpm exec tsx "scripts/deploy-local-batcher.ts"
  )"
  export VITE_CREATOR_VAULT_BATCHER="$LOCAL_BATCHER_ADDRESS"
  export CREATOR_VAULT_BATCHER="$LOCAL_BATCHER_ADDRESS"
  echo "Using local DeploymentBatcher at ${LOCAL_BATCHER_ADDRESS}"
fi

if [[ "${DEPLOY_DRY_RUN_CLEAR_VITE_CACHE:-1}" == "1" ]]; then
  rm -rf "$FRONTEND_DIR/node_modules/.vite"
fi
DEV_PORT="${DEPLOY_DRY_RUN_PORT:-5174}"
ORIG_DEV_PORT="$DEV_PORT"
if port_in_use "$DEV_PORT"; then
  for candidate in 5174 5175 5176 5177; do
    if [[ "$candidate" != "$ORIG_DEV_PORT" ]] && ! port_in_use "$candidate"; then
      DEV_PORT="$candidate"
      break
    fi
  done
  if [[ "$DEV_PORT" != "$ORIG_DEV_PORT" ]]; then
    echo "Port ${ORIG_DEV_PORT} is busy; using ${DEV_PORT} for deploy dry-run."
  else
    echo "Port ${ORIG_DEV_PORT} is already in use and no fallback port (5174-5177) is available." >&2
    exit 1
  fi
fi
export DEPLOY_DRY_RUN_PORT="$DEV_PORT"
if [[ -n "${APP_ORIGIN:-}" ]]; then
  export APP_ORIGIN="$(replace_local_origin_port "$APP_ORIGIN" "$ORIG_DEV_PORT" "$DEV_PORT")"
fi
if [[ -n "${VITE_APP_ORIGIN:-}" ]]; then
  export VITE_APP_ORIGIN="$(replace_local_origin_port "$VITE_APP_ORIGIN" "$ORIG_DEV_PORT" "$DEV_PORT")"
fi
echo "Starting frontend dev server on port ${DEV_PORT} with BASE_RPC_URL=${BASE_RPC_URL} and VITE_BASE_RPC=${VITE_BASE_RPC}"
cd "$FRONTEND_DIR"
exec pnpm exec vite --port "$DEV_PORT"
