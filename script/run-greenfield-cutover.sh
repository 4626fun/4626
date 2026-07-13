#!/usr/bin/env bash
set -euo pipefail

# Full greenfield cutover orchestrator (epoch-parameterized).
#
# Usage:
#   export DEPLOYMENT_EPOCH_TAG=v1.18.0
#   export PROTOCOL_AUTOMATION_SAFE=0x08f0875E40781578F902998b2b831cc48d838eBE
#   ./script/run-greenfield-cutover.sh
#
# Or:
#   ./script/run-greenfield-cutover.sh v1.18.0
#
# Optional:
#   SKIP_BROADCAST=1          — build + manifest only (no on-chain txs)
#   SKIP_AMOE=1               — skip post-deploy AMOE router deploy hint
#   BASE_FULL_RELEASE_SKIP_VANITY=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EPOCH="${1:-${DEPLOYMENT_EPOCH_TAG:-}}"
if [[ -z "$EPOCH" ]]; then
  echo "Error: set DEPLOYMENT_EPOCH_TAG or pass epoch as first argument (e.g. v1.18.0)" >&2
  exit 1
fi

export DEPLOYMENT_EPOCH_TAG="$EPOCH"
export SHELL_UPGRADE_EPOCH_TAG="${SHELL_UPGRADE_EPOCH_TAG:-${EPOCH}-greenfield}"
export PROTOCOL_TREASURY="${PROTOCOL_TREASURY:-0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3}"
export PROTOCOL_AUTOMATION_SAFE="${PROTOCOL_AUTOMATION_SAFE:-0x08f0875E40781578F902998b2b831cc48d838eBE}"

if [[ -z "${PRIVATE_KEY:-}" || -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: PRIVATE_KEY and BASE_RPC_URL must be set" >&2
  exit 1
fi

HANDOFF_ENV="${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-handoff.env"
RELEASE_DOC="${ROOT_DIR}/docs/_internal/deployment-releases-legacy/${DEPLOYMENT_EPOCH_TAG}-greenfield.md"
mkdir -p "${ROOT_DIR}/tmp"

echo "==> ${DEPLOYMENT_EPOCH_TAG} greenfield cutover"
echo "    Handoff env: ${HANDOFF_ENV}"
echo "    Release packet: ${RELEASE_DOC}"
echo ""

echo "==> preflight"
./script/preflight-greenfield-deploy.sh

echo "==> forge build"
forge build --skip test --skip script

if [[ "${SKIP_BROADCAST:-0}" != "1" ]]; then
  echo "==> full greenfield broadcast (DeployInfrastructure + deploy-infra-v2)"
  unset UNIVERSAL_BYTECODE_STORE UNIVERSAL_CREATE2_DEPLOYER UNIVERSAL_CREATE2_FROM_STORE \
    DEPLOYMENT_BATCHER DEPLOYMENT_BATCHER_AUTO_HANDOFF \
    REGISTRY REGISTRY_4626 OVAULT_FACTORY LOTTERY_MANAGER VRF_CONSUMER \
    VAULT_ACTIVATION_BATCHER SOLANA_BRIDGE_ADAPTER SOLANA_DESTINATION \
    OVAULT_HUB_COMPOSER OVAULT_SOLANA_EID \
    2>/dev/null || true
  export BASE_RELEASE_HANDOFF_ENV_PATH="$HANDOFF_ENV"
  export BASE_SHARED_GLOBAL_OUTPUT_PATH="${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-shared-global.json"
  set +e
  DEPLOYMENT_EPOCH_TAG="$DEPLOYMENT_EPOCH_TAG" \
    PROTOCOL_TREASURY="$PROTOCOL_TREASURY" \
    PROTOCOL_AUTOMATION_SAFE="$PROTOCOL_AUTOMATION_SAFE" \
    SHELL_UPGRADE_EPOCH_TAG="$SHELL_UPGRADE_EPOCH_TAG" \
    ./script/deploy-base-full-release.sh | tee "${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-broadcast.log"
  deploy_status=${PIPESTATUS[0]}
  set -e
  if [[ "$deploy_status" -ne 0 ]]; then
    echo "Error: deploy-base-full-release failed with exit ${deploy_status}" >&2
    exit "$deploy_status"
  fi
  ./script/sync-greenfield-env-from-handoff.sh "$HANDOFF_ENV"
  ./script/validate-greenfield-handoff.sh "$HANDOFF_ENV"
else
  echo "==> SKIP_BROADCAST=1 — skipping on-chain deploy"
fi

echo "==> generate bytecode manifest + frontend deploy bytes"
./script/generate_bytecode_manifest.sh "$DEPLOYMENT_EPOCH_TAG"
./script/generate_frontend_deploy_bytecode.sh

if [[ "${SKIP_BROADCAST:-0}" != "1" && -f "$HANDOFF_ENV" ]]; then
  echo "==> seed bytecode store (verified against manifest)"
  DEPLOYMENT_EPOCH_TAG="$DEPLOYMENT_EPOCH_TAG" ./script/seed-greenfield-bytecode-store.sh
fi

echo "==> forge tests (share mesh + CCA)"
forge test --match-contract "CCALaunchArm|ShareMesh|OVaultLPManager"

echo "==> keeper sweep vitest"
pnpm -C frontend exec vitest run api/__tests__/keeperSweep.test.ts

if [[ "${SKIP_AMOE:-0}" != "1" && "${SKIP_BROADCAST:-0}" != "1" ]]; then
  echo ""
  echo "==> AMOE: deploy fresh LotteryAmoeRouter + wire (manual — see release packet Phase 3)"
  echo "    export AMOE_CONSUMER=<HANDOFF:LOTTERY_MANAGER>"
  echo "    forge script script/DeployLotteryAmoeRouter.s.sol:DeployLotteryAmoeRouter --rpc-url \$BASE_RPC_URL --broadcast"
  echo "    export AMOE_ROUTER=<new router> AMOE_MANAGER=<HANDOFF:LOTTERY_MANAGER>"
  echo "    ./script/wire-amoe-router-v1161.sh"
fi

echo ""
echo "==> post-cutover doc handoff"
if [[ -f "$HANDOFF_ENV" ]]; then
  ./script/post-greenfield-doc-handoff.sh "$HANDOFF_ENV"
else
  echo "No handoff env at ${HANDOFF_ENV} — run post-greenfield-doc-handoff.sh after broadcast"
fi

echo ""
echo "${DEPLOYMENT_EPOCH_TAG} greenfield orchestration complete."
