#!/usr/bin/env bash
set -euo pipefail

# Generates deployments/base/<release>-bytecode-manifest.json from Foundry artifacts.
#
# Usage:
#   ./script/generate_bytecode_manifest.sh v1.11.1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_TAG="${1:-}"

if [[ -z "${RELEASE_TAG}" ]]; then
  echo "Usage: ./script/generate_bytecode_manifest.sh <release-tag>"
  exit 1
fi

OUT_FILE="$ROOT_DIR/deployments/base/${RELEASE_TAG}-bytecode-manifest.json"

cd "$ROOT_DIR"

echo "Generating bytecode manifest → deployments/base/${RELEASE_TAG}-bytecode-manifest.json"

# Keep artifacts up to date, but ignore test/script compilation drift.
forge build --skip test --skip script >/dev/null

contracts=(
  "CreatorRegistry"
  "CreatorOVaultFactory"
  "CreatorLotteryManager"
  "CreatorVRFConsumerV2_5"
  "VaultActivationBatcher"
  "SolanaBridgeAdapter"
  "UniversalBytecodeStoreV2"
  "UniversalCreate2DeployerFromStore"
  "CreatorOVaultCoreModule"
  "CreatorOVaultStrategiesModule"
  "CreatorOVaultAdminModule"
  "CreatorOVault"
  "CreatorOVaultWrapper"
  "CreatorShareOFT"
  "OFTBootstrapRegistry"
  "CreatorGaugeController"
  "CCALaunchStrategy"
  "CreatorOracle"
  "PayoutRouter"
  "VaultShareBurnStream"
  "CreatorCoinPolicyController"
  "CreatorCharmStrategy"
  "AjnaVaultAuth"
  "AjnaERC4626Vault"
  "ERC4626StrategyAdapter"
  "SolanaStrategy"
  "DeploymentBatcher"
  "DeploymentBatcherPhase2Module"
  "DeploymentBatcherPhase3Helper"
  "DeploymentBatcherUniV4Helper"
  "DeploymentBatcherUtilsHelper"
)

bytecode() {
  local contract="$1"
  local bc
  bc="$(forge inspect "$contract" bytecode | tail -n 1)"
  bc="${bc#0x}"
  printf "%s" "$bc"
}

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  printf "%s" "$s"
}

{
  echo "{"
  echo "  \"release\": \"$(json_escape "$RELEASE_TAG")\","
  echo "  \"generatedAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
  echo "  \"chain\": \"base\","
  echo "  \"chainId\": 8453,"
  echo "  \"contracts\": {"

  for i in "${!contracts[@]}"; do
    name="${contracts[$i]}"
    bc="$(bytecode "$name")"
    hash="$(cast keccak "0x${bc}")"
    bytes=$(( ${#bc} / 2 ))
    comma=","
    if [[ "$i" -eq $((${#contracts[@]} - 1)) ]]; then
      comma=""
    fi

    echo "    \"$(json_escape "$name")\": {"
    echo "      \"creationBytecodeHash\": \"${hash}\","
    echo "      \"codeId\": \"${hash}\","
    echo "      \"creationBytecodeBytes\": ${bytes}"
    echo "    }${comma}"
  done

  echo "  }"
  echo "}"
} >"$OUT_FILE"

echo "Done."
