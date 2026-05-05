#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Historical filename retained for operator scripts. This deploys the current
# CreatorOVault phased infra and bytecode store.
DEFAULT_RELEASE_TAG="v1.11.0"
DEFAULT_SHARED_GLOBAL_OUTPUT_PATH="${ROOT_DIR}/tmp/base-${DEFAULT_RELEASE_TAG}-shared-global.json"

load_env_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    return 0
  fi

  # Load only KEY=VALUE lines from env files (ignore shell syntax).
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
    key="${line%%=*}"
    value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:-1}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:-1}"
    fi
    export "$key=$value"
  done < "$path"
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Error: ${name} environment variable not set" >&2
    return 1
  fi
}

read_json_field() {
  local path="$1"
  local dotted_key="$2"

  python3 - "$path" "$dotted_key" <<'PY'
import json
import sys

path, dotted_key = sys.argv[1:3]
with open(path, "r", encoding="utf-8") as handle:
    value = json.load(handle)

for segment in dotted_key.split("."):
    if not segment:
        continue
    value = value[segment]

if isinstance(value, bool):
    print("true" if value else "false")
elif value is None:
    print("")
else:
    print(value)
PY
}

export_json_field() {
  local env_name="$1"
  local path="$2"
  local dotted_key="$3"
  local value

  value="$(read_json_field "$path" "$dotted_key")"
  if [ -n "$value" ]; then
    export "${env_name}=${value}"
  fi
}

load_handoff_env_file() {
  if [ -z "${BASE_RELEASE_HANDOFF_ENV_PATH:-}" ]; then
    return 0
  fi

  if [ ! -f "$BASE_RELEASE_HANDOFF_ENV_PATH" ]; then
    echo "No existing handoff env at ${BASE_RELEASE_HANDOFF_ENV_PATH}; starting fresh and creating it after deploy."
    mkdir -p "$(dirname "$BASE_RELEASE_HANDOFF_ENV_PATH")"
    return 0
  fi

  load_env_file "$BASE_RELEASE_HANDOFF_ENV_PATH"
}

load_shared_global_artifact() {
  : "${BASE_SHARED_GLOBAL_OUTPUT_PATH:=${DEFAULT_SHARED_GLOBAL_OUTPUT_PATH}}"

  if [ ! -f "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ]; then
    echo "No shared/global handoff artifact found at ${BASE_SHARED_GLOBAL_OUTPUT_PATH}; using existing env/defaults."
    return 0
  fi

  echo "Loading shared/global handoff artifact: ${BASE_SHARED_GLOBAL_OUTPUT_PATH}"

  export_json_field REGISTRY "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".creatorRegistry"
  export_json_field CREATOR_REGISTRY "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".creatorRegistry"
  export_json_field CREATOR_FACTORY "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".creatorVaultFactory"
  export_json_field LOTTERY_MANAGER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".creatorLotteryManager"
  export_json_field CREATOR_LOTTERY_MANAGER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".creatorLotteryManager"
  export_json_field VAULT_ACTIVATION_BATCHER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".vaultActivationBatcher"
  export_json_field SOLANA_BRIDGE_ADAPTER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".solanaBridgeAdapter"
}

configure_infra_salts() {
  if [ -z "${DEPLOYMENT_EPOCH_TAG:-}" ]; then
    export DEPLOYMENT_EPOCH_TAG="${DEFAULT_RELEASE_TAG}"
  fi

  : "${REGISTRY:=${CREATOR_REGISTRY:-}}"
  : "${LOTTERY_MANAGER:=${CREATOR_LOTTERY_MANAGER:-}}"
  export REGISTRY LOTTERY_MANAGER

  : "${INFRA_STORE_SALT_TAG:=base-release:UniversalBytecodeStore:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:=base-release:UniversalCreate2DeployerFromStore:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_CORE_MODULE_SALT_TAG:=base-release:CreatorOVaultCoreModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:=base-release:CreatorOVaultStrategiesModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:=base-release:CreatorOVaultAdminModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:=base-release:DeploymentBatcher:${DEPLOYMENT_EPOCH_TAG}}"
  export INFRA_STORE_SALT_TAG
  export INFRA_DEPLOYER_FROM_STORE_SALT_TAG
  export INFRA_VAULT_CORE_MODULE_SALT_TAG
  export INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG
  export INFRA_VAULT_ADMIN_MODULE_SALT_TAG
  export INFRA_DEPLOYMENT_BATCHER_SALT_TAG
}

apply_full_release_mode_overrides() {
  if [ "${BASE_FULL_RELEASE_MODE:-0}" != "1" ]; then
    return 0
  fi

  if [ "${CONFIGURE_SOLANA:-0}" != "0" ] || [ "${CONFIGURE_OVAULT_RUNTIME:-0}" != "0" ]; then
    echo "Full release mode: forcing CONFIGURE_SOLANA=0 and CONFIGURE_OVAULT_RUNTIME=0; treasury-only batcher config remains opt-in."
  else
    echo "Full release mode: treasury-only batcher config remains opt-in."
  fi

  export CONFIGURE_SOLANA=0
  export CONFIGURE_OVAULT_RUNTIME=0
}

append_handoff_from_log() {
  local log_path="$1"
  local saw_handoff=0

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      HANDOFF:*)
        saw_handoff=1
        printf '%s\n' "${line#HANDOFF:}" >> "$BASE_RELEASE_HANDOFF_ENV_PATH"
        ;;
    esac
  done < "$log_path"

  [ "$saw_handoff" -eq 1 ]
}

