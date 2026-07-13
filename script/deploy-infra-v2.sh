#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Historical filename retained for operator scripts. This deploys the current
# CreatorOVault phased infra and bytecode store.
DEFAULT_RELEASE_TAG="v1.13.0"
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
    # Explicit shell exports (e.g. DEPLOYMENT_EPOCH_TAG=v1.17.0) must win over .env defaults.
    if [[ -n "${!key:-}" ]]; then
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

  export_json_field REGISTRY "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".registry"
  export_json_field OVAULT_FACTORY "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".ovaultFactory"
  export_json_field LOTTERY_MANAGER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".lotteryManager"
  export_json_field VRF_CONSUMER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".vrfConsumer"
  export_json_field VAULT_ACTIVATION_BATCHER "${BASE_SHARED_GLOBAL_OUTPUT_PATH}" ".vaultActivationBatcher"
}

configure_infra_salts() {
  if [ -z "${DEPLOYMENT_EPOCH_TAG:-}" ]; then
    export DEPLOYMENT_EPOCH_TAG="${DEFAULT_RELEASE_TAG}"
  fi

  if [ -z "${REGISTRY:-}" ] || [ -z "${LOTTERY_MANAGER:-}" ]; then
    echo "Error: REGISTRY and LOTTERY_MANAGER must be set (shared/global artifact or handoff env)" >&2
    exit 1
  fi
  export REGISTRY LOTTERY_MANAGER

  : "${INFRA_STORE_SALT_TAG:=base-release:UniversalBytecodeStore:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:=base-release:UniversalCreate2DeployerFromStore:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_CORE_MODULE_SALT_TAG:=base-release:CreatorOVaultCoreModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:=base-release:OVaultStrategiesModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:=base-release:OVaultAdminModule:${DEPLOYMENT_EPOCH_TAG}}"
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
  local phase1_module_addr=""
  local phase2_module_addr=""
  local phase3_helper_addr=""
  local share_mesh_helper_addr=""
  local utils_helper_addr=""
  local core_module_addr=""
  local strategies_module_addr=""
  local admin_module_addr=""

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
      "DeploymentBatcherPhase1Module (predicted): "*)
        phase1_module_addr="${line#DeploymentBatcherPhase1Module (predicted): }"
        ;;
      "DeploymentBatcherPhase2Module (predicted): "*)
        phase2_module_addr="${line#DeploymentBatcherPhase2Module (predicted): }"
        ;;
      "DeploymentBatcherPhase3Helper (predicted): "*)
        phase3_helper_addr="${line#DeploymentBatcherPhase3Helper (predicted): }"
        ;;
      "DeploymentBatcherShareMeshHelper (predicted): "*)
        share_mesh_helper_addr="${line#DeploymentBatcherShareMeshHelper (predicted): }"
        ;;
      "DeploymentBatcherUtilsHelper (predicted): "*)
        utils_helper_addr="${line#DeploymentBatcherUtilsHelper (predicted): }"
        ;;
      "CreatorOVaultCoreModule (predicted): "*)
        core_module_addr="${line#CreatorOVaultCoreModule (predicted): }"
        ;;
      "OVaultStrategiesModule (predicted): "*)
        strategies_module_addr="${line#OVaultStrategiesModule (predicted): }"
        ;;
      "OVaultAdminModule (predicted): "*)
        admin_module_addr="${line#OVaultAdminModule (predicted): }"
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
    printf 'DEPLOYMENT_BATCHER_AUTO_HANDOFF=%s\n' "$deployment_batcher_addr"
    printf 'WIRE_BATCHER_HELPERS_BATCHER=%s\n' "$deployment_batcher_addr"
    if [ -n "$phase1_module_addr" ]; then
      printf 'DEPLOYMENT_BATCHER_PHASE1_MODULE=%s\n' "$phase1_module_addr"
    fi
    if [ -n "$phase2_module_addr" ]; then
      printf 'DEPLOYMENT_BATCHER_PHASE2_MODULE=%s\n' "$phase2_module_addr"
    fi
    if [ -n "$phase3_helper_addr" ]; then
      printf 'DEPLOYMENT_BATCHER_PHASE3_HELPER=%s\n' "$phase3_helper_addr"
    fi
    if [ -n "$share_mesh_helper_addr" ]; then
      printf 'DEPLOYMENT_BATCHER_SHARE_MESH_HELPER=%s\n' "$share_mesh_helper_addr"
    fi
    if [ -n "$utils_helper_addr" ]; then
      printf 'DEPLOYMENT_BATCHER_UTILS_HELPER=%s\n' "$utils_helper_addr"
    fi
    if [ -n "$core_module_addr" ]; then
      printf 'OVAULT_CORE_MODULE=%s\n' "$core_module_addr"
    fi
    if [ -n "$strategies_module_addr" ]; then
      printf 'OVAULT_STRATEGIES_MODULE=%s\n' "$strategies_module_addr"
    fi
    if [ -n "$admin_module_addr" ]; then
      printf 'OVAULT_ADMIN_MODULE=%s\n' "$admin_module_addr"
    fi
  } >> "$BASE_RELEASE_HANDOFF_ENV_PATH"

  echo "Recovered phased-infra handoff values from deployer log fallback."
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
      *"Submitting verification for [contracts/shared/deploy/batchers/DeploymentBatcher.sol:DeploymentBatcher]"*)
        saw_deployment_batcher_verify=1
        ;;
      *"Submitting verification for [contracts/shared/deploy/batchers/DeploymentBatcher.sol:DeploymentBatcherPhase2Module]"*)
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
  echo "  UNIVERSAL_BYTECODE_STORE=${UNIVERSAL_BYTECODE_STORE:-[set by deployer handoff or existing env]}"
  echo "  INFRA_STORE_SALT=${INFRA_STORE_SALT:-[auto by tag/default]}"
  echo "  INFRA_STORE_SALT_TAG=${INFRA_STORE_SALT_TAG:-[not set]}"
  echo "  INFRA_DEPLOYER_FROM_STORE_SALT=${INFRA_DEPLOYER_FROM_STORE_SALT:-[auto by tag/default]}"
  echo "  INFRA_DEPLOYER_FROM_STORE_SALT_TAG=${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:-[not set]}"
  echo "  INFRA_VAULT_CORE_MODULE_SALT=${INFRA_VAULT_CORE_MODULE_SALT:-[auto by tag/default]}"
  echo "  INFRA_VAULT_CORE_MODULE_SALT_TAG=${INFRA_VAULT_CORE_MODULE_SALT_TAG:-[not set]}"
  echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT=${INFRA_VAULT_STRATEGIES_MODULE_SALT:-[auto by tag/default]}"
  echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:-[not set]}"
  echo "  INFRA_VAULT_ADMIN_MODULE_SALT=${INFRA_VAULT_ADMIN_MODULE_SALT:-[auto by tag/default]}"
  echo "  INFRA_VAULT_ADMIN_MODULE_SALT_TAG=${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:-[not set]}"
  echo "  INFRA_DEPLOYMENT_BATCHER_SALT=${INFRA_DEPLOYMENT_BATCHER_SALT:-[auto by tag/default]}"
  echo "  INFRA_DEPLOYMENT_BATCHER_SALT_TAG=${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:-[not set]}"
}

