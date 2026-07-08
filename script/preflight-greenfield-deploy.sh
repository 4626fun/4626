#!/usr/bin/env bash
set -euo pipefail

# Pre-broadcast checks for greenfield deploy orchestration.
#
# Usage:
#   export DEPLOYMENT_EPOCH_TAG=v1.18.0
#   ./script/preflight-greenfield-deploy.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EPOCH="${DEPLOYMENT_EPOCH_TAG:-}"
if [[ -z "$EPOCH" ]]; then
  echo "Error: DEPLOYMENT_EPOCH_TAG must be set (e.g. v1.18.0)" >&2
  exit 1
fi

fail() {
  echo "Preflight failed: $*" >&2
  exit 1
}

echo "==> greenfield preflight (${EPOCH})"

[[ -n "${PRIVATE_KEY:-}" ]] || fail "PRIVATE_KEY is not set"
[[ -n "${BASE_RPC_URL:-}" ]] || fail "BASE_RPC_URL is not set"

command -v forge >/dev/null 2>&1 || fail "forge not found"
command -v python3 >/dev/null 2>&1 || fail "python3 not found"

release_doc="${ROOT_DIR}/docs/_internal/deployment-releases-legacy/${EPOCH}-greenfield.md"
[[ -f "$release_doc" ]] || fail "missing release packet: ${release_doc}"

if [[ "${DEPLOYMENT_EPOCH_TAG:-}" != "$EPOCH" ]]; then
  fail "DEPLOYMENT_EPOCH_TAG=${DEPLOYMENT_EPOCH_TAG:-<unset>} does not match expected ${EPOCH}"
fi

if [[ -f "${ROOT_DIR}/.env" ]]; then
  pinned_epoch="$(grep -E '^DEPLOYMENT_EPOCH_TAG=' "${ROOT_DIR}/.env" | tail -1 | cut -d= -f2- || true)"
  if [[ -n "$pinned_epoch" && "$pinned_epoch" != "$EPOCH" ]]; then
    echo "Note: .env pins DEPLOYMENT_EPOCH_TAG=${pinned_epoch}; orchestrator export (${EPOCH}) must win."
  fi
fi

echo "==> forge build (contracts only)"
forge build --skip test --skip script >/dev/null

echo "==> simulate DeployInfrastructure (no broadcast)"
set +e
forge script script/DeployInfrastructure.s.sol:DeployInfrastructure \
  --rpc-url "$BASE_RPC_URL" >/dev/null 2>&1
infra_sim_status=$?
set -e
if [[ "$infra_sim_status" -ne 0 ]]; then
  fail "DeployInfrastructure simulation failed (exit ${infra_sim_status})"
fi

echo "==> simulate DeployBaseMainnetDeployer (no broadcast)"
set +e
DEPLOYMENT_EPOCH_TAG="$EPOCH" \
SHELL_UPGRADE_EPOCH_TAG="${SHELL_UPGRADE_EPOCH_TAG:-${EPOCH}-greenfield}" \
PROTOCOL_AUTOMATION_SAFE="${PROTOCOL_AUTOMATION_SAFE:-0x08f0875E40781578F902998b2b831cc48d838eBE}" \
forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url "$BASE_RPC_URL" >/dev/null 2>&1
deployer_sim_status=$?
set -e
if [[ "$deployer_sim_status" -ne 0 ]]; then
  fail "DeployBaseMainnetDeployer simulation failed (exit ${deployer_sim_status})"
fi

echo "Preflight passed for ${EPOCH}."
