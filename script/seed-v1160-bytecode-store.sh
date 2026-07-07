#!/usr/bin/env bash
set -euo pipefail

# Idempotent re-seed of UniversalBytecodeStoreV2 for the v1.16.0 bytecode epoch.
#
# Prerequisites:
#   - forge build --skip test --skip script
#   - ./script/generate_bytecode_manifest.sh v1.16.0
#   - Protocol treasury / store owner signer funded on Base
#
# Usage:
#   export BASE_RPC_URL=<paid Base RPC>
#   export PRIVATE_KEY=<store owner signer>
#   ./script/seed-v1160-bytecode-store.sh
#
# Batched seeding (gas / RPC limits):
#   SEED_OFFSET=0 SEED_LIMIT=10 ./script/seed-v1160-bytecode-store.sh
#   SEED_OFFSET=10 SEED_LIMIT=10 ./script/seed-v1160-bytecode-store.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${UNIVERSAL_BYTECODE_STORE:=0x7D1029a832E2BEd2C961bC912b623b763862Ad3C}"
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

if [[ ! -f "$ROOT_DIR/deployments/base/v1.16.0-bytecode-manifest.json" ]]; then
  echo "Missing manifest. Run: ./script/generate_bytecode_manifest.sh v1.16.0" >&2
  exit 1
fi

echo "Seeding UniversalBytecodeStoreV2 at ${UNIVERSAL_BYTECODE_STORE}"
echo "  SEED_OFFSET=${SEED_OFFSET} SEED_LIMIT=${SEED_LIMIT}"

forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo ""
echo "Post-seed verification:"
BYTECODE_MANIFEST="$ROOT_DIR/deployments/base/v1.16.0-bytecode-manifest.json" \
  UNIVERSAL_BYTECODE_STORE="$UNIVERSAL_BYTECODE_STORE" \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