main() {
  load_env_file ".env"
  if [ "${BASE_FULL_RELEASE_MODE:-0}" = "1" ]; then
    unset UNIVERSAL_BYTECODE_STORE UNIVERSAL_CREATE2_DEPLOYER UNIVERSAL_CREATE2_FROM_STORE \
      DEPLOYMENT_BATCHER DEPLOYMENT_BATCHER_AUTO_HANDOFF \
      REGISTRY REGISTRY_4626 OVAULT_FACTORY LOTTERY_MANAGER VRF_CONSUMER \
      VAULT_ACTIVATION_BATCHER \
      2>/dev/null || true
  fi
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
    require_env SOLANA_DESTINATION || exit 1
    echo "Configuring deployment batcher (DeploymentBatcher) Solana routing..."
    forge script script/ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana \
      --rpc-url "$BASE_RPC_URL" \
      --broadcast
  else
    echo "Skipping treasury-only Solana batcher config (set RUN_TREASURY_SOLANA_CONFIG=1 with protocolTreasury signer to enable)."
  fi

  handoff_store="$(grep -E '^UNIVERSAL_BYTECODE_STORE=' "$BASE_RELEASE_HANDOFF_ENV_PATH" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  if [ -z "$handoff_store" ]; then
    echo "Error: HANDOFF missing UNIVERSAL_BYTECODE_STORE before bytecode store seed" >&2
    exit 1
  fi
  export UNIVERSAL_BYTECODE_STORE="$handoff_store"

  echo "Seeding bytecode store at ${UNIVERSAL_BYTECODE_STORE} (from HANDOFF)..."
  forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
    --rpc-url "$BASE_RPC_URL" \
    --broadcast

  echo "Done."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
