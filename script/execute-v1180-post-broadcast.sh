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

HANDOFF="${BASE_RELEASE_HANDOFF_ENV_PATH:-}"
if [[ -z "$HANDOFF" ]]; then
  if [[ -f "${ROOT_DIR}/tmp/base-v1.20.0-handoff.env" ]]; then
    HANDOFF="${ROOT_DIR}/tmp/base-v1.20.0-handoff.env"
  elif [[ -f "${ROOT_DIR}/tmp/base-v1.19.1-handoff.env" ]]; then
    HANDOFF="${ROOT_DIR}/tmp/base-v1.19.1-handoff.env"
  elif [[ -f "${ROOT_DIR}/tmp/base-v1.18.0-handoff.env" ]]; then
    HANDOFF="${ROOT_DIR}/tmp/base-v1.18.0-handoff.env"
  fi
fi
if [[ -n "$HANDOFF" && -f "$HANDOFF" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$HANDOFF"
  set +a
fi

# Force live v1.20.0 product pins after handoff source so a leftover
# tmp/base-v1.19.1-handoff.env (or v1.18.0) cannot re-point CREATE2/auth.
REGISTRY="0xF60a1490C4129f2b6ae540734D3C2C8C6111824e"
BATCHER="0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032"
export DEPLOYMENT_BATCHER="$BATCHER"
export DEPLOYMENT_BATCHER_PHASE1_MODULE="0x416FA15e40caA51C20d1795db946c6806C946aC5"
export DEPLOYMENT_BATCHER_PHASE2_MODULE="0xf1334BE96B3530BBF17506DED98E50D917A45B41"
export UNIVERSAL_CREATE2_DEPLOYER="0xdffB25505F5050E15B3602296330Ef352127d1Ef"
export OVAULT_FACTORY="0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5"
export DEPLOYMENT_BATCHER_PHASE3_HELPER="0x3Ed642288cd03846e9dA956cF95812d3125dD274"
export DEPLOYMENT_BATCHER_SHARE_MESH_HELPER="0x1BCd4768180671Aa435C845239e05Afc81a496cA"
LOTTERY_MANAGER="0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b"
AMOE_PUBLISHER="${AMOE_PUBLISHER:-0x793ca28123cba3ca3c20b9c6c67f37510c89c145}"
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
