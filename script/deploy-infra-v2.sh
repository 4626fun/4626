#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
  # Load only KEY=VALUE lines from .env (ignore shell syntax).
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
  done < ".env"
fi

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Error: ${name} environment variable not set"
    exit 1
  fi
}

if ! command -v forge >/dev/null 2>&1; then
  echo "Error: Foundry (forge) not installed. Install from https://getfoundry.sh"
  exit 1
fi

require_env PRIVATE_KEY
require_env BASE_RPC_URL

if [ -z "${DEPLOYMENT_EPOCH_TAG:-}" ]; then
  export DEPLOYMENT_EPOCH_TAG="v1.8.1"
fi

if [ -n "${DEPLOYMENT_EPOCH_TAG:-}" ]; then
  # Convenience mode: derive all infra salt tags from one epoch token.
  : "${INFRA_STORE_SALT_TAG:=4626:UniversalBytecodeStore:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:=4626:UniversalCreate2DeployerFromStore:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_CORE_MODULE_SALT_TAG:=4626:CreatorOVaultCoreModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:=4626:CreatorOVaultStrategiesModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:=4626:CreatorOVaultAdminModule:${DEPLOYMENT_EPOCH_TAG}}"
  : "${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:=4626:DeploymentBatcher:${DEPLOYMENT_EPOCH_TAG}}"
  export INFRA_STORE_SALT_TAG
  export INFRA_DEPLOYER_FROM_STORE_SALT_TAG
  export INFRA_VAULT_CORE_MODULE_SALT_TAG
  export INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG
  export INFRA_VAULT_ADMIN_MODULE_SALT_TAG
  export INFRA_DEPLOYMENT_BATCHER_SALT_TAG
fi

: "${INFRA_VANITY_MANIFEST_PATH:=${ROOT_DIR}/deployments/base/${DEPLOYMENT_EPOCH_TAG}-vanity-manifest.json}"
export INFRA_VANITY_MANIFEST_PATH

if [ ! -f "${INFRA_VANITY_MANIFEST_PATH}" ]; then
  echo "Generating vanity manifest at ${INFRA_VANITY_MANIFEST_PATH}..."
  cargo run --manifest-path "${ROOT_DIR}/tools/vanity-salt-grinder/Cargo.toml" -- \
    --epoch-tag "${DEPLOYMENT_EPOCH_TAG}" \
    --out "deployments/base/${DEPLOYMENT_EPOCH_TAG}-vanity-manifest.json"
fi

if [ -z "${ETHERSCAN_API_KEY:-}" ] && [ -n "${BASESCAN_API_KEY:-}" ]; then
  export ETHERSCAN_API_KEY="$BASESCAN_API_KEY"
fi

if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "Warning: ETHERSCAN_API_KEY (or BASESCAN_API_KEY) not set; --verify may fail."
fi

echo "Infra salt configuration:"
echo "  DEPLOYMENT_EPOCH_TAG=${DEPLOYMENT_EPOCH_TAG:-[not set]}"
echo "  INFRA_VANITY_MANIFEST_PATH=${INFRA_VANITY_MANIFEST_PATH}"
echo "  INFRA_STORE_SALT=${INFRA_STORE_SALT:-[auto by tag/default]}"
echo "  INFRA_STORE_SALT_TAG=${INFRA_STORE_SALT_TAG:-4626:UniversalBytecodeStore:v1.8.1 (default)}"
echo "  INFRA_DEPLOYER_FROM_STORE_SALT=${INFRA_DEPLOYER_FROM_STORE_SALT:-[auto by tag/default]}"
echo "  INFRA_DEPLOYER_FROM_STORE_SALT_TAG=${INFRA_DEPLOYER_FROM_STORE_SALT_TAG:-4626:UniversalCreate2DeployerFromStore:v1.8.1 (default)}"
echo "  INFRA_VAULT_CORE_MODULE_SALT=${INFRA_VAULT_CORE_MODULE_SALT:-[auto by tag/default]}"
echo "  INFRA_VAULT_CORE_MODULE_SALT_TAG=${INFRA_VAULT_CORE_MODULE_SALT_TAG:-4626:CreatorOVaultCoreModule:v1.8.1 (default)}"
echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT=${INFRA_VAULT_STRATEGIES_MODULE_SALT:-[auto by tag/default]}"
echo "  INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=${INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG:-4626:CreatorOVaultStrategiesModule:v1.8.1 (default)}"
echo "  INFRA_VAULT_ADMIN_MODULE_SALT=${INFRA_VAULT_ADMIN_MODULE_SALT:-[auto by tag/default]}"
echo "  INFRA_VAULT_ADMIN_MODULE_SALT_TAG=${INFRA_VAULT_ADMIN_MODULE_SALT_TAG:-4626:CreatorOVaultAdminModule:v1.8.1 (default)}"
echo "  INFRA_DEPLOYMENT_BATCHER_SALT=${INFRA_DEPLOYMENT_BATCHER_SALT:-[auto by tag/default]}"
echo "  INFRA_DEPLOYMENT_BATCHER_SALT_TAG=${INFRA_DEPLOYMENT_BATCHER_SALT_TAG:-4626:DeploymentBatcher:v1.8.1 (default)}"

echo "Deploying v2 bytecode store + deployer on Base mainnet..."
forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify

if [ -n "${SOLANA_BRIDGE_ADAPTER:-}" ] && [ -n "${SOLANA_DESTINATION:-}" ]; then
  echo "Configuring deployment batcher (DeploymentBatcher) Solana routing..."
  forge script script/ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana \
    --rpc-url "$BASE_RPC_URL" \
    --broadcast
else
  echo "Skipping Solana config (set SOLANA_BRIDGE_ADAPTER and SOLANA_DESTINATION to enable)."
fi

echo "Seeding v2 bytecode store (idempotent)..."
forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo "Done."
