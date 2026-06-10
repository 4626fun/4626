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

artifact_path() {
  local contract="$1"
  case "$contract" in
    DeploymentBatcher|DeploymentBatcherPhase1Module|DeploymentBatcherPhase2Module|DeploymentBatcherPhase3Helper|DeploymentBatcherUniV4Helper|DeploymentBatcherUtilsHelper)
      printf "%s/out/DeploymentBatcher.sol/%s.json" "$ROOT_DIR" "$contract"
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
  python3 - "$artifact" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as fh:
    obj = fh.read().strip()
# forge may emit concatenated JSON objects; keep the bytecode record only.
decoder = json.JSONDecoder()
bytecode_obj = None
idx = 0
while idx < len(obj):
    value, end = decoder.raw_decode(obj, idx)
    if isinstance(value, dict) and "bytecode" in value:
        bytecode_obj = value["bytecode"]
    idx = end
if bytecode_obj is None or not bytecode_obj.get("object"):
    raise SystemExit(f"bytecode.object missing in {path}")
bc = bytecode_obj["object"]
if bc.startswith("0x"):
    bc = bc[2:]
import re
m = re.match(r"^([0-9a-fA-F]+)", bc)
if not m:
    raise SystemExit(f"no hex bytecode in {path}")
bc = m.group(1).lower()
print(bc, end="")
PY
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
