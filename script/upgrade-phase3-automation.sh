#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${DEPLOYMENT_BATCHER:=0xA9024e1B89C5Be34502A275576Cc137473d65839}"
: "${PROTOCOL_AUTOMATION_SAFE:=0x08f0875E40781578F902998b2b831cc48d838eBE}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required" >&2
  exit 1
fi
if [[ -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: BASE_RPC_URL is required" >&2
  exit 1
fi

echo "Hot-swapping DeploymentBatcherPhase3Helper on batcher ${DEPLOYMENT_BATCHER}"
echo "Target protocol automation Safe: ${PROTOCOL_AUTOMATION_SAFE}"

forge script script/UpgradeDeploymentBatcherPhase3Automation.s.sol:UpgradeDeploymentBatcherPhase3Automation \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo "Phase3 automation helper upgrade broadcast complete."
