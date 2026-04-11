#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CREATE2_FACTORY_ADDR="0x4e59b44847b379578588920cA78FbF26c0B4956C"
DEFAULT_RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
CONTRACT_FQN="contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcher"
ARTIFACT_PATH="$ROOT_DIR/out/DeploymentBatcher.sol/DeploymentBatcher.json"

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/verify-deployment-batcher-forensic.sh --tx <tx-hash> --batcher <address> [--rpc-url <url>]

What it proves:
  1. the live tx target is the universal CREATE2 factory
  2. tx input after the 32-byte CREATE2 salt prefix matches local initcode + constructor args
  3. onchain runtime only differs from the local deployed bytecode at immutable-reference slots

Example:
  scripts/ops/verify-deployment-batcher-forensic.sh \
    --tx 0xc1a1f6f9a5e57cfef6cbeb1b339a56b765f0cbbe81aaace9c77cd0d32cc18f0b \
    --batcher 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

TX_HASH=""
BATCHER_ADDRESS=""
RPC_URL="$DEFAULT_RPC_URL"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tx)
      TX_HASH="${2:-}"
      shift 2
      ;;
    --batcher)
      BATCHER_ADDRESS="${2:-}"
      shift 2
      ;;
    --rpc-url)
      RPC_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$TX_HASH" || -z "$BATCHER_ADDRESS" ]]; then
  usage
  exit 1
fi

require_cmd cast
require_cmd forge
require_cmd python3

if [[ ! -f "$ARTIFACT_PATH" ]]; then
  echo "Missing artifact: $ARTIFACT_PATH" >&2
  echo "Run `forge build` first." >&2
  exit 1
fi

address_getters=(
  registry
  bytecodeStore
  create2Deployer
  protocolTreasury
  poolManager
  taxHook
  chainlinkEthUsd
  vaultActivationBatcher
  lotteryManager
  permit2
  usdc
  uniswapV3Factory
  uniswapRouter
  ajnaFactory
  vaultCoreModule
  vaultStrategiesModule
  vaultAdminModule
)

ctor_args=()
for getter in "${address_getters[@]}"; do
  ctor_args+=("$(cast call "$BATCHER_ADDRESS" "${getter}()(address)" --rpc-url "$RPC_URL")")
done

phase3_helper="$(cast call "$BATCHER_ADDRESS" "phase3Helper()(address)" --rpc-url "$RPC_URL")"
univ4_helper="$(cast call "$BATCHER_ADDRESS" "uniV4Helper()(address)" --rpc-url "$RPC_URL")"

tx_to="$(cast tx "$TX_HASH" to --rpc-url "$RPC_URL")"
tx_input="$(cast tx "$TX_HASH" input --rpc-url "$RPC_URL")"
local_initcode="$(forge inspect "$CONTRACT_FQN" bytecode)"
local_runtime="$(forge inspect "$CONTRACT_FQN" deployedBytecode)"
encoded_ctor="$(
  cast abi-encode \
    "constructor(address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address,address)" \
    "${ctor_args[@]}"
)"
onchain_runtime="$(cast code "$BATCHER_ADDRESS" --rpc-url "$RPC_URL")"

python3 - "$ARTIFACT_PATH" "$CREATE2_FACTORY_ADDR" "$tx_to" "$tx_input" "$local_initcode" "$encoded_ctor" "$local_runtime" "$onchain_runtime" "$TX_HASH" "$BATCHER_ADDRESS" "$phase3_helper" "$univ4_helper" "${ctor_args[@]}" <<'PY'
import json
import sys

(
    artifact_path,
    expected_factory,
    tx_to,
    tx_input,
    local_initcode,
    encoded_ctor,
    local_runtime,
    onchain_runtime,
    tx_hash,
    batcher_address,
    phase3_helper,
    univ4_helper,
    *ctor_args,
) = sys.argv[1:]