recover_v2_handoff_from_deployer_log_fallback() {
  local log_path="$1"
  local store_addr=""
  local create2_deployer_addr=""
  local deployment_batcher_addr=""

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      "UniversalBytecodeStoreV2 (predicted): "*)
        store_addr="${line#UniversalBytecodeStoreV2 (predicted): }"
        ;;
      "UniversalCreate2DeployerFromStoreV2 (predicted): "*)
        create2_deployer_addr="${line#UniversalCreate2DeployerFromStoreV2 (predicted): }"
        ;;
      "DeploymentBatcher: "*)
        deployment_batcher_addr="${line#DeploymentBatcher: }"
        ;;
      "DeploymentBatcher (predicted): "*)
        if [ -z "$deployment_batcher_addr" ]; then
          deployment_batcher_addr="${line#DeploymentBatcher (predicted): }"
        fi
        ;;
    esac
  done < "$log_path"

  if [ -z "$store_addr" ] || [ -z "$create2_deployer_addr" ] || [ -z "$deployment_batcher_addr" ]; then
    return 1
  fi

  {
    printf 'UNIVERSAL_BYTECODE_STORE=%s\n' "$store_addr"
    printf 'UNIVERSAL_CREATE2_DEPLOYER=%s\n' "$create2_deployer_addr"
    printf 'UNIVERSAL_CREATE2_FROM_STORE=%s\n' "$create2_deployer_addr"
    printf 'DEPLOYMENT_BATCHER=%s\n' "$deployment_batcher_addr"
    printf 'CREATOR_VAULT_BATCHER=%s\n' "$deployment_batcher_addr"
    printf 'CREATOR_VAULT_BATCHER_AUTO_HANDOFF=%s\n' "$deployment_batcher_addr"
  } >> "$BASE_RELEASE_HANDOFF_ENV_PATH"

  echo "Recovered current phased-infra handoff values from deployer log fallback."
}

