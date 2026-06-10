#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

workflows=(
  keepr-action-queue
  vault-keeper
  cca-finalization
  payout-integrity
  ajna-bucket-manager
  charm-rebalance-manager
  strategy-signal-listener
)

for workflow in "${workflows[@]}"; do
  echo "[kpr-sim] running $workflow via local KPR runner"
  pnpm -C "$repo_root/kpr" run start "$workflow"
done

echo "[kpr-sim] solana-orchestrator is service-style; run separately when needed:"
echo "[kpr-sim]   pnpm -C \"$repo_root/kpr\" run start:solana-orchestrator"
