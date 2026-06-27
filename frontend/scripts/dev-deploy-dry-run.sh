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

read_frontend_nvmrc_version() {
  if [[ ! -f "$FRONTEND_DIR/.nvmrc" ]]; then
    echo "20.19.0"
    return 0
  fi
  sed 's/^[[:space:]]*v//; s/[[:space:]]*$//' "$FRONTEND_DIR/.nvmrc"
}

activate_frontend_node() {
  local nvm_version nvm_node_bin
  nvm_version="$(read_frontend_nvmrc_version)"
  nvm_node_bin="${NVM_DIR:-$HOME/.nvm}/versions/node/v${nvm_version}/bin/node"
  if [[ -x "$nvm_node_bin" ]]; then
    export PATH="$(dirname "$nvm_node_bin"):$PATH"
    return 0
  fi

  if [[ ! -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    return 0
  fi

  # pnpm -C frontend injects npm_config_prefix=<package dir>; nvm refuses to load until it is cleared.
  unset npm_config_prefix NPM_CONFIG_PREFIX
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  if [[ -f "$FRONTEND_DIR/.nvmrc" ]]; then
    (cd "$FRONTEND_DIR" && nvm use --silent >/dev/null 2>&1) || (cd "$FRONTEND_DIR" && nvm install >/dev/null 2>&1)
  else
    nvm use --silent 20.19.0 >/dev/null 2>&1 || nvm install 20.19.0 >/dev/null 2>&1
  fi
  if command -v node >/dev/null 2>&1; then
    export PATH="$(dirname "$(command -v node)"):$PATH"
  fi
}

ensure_node_version() {
  local required_major=20
  local required_minor=19
  activate_frontend_node
  local current=""
  if command -v node >/dev/null 2>&1; then
    current="$(node -p "process.versions.node.split('.').map(Number)" 2>/dev/null || true)"
  fi
  if [[ -z "$current" ]]; then
    echo "Node.js is required for deploy dry-run local dev." >&2
    exit 1
  fi
  local major minor
  IFS=',' read -r major minor _ <<<"${current//[\[\] ]/}"
  if [[ "$major" -lt "$required_major" ]] || { [[ "$major" -eq "$required_major" ]] && [[ "$minor" -lt "$required_minor" ]]; }; then
    echo "Node.js >= ${required_major}.${required_minor}.0 is required (Vite 7). Current: $(node -v 2>/dev/null || echo unknown)." >&2
    echo "Run: cd frontend && nvm use" >&2
    exit 1
  fi
}

ensure_node_version

ensure_server_core_dist() {
  local dist_index="$FRONTEND_DIR/packages/server-core/dist/index.js"
  local dist_auth="$FRONTEND_DIR/packages/server-core/dist/auth.js"
  if [[ -f "$dist_index" && -f "$dist_auth" ]]; then
    return 0
  fi
  echo "Missing @4626/server-core dist artifacts; building local API runtime package..."
  (
    cd "$FRONTEND_DIR"
    pnpm run build:server-core
  )
}

ensure_server_core_dist

maybe_raise_inotify_limit() {
  local target=524288
  local current=0
  if [[ -r /proc/sys/fs/inotify/max_user_watches ]]; then
    current="$(cat /proc/sys/fs/inotify/max_user_watches)"
  fi
  if [[ "$current" -ge "$target" ]]; then
    return 0
  fi
  if command -v sudo >/dev/null 2>&1 && sudo -n sysctl -w "fs.inotify.max_user_watches=${target}" >/dev/null 2>&1; then
    echo "Raised fs.inotify.max_user_watches to ${target}."
    return 0
  fi
  echo "Warning: fs.inotify.max_user_watches=${current} (recommend >= ${target} on WSL)." >&2
  echo "Run: echo ${target} | sudo tee /proc/sys/fs/inotify/max_user_watches" >&2
  echo "Persistent fix: add 'fs.inotify.max_user_watches=${target}' to /etc/sysctl.conf, then sudo sysctl -p" >&2
}

maybe_raise_inotify_limit

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

listener_pid_for_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -t -iTCP:"$port" -sTCP:LISTEN -n -P 2>/dev/null | head -1
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | awk -v port=":${port}" '
      $4 ~ port "$" {
        if (match($0, /pid=[0-9]+/)) {
          print substr($0, RSTART + 4, RLENGTH - 4)
          exit
        }
      }
    '
  fi
}

# Stop a stale standalone Vite dev server so deploy dry-run can bind strictPort.
reclaim_stale_vite_port() {
  local port="$1"
  local pid cmd
  pid="$(listener_pid_for_port "$port")"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  if [[ "$cmd" != *vite* ]]; then
    return 1
  fi
  if [[ "$cmd" != *"${port}"* ]]; then
    return 1
  fi
  echo "Reclaiming localhost:${port} from stale Vite (pid ${pid})..."
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 10); do
    if ! port_in_use "$port"; then
      return 0
    fi
    sleep 0.2
  done
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

# Preserve explicit shell overrides so preset files do not clobber CLI intent.
CLI_DEPLOY_DRY_RUN_USE_LOCAL_BATCHER="${DEPLOY_DRY_RUN_USE_LOCAL_BATCHER-__unset__}"
CLI_DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK="${DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK-__unset__}"
CLI_VITE_VAULT_VANITY_PREFIX="${VITE_VAULT_VANITY_PREFIX-__unset__}"
CLI_VITE_VAULT_VANITY_MAX_TRIES="${VITE_VAULT_VANITY_MAX_TRIES-__unset__}"
CLI_VITE_SHARE_OFT_VANITY_SUFFIX="${VITE_SHARE_OFT_VANITY_SUFFIX-__unset__}"
CLI_VITE_SHARE_OFT_VANITY_MAX_TRIES="${VITE_SHARE_OFT_VANITY_MAX_TRIES-__unset__}"

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

# Re-apply explicit CLI overrides after sourcing env files.
if [[ "$CLI_DEPLOY_DRY_RUN_USE_LOCAL_BATCHER" != "__unset__" ]]; then
  export DEPLOY_DRY_RUN_USE_LOCAL_BATCHER="$CLI_DEPLOY_DRY_RUN_USE_LOCAL_BATCHER"
fi
if [[ "$CLI_DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK" != "__unset__" ]]; then
  export DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK="$CLI_DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK"
fi
if [[ "$CLI_VITE_VAULT_VANITY_PREFIX" != "__unset__" ]]; then
  export VITE_VAULT_VANITY_PREFIX="$CLI_VITE_VAULT_VANITY_PREFIX"
fi
if [[ "$CLI_VITE_VAULT_VANITY_MAX_TRIES" != "__unset__" ]]; then
  export VITE_VAULT_VANITY_MAX_TRIES="$CLI_VITE_VAULT_VANITY_MAX_TRIES"
fi
if [[ "$CLI_VITE_SHARE_OFT_VANITY_SUFFIX" != "__unset__" ]]; then
  export VITE_SHARE_OFT_VANITY_SUFFIX="$CLI_VITE_SHARE_OFT_VANITY_SUFFIX"
fi
if [[ "$CLI_VITE_SHARE_OFT_VANITY_MAX_TRIES" != "__unset__" ]]; then
  export VITE_SHARE_OFT_VANITY_MAX_TRIES="$CLI_VITE_SHARE_OFT_VANITY_MAX_TRIES"
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

# Keep DB-backed routes enabled by default so waitlist/account/chat flows behave
# like production during local dry-run. Set DEPLOY_DRY_RUN_KEEP_DB_ENV=0 only
# when you explicitly want a DB-less dry-run boot.
export DEPLOY_DRY_RUN_KEEP_DB_ENV="${DEPLOY_DRY_RUN_KEEP_DB_ENV:-1}"
if [[ "${DEPLOY_DRY_RUN_KEEP_DB_ENV}" != "1" ]]; then
  # Isolate the dry-run from any real DB (Supabase or legacy Vercel Postgres).
  unset DATABASE_URL
  unset POSTGRES_URL
  unset POSTGRES_URL_NON_POOLING
else
  export POSTGRES_POOL_CONNECT_TIMEOUT_MS="${POSTGRES_POOL_CONNECT_TIMEOUT_MS:-3000}"
fi

: "${BASE_FORK_UPSTREAM_RPC_URL:?Set BASE_FORK_UPSTREAM_RPC_URL in $PRESET_FILE or your shell environment.}"

FORK_HOST="${DEPLOY_DRY_RUN_FORK_HOST:-127.0.0.1}"
FORK_PORT="${DEPLOY_DRY_RUN_FORK_PORT:-8545}"
FORK_CHAIN_ID="${DEPLOY_DRY_RUN_FORK_CHAIN_ID:-8453}"
ANVIL_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-anvil.log"
DEV_REDIRECT_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-redirect.log"
export VITE_ALLOW_CONTRACT_OVERRIDES="${VITE_ALLOW_CONTRACT_OVERRIDES:-0}"
export ALLOW_API_CONTRACT_OVERRIDES="${ALLOW_API_CONTRACT_OVERRIDES:-0}"
# WSL2: bind 0.0.0.0 so Windows browsers can reach the dev server via localhost
# forwarding. Override with VITE_DEV_SERVER_HOST=localhost to keep loopback-only.
if [[ -z "${VITE_DEV_SERVER_HOST-}" ]]; then
  if grep -qi microsoft /proc/version 2>/dev/null || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    export VITE_DEV_SERVER_HOST="true"
  else
    export VITE_DEV_SERVER_HOST="localhost"
  fi
fi
# Use a dedicated deterministic namespace on local forks so dry-runs do not
# collide with live Base deployments that share the repo's normal version tag.
export VITE_DEPLOYMENT_VERSION="${VITE_DEPLOYMENT_VERSION:-v1.14.0-dryrun}"
export VITE_DEPLOY_DRY_RUN_REQUEST_TIMEOUT_MS="${VITE_DEPLOY_DRY_RUN_REQUEST_TIMEOUT_MS:-300000}"
# Loopback Privy uses app-id auth at auth.privy.io (see resolvePrivyApiUrl in
# featureFlags.ts). Do NOT enable the Local Dev client id on loopback — that
# client is wired to privy.4626.fun and POST /api/v1/sessions 400s on localhost,
# leaving the bootstrap overlay stuck.
export VITE_PRIVY_CLIENT_ID_ENABLED="${VITE_PRIVY_CLIENT_ID_ENABLED:-1}"
export VITE_PRIVY_CLIENT_ID_ON_LOOPBACK="${VITE_PRIVY_CLIENT_ID_ON_LOOPBACK:-0}"

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
# Browser deploy reads use the fork; deploy-session API uses DEPLOY_DRY_RUN_LOCAL_RPC_URL.
# Keep BASE_RPC_URL on live upstream so owner-install / Relay preview never hits dead Anvil.
export DEPLOY_DRY_RUN_LOCAL_RPC_URL="$LOCAL_RPC_URL"
export VITE_BASE_RPC="$LOCAL_RPC_URL"
export BASE_READ_RPC_URL="$LOCAL_RPC_URL"
export BASE_LOGS_RPC_URL="$LOCAL_RPC_URL"
export BASE_RPC_URL="${BASE_FORK_UPSTREAM_RPC_URL:-https://mainnet.base.org}"
export ETH_RPC_URL="${ETH_RPC_URL:-https://ethereum-rpc.publicnode.com}"
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
if [[ "$USE_LOCAL_BATCHER" != "1" ]]; then
  MUTATE_CANONICAL_FORK="${DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK:-0}"
  if [[ "$MUTATE_CANONICAL_FORK" == "1" ]]; then
    echo "Ensuring fork batcher Phase1Module matches live store-aligned wiring..."
    (
      cd "$FRONTEND_DIR"
      DEPLOY_DRY_RUN_LOCAL_RPC_URL="$LOCAL_RPC_URL" \
        pnpm exec tsx "scripts/ops/ensure-fork-phase1-module-aligned.ts"
    ) || {
      echo "Failed to align fork Phase1Module. Restart deploy dry-run or rerun ensure-fork-phase1-module-aligned.ts." >&2
      exit 1
    }
    echo "Ensuring fork Phase3 helper matches local forge artifact..."
    (
      cd "$FRONTEND_DIR"
      DEPLOY_DRY_RUN_LOCAL_RPC_URL="$LOCAL_RPC_URL" \
        pnpm exec tsx "scripts/ops/ensure-fork-phase3-helper-aligned.ts"
    ) || {
      echo "Failed to align fork Phase3 helper. Run forge build at repo root, then retry." >&2
      exit 1
    }
  else
    echo "Canonical fork mode: leaving live batcher/module wiring unchanged (DEPLOY_DRY_RUN_MUTATE_CANONICAL_FORK=0)."
  fi
fi
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

# Dry-run shares a large Privy/wagmi graph. WSL boxes with <=8GB RAM may OOM-kill esbuild
# when optimizeDeps pre-bundling runs alongside another Vite dev server — opt in with
# VITE_LOW_MEMORY=1 (skips dep discovery; see vite.config.ts alwaysOptimizeInclude).
export VITE_LOW_MEMORY="${VITE_LOW_MEMORY:-0}"
# WSL often hits ENOSPC on inotify; polling avoids kernel watcher limits (see vite.config watch.ignored too).
export VITE_WATCH_POLLING="${VITE_WATCH_POLLING:-1}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

is_transient_vite_esbuild_failure() {
  local log_file="$1"
  grep -Eq \
    'The service was stopped|The service is no longer running|write EPIPE|Error during dependency optimization|JavaScript heap out of memory|FATAL ERROR: .*heap' \
    "$log_file"
}

DEV_PORT="${DEPLOY_DRY_RUN_PORT:-5174}"
ALLOW_DEV_PORT_FALLBACK="${DEPLOY_DRY_RUN_ALLOW_PORT_FALLBACK:-0}"
RECLAIM_DEV_PORT="${DEPLOY_DRY_RUN_RECLAIM_PORT:-1}"
ORIG_DEV_PORT="$DEV_PORT"
if port_in_use "$DEV_PORT"; then
  if [[ "$RECLAIM_DEV_PORT" == "1" ]] && reclaim_stale_vite_port "$DEV_PORT"; then
    :
  elif [[ "$ALLOW_DEV_PORT_FALLBACK" == "1" ]]; then
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

# WSL→Windows: pin client env to the LAN IP Vite prints under "Network:" so
# Privy/OAuth redirects match the URL Windows browsers actually open.
WSL_LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [[ -n "$WSL_LAN_IP" ]] && { [[ "${VITE_DEV_SERVER_HOST:-}" == "true" ]] || [[ "${VITE_DEV_SERVER_HOST:-}" == "1" ]]; }; then
  export VITE_APP_ORIGIN="http://${WSL_LAN_IP}:${DEV_PORT}"
  export VITE_MARKETING_ORIGIN="http://${WSL_LAN_IP}:${DEV_PORT}"
  export VITE_PRIVY_ALLOWED_ORIGINS="http://localhost:${DEV_PORT} http://127.0.0.1:${DEV_PORT} http://${WSL_LAN_IP}:${DEV_PORT}"
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

resolve_vite_host_arg() {
  local raw="${VITE_DEV_SERVER_HOST:-localhost}"
  local normalized
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    true | yes | 1) printf '%s\n' '0.0.0.0' ;;
    false | no | 0 | '') printf '%s\n' 'localhost' ;;
    *) printf '%s\n' "$raw" ;;
  esac
}

