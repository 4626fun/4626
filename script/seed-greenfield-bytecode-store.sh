#!/usr/bin/env bash
set -euo pipefail

# Idempotent seed of UniversalBytecodeStoreV2 for a greenfield bytecode epoch.
#
# Usage:
#   export DEPLOYMENT_EPOCH_TAG=v1.18.0
#   export UNIVERSAL_BYTECODE_STORE=<from HANDOFF after greenfield deploy>
#   export BASE_RPC_URL=<paid Base RPC>
#   export PRIVATE_KEY=<store owner signer>
#   ./script/seed-greenfield-bytecode-store.sh
#
# Or:
#   ./script/seed-greenfield-bytecode-store.sh v1.18.0

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EPOCH="${1:-${DEPLOYMENT_EPOCH_TAG:-}}"
if [[ -z "$EPOCH" ]]; then
  echo "Error: set DEPLOYMENT_EPOCH_TAG or pass epoch as first argument" >&2
  exit 1
fi

: "${SEED_OFFSET:=0}"
: "${SEED_LIMIT:=0}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required" >&2
  exit 1
fi
if [[ -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: BASE_RPC_URL is required" >&2
  exit 1
fi

HANDOFF="${ROOT_DIR}/tmp/base-${EPOCH}-handoff.env"
if [[ -z "${UNIVERSAL_BYTECODE_STORE:-}" && -f "$HANDOFF" ]]; then
  unset UNIVERSAL_BYTECODE_STORE UNIVERSAL_CREATE2_DEPLOYER UNIVERSAL_CREATE2_FROM_STORE \
    DEPLOYMENT_BATCHER DEPLOYMENT_BATCHER_AUTO_HANDOFF \
    2>/dev/null || true
  # shellcheck disable=SC1090
  set -a && source "$HANDOFF" && set +a
fi

if [[ -z "${UNIVERSAL_BYTECODE_STORE:-}" ]]; then
  echo "Error: UNIVERSAL_BYTECODE_STORE must be set (from greenfield HANDOFF — do not default to live store)" >&2
  exit 1
fi

MANIFEST="${ROOT_DIR}/deployments/base/${EPOCH}-bytecode-manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest. Run: ./script/generate_bytecode_manifest.sh ${EPOCH}" >&2
  exit 1
fi

echo "Seeding UniversalBytecodeStoreV2 at ${UNIVERSAL_BYTECODE_STORE}"
echo "  Epoch: ${EPOCH}"
echo "  Manifest: ${MANIFEST}"
echo "  SEED_OFFSET=${SEED_OFFSET} SEED_LIMIT=${SEED_LIMIT}"

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo ""
echo "Post-seed verification:"
BYTECODE_MANIFEST="$MANIFEST" \
  UNIVERSAL_BYTECODE_STORE="$UNIVERSAL_BYTECODE_STORE" \
  BASE_RPC_URL="$BASE_RPC_URL" \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