is_known_deployment_batcher_verify_mismatch() {
  local log_path="$1"
  local saw_onchain_success=0
  local saw_deployment_batcher_verify=0
  local saw_phase2_module_verify=0
  local saw_mismatch=0
  local saw_partial_verify_failure=0

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      *"ONCHAIN EXECUTION COMPLETE & SUCCESSFUL."*)
        saw_onchain_success=1
        ;;
      *"Submitting verification for [contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcher]"*)
        saw_deployment_batcher_verify=1
        ;;
      *"Submitting verification for [contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcherPhase2Module]"*)
        saw_phase2_module_verify=1
        ;;
      *"Compiled contract deployment bytecode does NOT match the transaction deployment bytecode."*)
        saw_mismatch=1
        ;;
      *"Error: Not all ("*" contracts were verified!"*)
        saw_partial_verify_failure=1
        ;;
    esac
  done < "$log_path"

  [ "$saw_onchain_success" -eq 1 ] &&
    { [ "$saw_deployment_batcher_verify" -eq 1 ] || [ "$saw_phase2_module_verify" -eq 1 ]; } &&
    [ "$saw_mismatch" -eq 1 ] &&
    [ "$saw_partial_verify_failure" -eq 1 ]
}

print_infra_configuration() {
  echo "Infra salt configuration:"
  echo "  DEPLOYMENT_EPOCH_TAG=${DEPLOYMENT_EPOCH_TAG:-[not set]}"
  echo "  BASE_RELEASE_HANDOFF_ENV_PATH=${BASE_RELEASE_HANDOFF_ENV_PATH:-[not set]}"
  echo "  BASE_SHARED_GLOBAL_OUTPUT_PATH=${BASE_SHARED_GLOBAL_OUTPUT_PATH:-[not set]}"
  echo "  BASE_FULL_RELEASE_MODE=${BASE_FULL_RELEASE_MODE:-0}"
  echo "  CONFIGURE_SOLANA=${CONFIGURE_SOLANA:-0}"
  echo "  CONFIGURE_OVAULT_RUNTIME=${CONFIGURE_OVAULT_RUNTIME:-0}"
  echo "  RUN_TREASURY_SOLANA_CONFIG=${RUN_TREASURY_SOLANA_CONFIG:-0}"
  echo "  REGISTRY=${REGISTRY:-[DeployBaseMainnetDeployer default]}"
  echo "  LOTTERY_MANAGER=${LOTTERY_MANAGER:-[DeployBaseMainnetDeployer default]}"
  echo "  VAULT_ACTIVATION_BATCHER=${VAULT_ACTIVATION_BATCHER:-[DeployBaseMainnetDeployer default]}"
  echo "  SOLANA_BRIDGE_ADAPTER=${SOLANA_BRIDGE_ADAPTER:-[optional]}"
  echo "  UNIVERSAL_BYTECODE_STORE=${UNIVERSAL_BYTECODE_STORE:-[set by deployer handoff or existing env]}"
  echo "  INFRA_STORE_SALT=${INFRA_STORE_SALT:-[auto by tag/default]}"
  echo "  INFRA_STORE_SALT_TAG=${INFRA_STORE_SALT_TAG:-base-release:UniversalBytecodeStore:${DEFAULT_RELEASE_TAG} (default)}"
  echo "  INFRA_DEPLOYER_FROM_STORE_SALT=${INFRA_DEPLOYER_FROM_STORE_SALT:-[auto by tag/default]}"
  echo "  INFRA_DEPLOYER_FROM_STORE_SALT_TAG=${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:-base-release:UniversalCreate2DeployerFromStore:${DEFAULT_RELEASE_TAG} (default)}"
  echo "  INFRA_VAULT_CORE_MODULE_SALT=${INFRA_VAULT_CORE_MODULE_SALT:-[auto by tag/default]}"
  echo "  INFRA_VAULT_CORE_MODULE_SALT_TAG=${INFRA_VAULT_CORE_MODULE_SALT_TAG:-base-release:CreatorOVaultCoreModule:${DEFAULT_RELEASE_TAG} (default)}"
  echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT=${INFRA_VAULT_STRATEGIES_MODULE_SALT:-[auto by tag/default]}"
  echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:-base-release:CreatorOVaultStrategiesModule:${DEFAULT_RELEASE_TAG} (default)}"
  echo "  INFRA_VAULT_ADMIN_MODULE_SALT=${INFRA_VAULT_ADMIN_MODULE_SALT:-[auto by tag/default]}"
  echo "  INFRA_VAULT_ADMIN_MODULE_SALT_TAG=${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:-base-release:CreatorOVaultAdminModule:${DEFAULT_RELEASE_TAG} (default)}"
  echo "  INFRA_DEPLOYMENT_BATCHER_SALT=${INFRA_DEPLOYMENT_BATCHER_SALT:-[auto by tag/default]}"
  echo "  INFRA_DEPLOYMENT_BATCHER_SALT_TAG=${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:-base-release:DeploymentBatcher:${DEFAULT_RELEASE_TAG} (default)}"
}

