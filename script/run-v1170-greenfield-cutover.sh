#!/usr/bin/env bash
set -euo pipefail

# v1.17.0 full greenfield cutover orchestrator.
#
# Usage:
#   set -a && source .env && set +a
#   export DEPLOYMENT_EPOCH_TAG=v1.17.0
#   export PROTOCOL_AUTOMATION_SAFE=0x08f0875E40781578F902998b2b831cc48d838eBE
#   ./script/run-v1170-greenfield-cutover.sh
#
# Optional:
#   SKIP_BROADCAST=1          — build + manifest only (no on-chain txs)
#   SKIP_AMOE=1               — skip post-deploy AMOE router deploy hint
#   BASE_FULL_RELEASE_SKIP_VANITY=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${DEPLOYMENT_EPOCH_TAG:=v1.17.0}"
: "${SHELL_UPGRADE_EPOCH_TAG:=v1.17.0-greenfield}"
: "${PROTOCOL_TREASURY:=0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3}"
: "${PROTOCOL_AUTOMATION_SAFE:=0x08f0875E40781578F902998b2b831cc48d838eBE}"

if [[ -z "${PRIVATE_KEY:-}" || -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: PRIVATE_KEY and BASE_RPC_URL must be set" >&2
  exit 1
fi

HANDOFF_ENV="${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-handoff.env"
mkdir -p "${ROOT_DIR}/tmp"

echo "==> v1.17.0 greenfield cutover (epoch ${DEPLOYMENT_EPOCH_TAG})"
echo "    Handoff env: ${HANDOFF_ENV}"
echo "    Release packet: docs/_internal/deployment-releases-legacy/v1.17.0-greenfield.md"
echo ""

echo "==> forge build"
forge build --skip test --skip script

if [[ "${SKIP_BROADCAST:-0}" != "1" ]]; then
  echo "==> full greenfield broadcast (DeployInfrastructure + deploy-infra-v2)"
  export BASE_RELEASE_HANDOFF_ENV_PATH="$HANDOFF_ENV"
  export BASE_SHARED_GLOBAL_OUTPUT_PATH="${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-shared-global.json"
  DEPLOYMENT_EPOCH_TAG="$DEPLOYMENT_EPOCH_TAG" \
    PROTOCOL_TREASURY="$PROTOCOL_TREASURY" \
    PROTOCOL_AUTOMATION_SAFE="$PROTOCOL_AUTOMATION_SAFE" \
    SHELL_UPGRADE_EPOCH_TAG="$SHELL_UPGRADE_EPOCH_TAG" \
    ./script/deploy-base-full-release.sh | tee "${ROOT_DIR}/tmp/base-${DEPLOYMENT_EPOCH_TAG}-broadcast.log"
else
  echo "==> SKIP_BROADCAST=1 — skipping on-chain deploy"
fi

echo "==> generate bytecode manifest + frontend deploy bytes"
./script/generate_bytecode_manifest.sh "$DEPLOYMENT_EPOCH_TAG"
./script/generate_frontend_deploy_bytecode.sh

if [[ "${SKIP_BROADCAST:-0}" != "1" && -f "$HANDOFF_ENV" ]]; then
  echo "==> seed bytecode store"
  # shellcheck disable=SC1090
  set -a && source "$HANDOFF_ENV" && set +a
  ./script/seed-v1170-bytecode-store.sh
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
  ./script/post-v1170-doc-handoff.sh "$HANDOFF_ENV"
else
  echo "No handoff env at ${HANDOFF_ENV} — run post-v1170-doc-handoff.sh after broadcast"
fi

echo ""
echo "v1.17.0 greenfield orchestration complete."
