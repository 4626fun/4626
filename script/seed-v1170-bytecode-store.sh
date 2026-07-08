#!/usr/bin/env bash
set -euo pipefail

# Idempotent seed of UniversalBytecodeStoreV2 for the v1.17.0 bytecode epoch.
#
# Usage:
#   export UNIVERSAL_BYTECODE_STORE=<from HANDOFF after greenfield deploy>
#   export BASE_RPC_URL=<paid Base RPC>
#   export PRIVATE_KEY=<store owner signer>
#   ./script/seed-v1170-bytecode-store.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
if [[ -z "${UNIVERSAL_BYTECODE_STORE:-}" ]]; then
  echo "Error: UNIVERSAL_BYTECODE_STORE must be set (from greenfield HANDOFF — do not default to v1.16.1 store)" >&2
  exit 1
fi

MANIFEST="${ROOT_DIR}/deployments/base/v1.17.0-bytecode-manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest. Run: ./script/generate_bytecode_manifest.sh v1.17.0" >&2
  exit 1
fi

echo "Seeding UniversalBytecodeStoreV2 at ${UNIVERSAL_BYTECODE_STORE}"
echo "  Manifest: v1.17.0"
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