print_local_dev_access_hints() {
  local port="$1"
  local host_arg="$2"
  local wsl_ip
  wsl_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo ""
  if [[ -n "$wsl_ip" && "$host_arg" == "0.0.0.0" ]]; then
    echo "PRIMARY (WSL→Windows): http://${wsl_ip}:${port}/waitlist"
    echo "Also try:            http://localhost:${port}/waitlist"
    echo ""
    echo "Privy embedded wallet (deploy/swap signing) needs a secure browser context."
    echo "  • Prefer http://localhost:${port} with WSL mirrored networking, OR"
    echo "  • Use the WSL IP URL above for waitlist/email OTP (embedded wallet auto-disabled)."
  else
    echo "Open: http://localhost:${port}/waitlist"
  fi
  echo "Vite bind host: ${host_arg} (VITE_DEV_SERVER_HOST=${VITE_DEV_SERVER_HOST})"
  if grep -qi microsoft /proc/version 2>/dev/null || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
    echo "WSL: use the PRIMARY URL above if Windows localhost is blank or refused."
    echo "     Optional: [wsl2] networkingMode=mirrored in %UserProfile%\\.wslconfig, then wsl --shutdown."
  fi
  echo ""
}

VITE_HOST_ARG="$(resolve_vite_host_arg)"
print_local_dev_access_hints "$DEV_PORT" "$VITE_HOST_ARG"

