#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflows_root="$repo_root/cre/cre-workflows"

if ! command -v cre >/dev/null 2>&1; then
  echo "[cre-sim] cre CLI is required in PATH" >&2
  exit 1
fi

target="${CRE_SIMULATION_TARGET:-local-simulation}"
trigger_index="${CRE_TRIGGER_INDEX:-0}"
engine_logs="${CRE_ENGINE_LOGS:-false}"

simulate_args=(--target "$target" --non-interactive --trigger-index "$trigger_index")
if [[ "$engine_logs" == "1" || "$engine_logs" == "true" ]]; then
  simulate_args+=(--engine-logs)
fi

workflows=(
  keepr-queue
  vault-keeper
  auction-settlement
  payout-integrity
  ajna-bucket-manager
  charm-rebalance-manager
  strategy-event-listener
  solana-orchestrator
)

pushd "$workflows_root" >/dev/null
for workflow in "${workflows[@]}"; do
  if [[ ! -f "$workflow/workflow.yaml" ]]; then
    echo "[cre-sim] skipping $workflow (workflow.yaml missing)"
    continue
  fi
  echo "[cre-sim] simulating $workflow (target=$target trigger_index=$trigger_index)"
  cre workflow simulate "$workflow" "${simulate_args[@]}"
done
popd >/dev/null
