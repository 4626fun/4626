#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${OLD_DEPLOYMENT_BATCHER:=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33}"
export SHELL_UPGRADE_EPOCH_TAG="${SHELL_UPGRADE_EPOCH_TAG:-v1.16.1-share-mesh}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required" >&2
  exit 1
fi
if [[ -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: BASE_RPC_URL is required" >&2
  exit 1
fi

echo "Deploying new DeploymentBatcher shell (epoch ${SHELL_UPGRADE_EPOCH_TAG}) to replace ${OLD_DEPLOYMENT_BATCHER}"

forge script script/UpgradeDeploymentBatcherShellShareMesh.s.sol:UpgradeDeploymentBatcherShellShareMesh \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo "Batcher shell upgrade broadcast complete."