main() {
  load_env_file ".env"
  load_handoff_env_file

  if ! command -v forge >/dev/null 2>&1; then
    echo "Error: Foundry (forge) not installed. Install from https://getfoundry.sh" >&2
    exit 1
  fi

  require_env PRIVATE_KEY || exit 1
  require_env BASE_RPC_URL || exit 1

  load_shared_global_artifact
  configure_infra_salts
  apply_full_release_mode_overrides

  if [ -z "${ETHERSCAN_API_KEY:-}" ] && [ -n "${BASESCAN_API_KEY:-}" ]; then
    export ETHERSCAN_API_KEY="$BASESCAN_API_KEY"
  fi

  if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
    echo "Warning: ETHERSCAN_API_KEY (or BASESCAN_API_KEY) not set; --verify may fail."
  fi

  : "${BASE_RELEASE_HANDOFF_ENV_PATH:=${ROOT_DIR}/tmp/base-${DEFAULT_RELEASE_TAG}-handoff.env}"
  mkdir -p "$(dirname "$BASE_RELEASE_HANDOFF_ENV_PATH")"

  print_infra_configuration

  echo "Deploying current bytecode store + phased deployer on Base mainnet..."
  deployer_log="$(mktemp "${TMPDIR:-/tmp}/4626-deployer-v2-XXXXXX.log")"
  set +e
  forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
    --rpc-url "$BASE_RPC_URL" \
    --broadcast \
    --verify | tee "$deployer_log"
  deployer_status=${PIPESTATUS[0]}
  set -e

  if [ "$deployer_status" -ne 0 ]; then
    if is_known_deployment_batcher_verify_mismatch "$deployer_log"; then
      echo "Continuing despite known DeploymentBatcher verification mismatch after successful onchain deployment."
      echo "Forensic verification: scripts/ops/verify-deployment-batcher-forensic.sh --tx <deployment-tx> --batcher <deployment-batcher-address>"
    else
      exit "$deployer_status"
    fi
  fi

  if ! append_handoff_from_log "$deployer_log"; then
    if ! recover_v2_handoff_from_deployer_log_fallback "$deployer_log"; then
      echo "Error: no HANDOFF lines or recoverable fallback values found in ${deployer_log}" >&2
      exit 1
    fi
  fi
  load_env_file "$BASE_RELEASE_HANDOFF_ENV_PATH"

  if [ "${RUN_TREASURY_SOLANA_CONFIG:-0}" = "1" ]; then
    require_env SOLANA_BRIDGE_ADAPTER || exit 1
    require_env SOLANA_DESTINATION || exit 1
    echo "Configuring deployment batcher (DeploymentBatcher) Solana routing..."
    forge script script/ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana \
      --rpc-url "$BASE_RPC_URL" \
      --broadcast
  else
    echo "Skipping treasury-only Solana batcher config (set RUN_TREASURY_SOLANA_CONFIG=1 with protocolTreasury signer to enable)."
  fi

  echo "Seeding current bytecode store (idempotent)..."
  forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
    --rpc-url "$BASE_RPC_URL" \
    --broadcast

  echo "Done."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