labels = [
    "registry",
    "bytecodeStore",
    "create2Deployer",
    "protocolTreasury",
    "poolManager",
    "taxHook",
    "chainlinkEthUsd",
    "vaultActivationBatcher",
    "lotteryManager",
    "permit2",
    "usdc",
    "uniswapV3Factory",
    "uniswapRouter",
    "ajnaFactory",
    "vaultCoreModule",
    "vaultStrategiesModule",
    "vaultAdminModule",
]

def strip_0x(value: str) -> str:
    return value[2:] if value.startswith("0x") else value

def normalize(value: str) -> str:
    return strip_0x(value).lower()

def compress_ranges(indexes):
    if not indexes:
        return []
    ranges = []
    start = prev = indexes[0]
    for idx in indexes[1:]:
        if idx == prev + 1:
            prev = idx
            continue
        ranges.append([start, prev])
        start = prev = idx
    ranges.append([start, prev])
    return ranges

artifact = json.loads(open(artifact_path, "r", encoding="utf-8").read())
immutable_refs = artifact["deployedBytecode"]["immutableReferences"]

tx_to_norm = normalize(tx_to)
factory_norm = normalize(expected_factory)
if tx_to_norm != factory_norm:
    raise SystemExit(
        f"ERROR: tx target {tx_to} does not match expected CREATE2 factory {expected_factory}"
    )

tx_input_norm = normalize(tx_input)
if len(tx_input_norm) < 64:
    raise SystemExit("ERROR: tx input is too short to contain a CREATE2 salt prefix")

salt_prefix = tx_input_norm[:64]
tx_payload = tx_input_norm[64:]
local_payload = normalize(local_initcode) + normalize(encoded_ctor)

if tx_payload != local_payload:
    mismatch_at = next(
        (i for i, (a, b) in enumerate(zip(tx_payload, local_payload)) if a != b),
        None,
    )
    raise SystemExit(
        "ERROR: live tx payload does not match local initcode + constructor args"
        + (f" (first differing nibble: {mismatch_at})" if mismatch_at is not None else "")
    )

local_runtime_norm = normalize(local_runtime)
onchain_runtime_norm = normalize(onchain_runtime)
if len(local_runtime_norm) != len(onchain_runtime_norm):
    raise SystemExit(
        "ERROR: runtime bytecode length mismatch "
        f"(local={len(local_runtime_norm)//2} bytes, onchain={len(onchain_runtime_norm)//2} bytes)"
    )

immutable_positions = set()
for entries in immutable_refs.values():
    for entry in entries:
        immutable_positions.update(range(entry["start"], entry["start"] + entry["length"]))

mismatch_bytes = []
for offset in range(0, len(local_runtime_norm), 2):
    if local_runtime_norm[offset:offset + 2] != onchain_runtime_norm[offset:offset + 2]:
        mismatch_bytes.append(offset // 2)

outside_immutables = [idx for idx in mismatch_bytes if idx not in immutable_positions]
if outside_immutables:
    raise SystemExit(
        "ERROR: runtime bytecode differs outside immutable reference slots "
        f"(first differing byte: {outside_immutables[0]})"
    )

summary = {
    "txHash": tx_hash,
    "batcher": batcher_address,
    "create2Factory": expected_factory,
    "saltPrefix": "0x" + salt_prefix,
    "payloadBytes": len(tx_payload) // 2,
    "runtimeBytes": len(onchain_runtime_norm) // 2,
    "runtimeMismatchByteCount": len(mismatch_bytes),
    "runtimeMismatchRangeCount": len(compress_ranges(mismatch_bytes)),
    "phase3Helper": phase3_helper,
    "uniV4Helper": univ4_helper,
    "constructorArgs": dict(zip(labels, ctor_args)),
}

print("DeploymentBatcher forensic verification passed.")
print(f"- tx target matches universal CREATE2 factory: {expected_factory}")
print("- tx payload after the 32-byte salt prefix matches local initcode + constructor args")
print("- onchain runtime differs from local deployed bytecode only at immutable-reference slots")
print(f"- phase3 helper: {phase3_helper}")
print(f"- uniV4 helper: {univ4_helper}")
print("")
print(json.dumps(summary, indent=2))
PY
