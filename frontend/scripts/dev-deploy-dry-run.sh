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
LOCAL_RPC_URL="http://${FORK_HOST}:${FORK_PORT}"
ANVIL_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-anvil.log"

export BASE_RPC_URL="${BASE_RPC_URL:-$LOCAL_RPC_URL}"
export VITE_BASE_RPC="${VITE_BASE_RPC:-$LOCAL_RPC_URL}"
export VITE_ALLOW_CONTRACT_OVERRIDES="${VITE_ALLOW_CONTRACT_OVERRIDES:-0}"
export ALLOW_API_CONTRACT_OVERRIDES="${ALLOW_API_CONTRACT_OVERRIDES:-0}"
# Use a dedicated deterministic namespace on local forks so dry-runs do not
# collide with live Base deployments that share the repo's normal version tag.
export VITE_DEPLOYMENT_VERSION="${VITE_DEPLOYMENT_VERSION:-v1.5.1-dryrun}"

ANVIL_PID=""

cleanup() {
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" >/dev/null 2>&1; then
    kill "$ANVIL_PID" >/dev/null 2>&1 || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting Base fork on ${LOCAL_RPC_URL}..."
anvil \
  --host "$FORK_HOST" \
  --port "$FORK_PORT" \
  --chain-id "$FORK_CHAIN_ID" \
  --code-size-limit "${DEPLOY_DRY_RUN_FORK_CODE_SIZE_LIMIT:-393216}" \
  --fork-url "$BASE_FORK_UPSTREAM_RPC_URL" \
  >"$ANVIL_LOG_FILE" 2>&1 &
ANVIL_PID="$!"

for _ in $(seq 1 40); do
  if curl -sSf \
    -H 'Content-Type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
    "$LOCAL_RPC_URL" >/dev/null 2>&1; then
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
    DEV_PORT="${DEPLOY_DRY_RUN_PORT:-5174}"
    echo "Starting frontend dev server on port ${DEV_PORT} with BASE_RPC_URL=${BASE_RPC_URL} and VITE_BASE_RPC=${VITE_BASE_RPC}"
    cd "$FRONTEND_DIR"
    exec pnpm exec vite --port "$DEV_PORT"
  fi
  sleep 0.5
done

echo "Timed out waiting for Anvil fork to start. Recent log output:" >&2
tail -n 40 "$ANVIL_LOG_FILE" >&2 || true
exit 1
