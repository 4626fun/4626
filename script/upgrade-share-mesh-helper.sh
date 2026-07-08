#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${DEPLOYMENT_BATCHER:=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required" >&2
  exit 1
fi
if [[ -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: BASE_RPC_URL is required" >&2
  exit 1
fi

echo "Hot-swapping DeploymentBatcherShareMeshHelper on batcher ${DEPLOYMENT_BATCHER}"

forge script script/UpgradeDeploymentBatcherShareMeshHelper.s.sol:UpgradeDeploymentBatcherShareMeshHelper \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo "Share mesh helper upgrade broadcast complete."
