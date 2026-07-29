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

OUT_FILE="${BYTECODE_MANIFEST_OUT:-$ROOT_DIR/deployments/base/${RELEASE_TAG}-bytecode-manifest.json}"
mkdir -p "$(dirname "$OUT_FILE")"

# shellcheck source=script/lib/resolve_foundry_artifact.sh
source "$ROOT_DIR/script/lib/resolve_foundry_artifact.sh"

cd "$ROOT_DIR"

echo "Generating bytecode manifest → ${OUT_FILE}"

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
  # Quote lib must be CREATE2-deployed (Foundry salt 0 @ EIP-2470) before
  # CreatorOracle; CreatorOracle creation bytecode is linked to that address.
  "CreatorOracleQuoteLib"
  "CreatorOracle"
  "AgentOracle"
  "CreatorPayoutRouter"
  "AgentRevenueRouter"
  "VaultShareBurnStream"
  "CreatorCoinPolicyController"
  "AgentRevenuePolicyController"
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
  local sol_dir
  case "$contract" in
    DeploymentBatcher|DeploymentBatcherPhase1Module|DeploymentBatcherPhase2Module|DeploymentBatcherPhase3Helper|DeploymentBatcherShareMeshHelper|DeploymentBatcherUtilsHelper)
      sol_dir="$ROOT_DIR/out/DeploymentBatcher.sol"
      ;;
    LotteryManager4626|LotteryManager4626AdminModule)
      # LM + Admin share LotteryManager4626.sol; PricingLib is its own file.
      sol_dir="$ROOT_DIR/out/LotteryManager4626.sol"
      ;;
    LotteryManager4626PricingLib)
      sol_dir="$ROOT_DIR/out/LotteryManager4626PricingLib.sol"
      ;;
    CreatorOracleQuoteLib)
      # Multi-solc emits CreatorOracleQuoteLib.<solc>.json; the shared resolver
      # prefers the bare artifact then newest via sort -V (lex sort ranks 0.8.9
      # above 0.8.34 and wrong CREATE2 links).
      sol_dir="$ROOT_DIR/out/CreatorOracleQuoteLib.sol"
      ;;
    *)
      sol_dir="$ROOT_DIR/out/${contract}.sol"
      ;;
  esac
  # Print resolved path even when missing (caller errors with the expected path).
  resolve_foundry_artifact "$sol_dir" "$contract" || true
}

bytecode() {
  local contract="$1"
  local artifact
  local hex
  artifact="$(artifact_path "$contract")"
  if [[ ! -f "$artifact" ]]; then
    echo "Missing artifact: $artifact (run forge build --skip test --skip script first)" >&2
    return 1
  fi
  # Fully link external libraries (Foundry CREATE2 salt 0 @ EIP-2470).
  # Do NOT truncate at `__$...$__` placeholders — that yields broken initcode.
  hex="$(python3 "$ROOT_DIR/script/lib/extract_linked_bytecode.py" "$artifact" "$ROOT_DIR")" || return 1
  if [[ -z "$hex" || ! "$hex" =~ ^[0-9a-fA-F]+$ ]]; then
    echo "Invalid/empty creation bytecode for ${contract} from ${artifact}" >&2
    return 1
  fi
  printf '%s' "$hex"
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
