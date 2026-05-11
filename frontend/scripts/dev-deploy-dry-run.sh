#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCAL_BATCHER_HELPER="$FRONTEND_DIR/scripts/deploy-local-batcher.ts"
LOCAL_PRESET_FILE="$FRONTEND_DIR/.env.deploy-dry-run.local"
DEFAULT_ENV_FILE="$FRONTEND_DIR/.env"
PRESET_FILE="${DEPLOY_DRY_RUN_ENV_FILE:-}"

if [[ -z "$PRESET_FILE" ]]; then
  PRESET_FILE="$LOCAL_PRESET_FILE"
fi

if [[ ! -f "$PRESET_FILE" ]]; then
  echo "Missing deploy dry-run preset: $PRESET_FILE" >&2
  echo "Create it or set DEPLOY_DRY_RUN_ENV_FILE to an explicit env file path." >&2
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

normalize_local_origin_port() {
  local origin="$1"
  local to_port="$2"
  if [[ "$origin" =~ ^(https?://(localhost|127\.0\.0\.1)):[0-9]+(.*)$ ]]; then
    echo "${BASH_REMATCH[1]}:${to_port}${BASH_REMATCH[3]}"
    return 0
  fi
  echo "$origin"
}

USE_LOCAL_BATCHER="${DEPLOY_DRY_RUN_USE_LOCAL_BATCHER:-0}"
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
# Load default frontend env as a fallback baseline for dry-run.
if [[ -f "$DEFAULT_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$DEFAULT_ENV_FILE"
fi
# Overlay the dry-run preset so explicit dry-run values win.
# shellcheck disable=SC1090
source "$PRESET_FILE"
set +a

: "${BASE_FORK_UPSTREAM_RPC_URL:?Set BASE_FORK_UPSTREAM_RPC_URL in $PRESET_FILE or your shell environment.}"

FORK_HOST="${DEPLOY_DRY_RUN_FORK_HOST:-127.0.0.1}"
FORK_PORT="${DEPLOY_DRY_RUN_FORK_PORT:-8545}"
FORK_CHAIN_ID="${DEPLOY_DRY_RUN_FORK_CHAIN_ID:-8453}"
ANVIL_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-anvil.log"
DEV_REDIRECT_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-redirect.log"
export VITE_ALLOW_CONTRACT_OVERRIDES="${VITE_ALLOW_CONTRACT_OVERRIDES:-0}"
export ALLOW_API_CONTRACT_OVERRIDES="${ALLOW_API_CONTRACT_OVERRIDES:-0}"
export VITE_DEV_SERVER_HOST="localhost"
# Use a dedicated deterministic namespace on local forks so dry-runs do not
# collide with live Base deployments that share the repo's normal version tag.
export VITE_DEPLOYMENT_VERSION="${VITE_DEPLOYMENT_VERSION:-v1.11.0-dryrun}"

ANVIL_PID=""
DEV_REDIRECT_PID=""

cleanup() {
  if [[ -n "$DEV_REDIRECT_PID" ]] && kill -0 "$DEV_REDIRECT_PID" >/dev/null 2>&1; then
    kill "$DEV_REDIRECT_PID" >/dev/null 2>&1 || true
    wait "$DEV_REDIRECT_PID" 2>/dev/null || true
  fi
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
ALLOW_DEV_PORT_FALLBACK="${DEPLOY_DRY_RUN_ALLOW_PORT_FALLBACK:-0}"
ORIG_DEV_PORT="$DEV_PORT"
if port_in_use "$DEV_PORT"; then
  if [[ "$ALLOW_DEV_PORT_FALLBACK" == "1" ]]; then
    for candidate in 5173 5174; do
      if [[ "$candidate" != "$ORIG_DEV_PORT" ]] && ! port_in_use "$candidate"; then
        DEV_PORT="$candidate"
        break
      fi
    done
    if [[ "$DEV_PORT" != "$ORIG_DEV_PORT" ]]; then
      echo "Port ${ORIG_DEV_PORT} is busy; using ${DEV_PORT} for deploy dry-run."
    else
      echo "Port ${ORIG_DEV_PORT} is already in use and neither localhost:5173 nor localhost:5174 is available." >&2
      exit 1
    fi
  else
    echo "Port ${ORIG_DEV_PORT} is already in use. Free it or set DEPLOY_DRY_RUN_ALLOW_PORT_FALLBACK=1." >&2
    exit 1
  fi
fi
export DEPLOY_DRY_RUN_PORT="$DEV_PORT"
APP_ORIGIN="${APP_ORIGIN:-http://localhost:${DEV_PORT}}"
VITE_APP_ORIGIN="${VITE_APP_ORIGIN:-http://localhost:${DEV_PORT}}"
if [[ -n "${APP_ORIGIN:-}" ]]; then
  export APP_ORIGIN="$(normalize_local_origin_port "$APP_ORIGIN" "$DEV_PORT")"
fi
if [[ -n "${VITE_APP_ORIGIN:-}" ]]; then
  export VITE_APP_ORIGIN="$(normalize_local_origin_port "$VITE_APP_ORIGIN" "$DEV_PORT")"
fi
if [[ -n "${VITE_MARKETING_ORIGIN:-}" ]]; then
  export VITE_MARKETING_ORIGIN="$(normalize_local_origin_port "$VITE_MARKETING_ORIGIN" "$DEV_PORT")"
fi

DEFAULT_DRY_RUN_PORT=5174
if [[ "$DEV_PORT" != "$DEFAULT_DRY_RUN_PORT" ]] && ! port_in_use "$DEFAULT_DRY_RUN_PORT" && command -v python3 >/dev/null 2>&1; then
  REDIRECT_FROM_PORT="$DEFAULT_DRY_RUN_PORT" REDIRECT_TO_PORT="$DEV_PORT" python3 - <<'PY' >"$DEV_REDIRECT_LOG_FILE" 2>&1 &
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from_port = int(os.environ["REDIRECT_FROM_PORT"])
to_port = os.environ["REDIRECT_TO_PORT"]

class RedirectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._redirect()

    def do_HEAD(self):
        self._redirect()

    def _redirect(self):
        host = self.headers.get("Host", f"localhost:{from_port}").split(":", 1)[0] or "localhost"
        target = f"http://{host}:{to_port}{self.path}"
        self.send_response(307)
        self.send_header("Location", target)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def log_message(self, format, *args):
        return

ThreadingHTTPServer(("127.0.0.1", from_port), RedirectHandler).serve_forever()
PY
  DEV_REDIRECT_PID="$!"
  echo "Redirecting stale http://localhost:${DEFAULT_DRY_RUN_PORT} links to http://localhost:${DEV_PORT}."
fi

echo "Starting frontend dev server on port ${DEV_PORT} with BASE_RPC_URL=${BASE_RPC_URL} and VITE_BASE_RPC=${VITE_BASE_RPC}"
cd "$FRONTEND_DIR"
VITE_BOOTSTRAP_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-vite-bootstrap.log"
MAX_VITE_EPIPE_RETRIES="${DEPLOY_DRY_RUN_VITE_EPIPE_RETRIES:-2}"
vite_attempt=0

while true; do
  vite_attempt=$((vite_attempt + 1))
  : > "$VITE_BOOTSTRAP_LOG_FILE"

  set +e
  pnpm exec vite --host localhost --port "$DEV_PORT" --strictPort 2>&1 | tee "$VITE_BOOTSTRAP_LOG_FILE"
  vite_exit_code=${PIPESTATUS[0]}
  set -e

  if [[ "$vite_exit_code" -eq 0 ]]; then
    exit 0
  fi

  if [[ "$vite_attempt" -gt "$MAX_VITE_EPIPE_RETRIES" ]]; then
    echo "Vite exited with code ${vite_exit_code} after ${MAX_VITE_EPIPE_RETRIES} retry attempts."
    exit "$vite_exit_code"
  fi

  if grep -q "The service was stopped: write EPIPE" "$VITE_BOOTSTRAP_LOG_FILE"; then
    echo "Detected transient Vite/esbuild EPIPE during dependency optimization; clearing cache and retrying (attempt ${vite_attempt}/${MAX_VITE_EPIPE_RETRIES})..."
    rm -rf "$FRONTEND_DIR/node_modules/.vite"
    sleep 1
    continue
  fi

  exit "$vite_exit_code"
done