echo "Starting frontend dev server on port ${DEV_PORT} (node $(node -v), VITE_LOW_MEMORY=${VITE_LOW_MEMORY}, VITE_WATCH_POLLING=${VITE_WATCH_POLLING}, DEPLOY_DRY_RUN_KEEP_DB_ENV=${DEPLOY_DRY_RUN_KEEP_DB_ENV}) with DEPLOY_DRY_RUN_LOCAL_RPC_URL=${DEPLOY_DRY_RUN_LOCAL_RPC_URL}, BASE_READ_RPC_URL=${BASE_READ_RPC_URL}, BASE_RPC_URL=${BASE_RPC_URL}, VITE_BASE_RPC=${VITE_BASE_RPC}"
if port_in_use 5173; then
  echo "Warning: localhost:5173 is in use — stop pnpm dev before deploy dry-run to avoid esbuild OOM on WSL." >&2
fi
cd "$FRONTEND_DIR"
VITE_BOOTSTRAP_LOG_FILE="${TMPDIR:-/tmp}/4626-deploy-dry-run-vite-bootstrap.log"
MAX_VITE_EPIPE_RETRIES="${DEPLOY_DRY_RUN_VITE_EPIPE_RETRIES:-3}"
vite_attempt=0

while true; do
  vite_attempt=$((vite_attempt + 1))
  : > "$VITE_BOOTSTRAP_LOG_FILE"

  set +e
  pnpm exec vite --host "$VITE_HOST_ARG" --port "$DEV_PORT" --strictPort 2>&1 | tee "$VITE_BOOTSTRAP_LOG_FILE"
  vite_exit_code=${PIPESTATUS[0]}
  set -e

  if [[ "$vite_exit_code" -eq 0 ]]; then
    exit 0
  fi

  if [[ "$vite_attempt" -gt "$MAX_VITE_EPIPE_RETRIES" ]]; then
    echo "Vite exited with code ${vite_exit_code} after ${MAX_VITE_EPIPE_RETRIES} retry attempts."
    if is_transient_vite_esbuild_failure "$VITE_BOOTSTRAP_LOG_FILE"; then
      echo "Recent esbuild failure (often memory pressure). Stop other Vite dev servers, then retry." >&2
    fi
    exit "$vite_exit_code"
  fi

  if is_transient_vite_esbuild_failure "$VITE_BOOTSTRAP_LOG_FILE"; then
    echo "Detected transient Vite/esbuild failure; clearing cache and retrying (attempt ${vite_attempt}/${MAX_VITE_EPIPE_RETRIES})..."
    rm -rf "$FRONTEND_DIR/node_modules/.vite"
    sleep 2
    continue
  fi

  exit "$vite_exit_code"
done
