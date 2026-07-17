#!/usr/bin/env bash
# v1.19.1 Phase1Module hot-swap: wire AgentOVaultCoreModule as agentVaultCoreModule.
#
# Usage:
#   ./script/upgrade-v1191-phase1-agent-core.sh rehearse   # fork test
#   ./script/upgrade-v1191-phase1-agent-core.sh deploy     # broadcast CREATE (SET_PHASE1_MODULE=0)
#   ./script/upgrade-v1191-phase1-agent-core.sh safe <phase1>  # Safe approve+set
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BATCHER="${DEPLOYMENT_BATCHER:-0xa18169caf37fa0347285B16aAFC2B09eCB43F145}"
AGENT_CORE="${AGENT_VAULT_CORE_MODULE:-0xE9350e3AD91cCD00cb5C9c03C0CBE7271694E5f2}"
RPC="${BASE_RPC_URL:-}"
if [[ -z "$RPC" && -f frontend/.env ]]; then
  RPC="$(grep -E '^BASE_RPC_URL=' frontend/.env | head -1 | cut -d= -f2-)"
fi
[[ -n "$RPC" ]] || { echo "BASE_RPC_URL required"; exit 1; }

cmd="${1:-}"
case "$cmd" in
  rehearse)
    echo "==> Fork rehearse Phase1 agent-core hot-swap"
    RUN_FORK_TESTS=1 BASE_RPC_URL="$RPC" \
      forge test --match-path 'test/fork/DeploymentBatcherPhase1AgentCoreHotSwap.fork.t.sol' -vv
    ;;
  deploy)
    [[ -n "${PRIVATE_KEY:-}" ]] || { echo "PRIVATE_KEY required"; exit 1; }
    echo "==> Deploy new Phase1Module (agent core=$AGENT_CORE) against batcher $BATCHER"
    DEPLOYMENT_BATCHER="$BATCHER" \
    AGENT_VAULT_CORE_MODULE="$AGENT_CORE" \
    SET_PHASE1_MODULE="${SET_PHASE1_MODULE:-0}" \
      forge script script/UpgradeDeploymentBatcherPhase1AgentCore.s.sol:UpgradeDeploymentBatcherPhase1AgentCore \
        --rpc-url "$RPC" --broadcast -vvv
    ;;
  safe)
    phase1="${2:-}"
    [[ -n "$phase1" ]] || { echo "usage: $0 safe <phase1Module>"; exit 1; }
    echo "==> Safe approve+setPhase1Module($phase1) on $BATCHER"
    pnpm -C frontend exec tsx scripts/ops/execute-set-phase1-module-safe.ts \
      --phase1-module "$phase1" \
      --batcher "$BATCHER"
    echo "==> Verify"
    cast call "$BATCHER" 'phase1Module()(address)' --rpc-url "$RPC"
    NEW_P1="$(cast call "$BATCHER" 'phase1Module()(address)' --rpc-url "$RPC")"
    cast call "$NEW_P1" 'agentVaultCoreModule()(address)' --rpc-url "$RPC"
    ;;
  *)
    echo "usage: $0 {rehearse|deploy|safe <phase1>}"
    exit 1
    ;;
esac
