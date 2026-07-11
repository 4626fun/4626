#!/usr/bin/env bash
set -euo pipefail

# Generates deployments/base/<release>-bytecode-manifest.json from Foundry artifacts.
#
# Usage:
#   ./script/generate_bytecode_manifest.sh v1.13.0

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
  "Registry4626"
  "OVaultFactory4626"
  # Pricing lib must be CREATE2-deployed (Foundry salt 0 @ EIP-2470) before LM;
  # LM creation bytecode in this manifest is linked to that library address.
  "LotteryManager4626PricingLib"
  "LotteryManager4626"
  "VRFConsumer4626"
  "VaultActivationBatcher"
  "SolanaBridgeAdapter"
  "UniversalBytecodeStoreV2"
  "UniversalCreate2DeployerFromStore"
  "CreatorOVaultCoreModule"
  "AgentOVaultCoreModule"
  "OVaultStrategiesModule"
  "OVaultAdminModule"
  "CreatorOVault"
  "AgentOVault"
  "CreatorOVaultWrapper"
  "AgentOVaultWrapper"
  "CreatorShareOFT"
  "AgentShareOFT"
  "OFTBootstrapRegistry"
  "CreatorGaugeController"
  "AgentGaugeController"
  "CCALaunchArm"
  "CreatorOracle"
  "AgentOracle"
  "CreatorPayoutRouter"
  "AgentRevenueRouter"
  "VaultShareBurnStream"
  "CreatorCoinPolicyController"
  "CharmStrategy4626"
  "AjnaVaultAuth"
  "AjnaERC4626Vault"
  "ERC4626StrategyAdapter"
  "DeploymentBatcher"
  "DeploymentBatcherPhase1Module"
  "DeploymentBatcherPhase2Module"
  "DeploymentBatcherPhase3Helper"
  "DeploymentBatcherShareMeshHelper"
  "ApprovedV4HooksRegistry"
  "OVaultLPManager"
  "DeploymentBatcherUtilsHelper"
)

artifact_path() {
  local contract="$1"
  case "$contract" in
    DeploymentBatcher|DeploymentBatcherPhase1Module|DeploymentBatcherPhase2Module|DeploymentBatcherPhase3Helper|DeploymentBatcherShareMeshHelper|DeploymentBatcherUtilsHelper)
      printf "%s/out/DeploymentBatcher.sol/%s.json" "$ROOT_DIR" "$contract"
      ;;
    LotteryManager4626|LotteryManager4626AdminModule|LotteryManager4626PricingLib)
      # LM + Admin share LotteryManager4626.sol; PricingLib is its own file.
      if [[ "$contract" == "LotteryManager4626PricingLib" ]]; then
        printf "%s/out/LotteryManager4626PricingLib.sol/%s.json" "$ROOT_DIR" "$contract"
      else
        printf "%s/out/LotteryManager4626.sol/%s.json" "$ROOT_DIR" "$contract"
      fi
      ;;
    *)
      printf "%s/out/%s.sol/%s.json" "$ROOT_DIR" "$contract" "$contract"
      ;;
  esac
}

bytecode() {
  local contract="$1"
  local artifact
  artifact="$(artifact_path "$contract")"
  if [[ ! -f "$artifact" ]]; then
    echo "Missing artifact: $artifact (run forge build --skip test --skip script first)" >&2
    exit 1
  fi
  # Fully link external libraries (Foundry CREATE2 salt 0 @ EIP-2470).
  # Do NOT truncate at `__$...$__` placeholders — that yields broken initcode.
  python3 "$ROOT_DIR/script/lib/extract_linked_bytecode.py" "$artifact" "$ROOT_DIR"
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
