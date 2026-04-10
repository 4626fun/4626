#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

load_env_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
    fi
    if [[ "$line" != *=* ]]; then
      continue
    fi
    export "$line"
  done < "$path"
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Error: ${name} environment variable not set" >&2
    exit 1
  fi
}

append_handoff_from_log() {
  local log_path="$1"
  local saw_handoff=0

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      HANDOFF:*)
        saw_handoff=1
        printf '%s\n' "${line#HANDOFF:}" >> "$HANDOFF_ENV_PATH"
        ;;
    esac
  done < "$log_path"

  if [ "$saw_handoff" -ne 1 ]; then
    echo "Error: no HANDOFF lines found in ${log_path}" >&2
    exit 1
  fi
}

load_env_file ".env"

if ! command -v forge >/dev/null 2>&1; then
  echo "Error: Foundry (forge) not installed. Install from https://getfoundry.sh" >&2
  exit 1
fi

require_env PRIVATE_KEY
require_env BASE_RPC_URL

if [ -z "${ETHERSCAN_API_KEY:-}" ] && [ -n "${BASESCAN_API_KEY:-}" ]; then
  export ETHERSCAN_API_KEY="$BASESCAN_API_KEY"
fi

if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "Warning: ETHERSCAN_API_KEY (or BASESCAN_API_KEY) not set; --verify may fail."
fi

: "${DEPLOYMENT_EPOCH_TAG:=v1.8.2}"
: "${BASE_SHARED_GLOBAL_OUTPUT_PATH:=${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-shared-global.json}"
HANDOFF_ENV_PATH="${BASE_RELEASE_HANDOFF_ENV_PATH:-$(mktemp "${TMPDIR:-/tmp}/4626-base-full-release-${DEPLOYMENT_EPOCH_TAG}-XXXXXX.env")}"
LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/4626-base-full-release-logs-XXXXXX")"
export DEPLOYMENT_EPOCH_TAG BASE_SHARED_GLOBAL_OUTPUT_PATH HANDOFF_ENV_PATH

mkdir -p "$(dirname "$BASE_SHARED_GLOBAL_OUTPUT_PATH")" "$(dirname "$HANDOFF_ENV_PATH")"

cat > "$HANDOFF_ENV_PATH" <<EOF
DEPLOYMENT_EPOCH_TAG=${DEPLOYMENT_EPOCH_TAG}
BASE_SHARED_GLOBAL_OUTPUT_PATH=${BASE_SHARED_GLOBAL_OUTPUT_PATH}
EOF

echo "Starting Base ${DEPLOYMENT_EPOCH_TAG} full release rollout..."
echo "Shared/global artifact: ${BASE_SHARED_GLOBAL_OUTPUT_PATH}"
echo "Handoff env: ${HANDOFF_ENV_PATH}"
echo "Logs dir: ${LOG_DIR}"
echo ""

infra_log="${LOG_DIR}/deploy-infrastructure.log"
echo "1/2 Deploying fresh shared/global contracts..."
BASE_SHARED_GLOBAL_OUTPUT_PATH="$BASE_SHARED_GLOBAL_OUTPUT_PATH" \
forge script script/DeployInfrastructure.s.sol:DeployInfrastructure \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify \
  -vvvv | tee "$infra_log"
append_handoff_from_log "$infra_log"
load_env_file "$HANDOFF_ENV_PATH"

echo ""
echo "2/2 Deploying deterministic v2 infra with explicit shared/global inputs..."
BASE_FULL_RELEASE_MODE=1 \
BASE_RELEASE_HANDOFF_ENV_PATH="$HANDOFF_ENV_PATH" \
BASE_SHARED_GLOBAL_OUTPUT_PATH="$BASE_SHARED_GLOBAL_OUTPUT_PATH" \
bash "$ROOT_DIR/script/deploy-infra-v2.sh"

echo ""
echo "Base ${DEPLOYMENT_EPOCH_TAG} full release orchestration complete."
echo "Shared/global artifact retained at: ${BASE_SHARED_GLOBAL_OUTPUT_PATH}"
echo "Handoff env retained at: ${HANDOFF_ENV_PATH}"
