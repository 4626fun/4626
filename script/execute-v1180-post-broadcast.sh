#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${PRIVATE_KEY:-}" || -z "${BASE_RPC_URL:-}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

HANDOFF="${ROOT_DIR}/tmp/base-v1.18.0-handoff.env"
if [[ -f "$HANDOFF" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$HANDOFF"
  set +a
fi

REGISTRY="${REGISTRY_4626:-${REGISTRY:-0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2}}"
BATCHER="${DEPLOYMENT_BATCHER:-0xa18169caf37fa0347285B16aAFC2B09eCB43F145}"
# Keep wiring helper on the live hot-swapped modules (not superseded handoff pins).
export DEPLOYMENT_BATCHER="$BATCHER"
export DEPLOYMENT_BATCHER_PHASE1_MODULE="${DEPLOYMENT_BATCHER_PHASE1_MODULE:-0x0d12951A5e35ce064D7Add3A57bE0CC8Ad39e08b}"
export DEPLOYMENT_BATCHER_PHASE2_MODULE="${DEPLOYMENT_BATCHER_PHASE2_MODULE:-0x3089678d53522Aa9cE56AF1a34cb32aDBCc690Ba}"
LOTTERY_MANAGER="${LOTTERY_MANAGER:-0xB45E68a5867935a5734E4185977F81c528006650}"
AMOE_PUBLISHER="${AMOE_PUBLISHER:-0xAb6d5C10b03300326CD7fAb7267Ae192842967b5}"
AMOE_OWNER="${AMOE_OWNER:-0xB05Cf01231cF2fF99499682E64D3780d57c80FdD}"

echo "==> [1/7] Safe wiring (wireDeploymentHelpers + setPhase1Module + solana/ovault config)"
pnpm -C frontend exec tsx scripts/ops/execute-v1180-greenfield-wiring.ts

echo "==> [2/7] Authorize batcher on CREATE2 deployer + OVault factory (admin EOA)"
./script/authorize-v1180-batcher-deployers.sh

echo "==> [3/7] Registry4626.setAuthorizedFactory(batcher, true)"
AUTHORIZED="$(cast call "$REGISTRY" "authorizedFactories(address)(bool)" "$BATCHER" --rpc-url "$BASE_RPC_URL")"
if [[ "$AUTHORIZED" == "true" ]]; then
  echo "    already authorized"
else
  cast send "$REGISTRY" "setAuthorizedFactory(address,bool)" "$BATCHER" true \
    --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash // .'
fi

echo "==> [4/7] Deploy fresh LotteryAmoeRouter (PLONK v3) — skip if AMOE_ROUTER already wired"
export AMOE_OWNER AMOE_PUBLISHER AMOE_CONSUMER="$LOTTERY_MANAGER"
forge script script/DeployLotteryAmoeRouter.s.sol:DeployLotteryAmoeRouter \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --json 2>&1 | tee "${ROOT_DIR}/tmp/base-v1.18.0-amoe-deploy.log"

AMOE_ROUTER="$(rg -o 'LotteryAmoeRouter:\s+0x[a-fA-F0-9]{40}' "${ROOT_DIR}/tmp/base-v1.18.0-amoe-deploy.log" | tail -1 | rg -o '0x[a-fA-F0-9]{40}')"
if [[ -z "$AMOE_ROUTER" ]]; then
  echo "Error: could not parse LotteryAmoeRouter address from deploy log" >&2
  exit 1
fi
echo "    AMOE_ROUTER=$AMOE_ROUTER"

echo "==> [5/7] Wire AMOE router to manager $LOTTERY_MANAGER"
export AMOE_ROUTER AMOE_MANAGER="$LOTTERY_MANAGER"
./script/wire-amoe-router-v1161.sh

echo "==> [6/7] Pipe A readiness check"
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts --shell-only

echo "==> [7/7] Vercel env + production redeploy"
"$ROOT_DIR/script/sync-v1180-vercel-env.sh" "$AMOE_ROUTER"

echo ""
echo "Post-broadcast cutover complete."
echo "AMOE_ROUTER=$AMOE_ROUTER"
echo "Next: confirm publish-cron republished roots on the new router (automatic after redeploy, or hit /api/v1/lottery/amoe/publish-cron with CRON_SECRET)."
