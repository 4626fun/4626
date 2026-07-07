#!/usr/bin/env bash
set -euo pipefail

# v1.16.1 production cutover: bytecode store seed + share-mesh helper hot-swap + verification.
#
# Usage:
#   set -a && source .env && set +a
#   ./script/run-v1161-production-cutover.sh
#
# Optional:
#   SKIP_SEED=1 SKIP_SHELL_UPGRADE=1 SKIP_SHARE_MESH_UPGRADE=1 ./script/run-v1161-production-cutover.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${PRIVATE_KEY:-}" || -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: PRIVATE_KEY and BASE_RPC_URL must be set (source .env)" >&2
  exit 1
fi

echo "==> forge build"
forge build --skip test --skip script

echo "==> regenerate manifest + frontend bytecode"
./script/generate_bytecode_manifest.sh v1.16.1
./script/generate_frontend_deploy_bytecode.sh

if [[ "${SKIP_SEED:-0}" != "1" ]]; then
  echo "==> seed UniversalBytecodeStore (v1.16.1)"
  ./script/seed-v1161-bytecode-store.sh
else
  echo "==> SKIP_SEED=1 — skipping bytecode store seed"
  BYTECODE_MANIFEST="$ROOT_DIR/deployments/base/v1.16.1-bytecode-manifest.json" \
    UNIVERSAL_BYTECODE_STORE="${UNIVERSAL_BYTECODE_STORE:-0x7D1029a832E2BEd2C961bC912b623b763862Ad3C}" \
    BASE_RPC_URL="$BASE_RPC_URL" \
    pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
fi

if [[ "${SKIP_SHELL_UPGRADE:-0}" != "1" ]]; then
  echo "==> deploy new DeploymentBatcher shell with share-mesh support"
  ./script/upgrade-batcher-shell-share-mesh.sh
else
  echo "==> SKIP_SHELL_UPGRADE=1 — skipping batcher shell upgrade"
fi

if [[ "${SKIP_SHARE_MESH_UPGRADE:-0}" != "1" && "${SKIP_SHELL_UPGRADE:-0}" == "1" ]]; then
  echo "==> hot-swap DeploymentBatcherShareMeshHelper (legacy path; requires shell with shareMeshHelper())"
  ./script/upgrade-share-mesh-helper.sh
elif [[ "${SKIP_SHARE_MESH_UPGRADE:-0}" == "1" ]]; then
  echo "==> SKIP_SHARE_MESH_UPGRADE=1 — skipping helper hot-swap"
else
  echo "==> shell upgrade includes share-mesh helper wiring — skipping legacy helper hot-swap"
fi

echo "==> forge tests (share mesh + CCALaunchArm)"
forge test --match-contract "CCALaunchArm|ShareMesh|OVaultLPManager"

echo "==> keeper sweep vitest"
pnpm -C frontend exec vitest run api/__tests__/keeperSweep.test.ts

echo "v1.16.1 cutover complete."
