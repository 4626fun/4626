#!/usr/bin/env bash
set -euo pipefail

# Authorize v1.18.0 batcher + helper callers on CREATE2 deployer and OVault factory.
# Run after Safe wiring (wireDeploymentHelpers + setPhase1Module) completes.
#
# Owner: admin EOA (PRIVATE_KEY) — same as create2/factory deploy owner.
#
# Usage:
#   ./script/authorize-v1180-batcher-deployers.sh
#   ./script/authorize-v1180-batcher-deployers.sh --dry-run

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

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

# v1.19.1 greenfield defaults (docs/reference/addresses.md)
CREATE2="${UNIVERSAL_CREATE2_DEPLOYER:-0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2}"
FACTORY="${OVAULT_FACTORY:-0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5}"
BATCHER="${DEPLOYMENT_BATCHER:-0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032}"
PHASE3="${DEPLOYMENT_BATCHER_PHASE3_HELPER:-0xC54Fb8d8232a8a654E512b3bDf761c8Eb2783B74}"
SHARE_MESH="${DEPLOYMENT_BATCHER_SHARE_MESH_HELPER:-0x73b6efB7196CdFa6c095Dc196559c88818Cd3211}"

authorize_create2() {
  local deployer="$1"
  local allowed
  allowed="$(cast call "$CREATE2" "authorizedDeployers(address)(bool)" "$deployer" --rpc-url "$BASE_RPC_URL")"
  if [[ "$allowed" == "true" ]]; then
    echo "  CREATE2 already authorized: $deployer"
    return 0
  fi
  echo "  CREATE2 authorize: $deployer"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  cast send "$CREATE2" "setAuthorizedDeployer(address,bool)" "$deployer" true \
    --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash // .'
}

authorize_factory() {
  local deployer="$1"
  local allowed
  allowed="$(cast call "$FACTORY" "authorizedDeployers(address)(bool)" "$deployer" --rpc-url "$BASE_RPC_URL")"
  if [[ "$allowed" == "true" ]]; then
    echo "  Factory already authorized: $deployer"
    return 0
  fi
  echo "  Factory authorize: $deployer"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  cast send "$FACTORY" "setAuthorizedDeployer(address,bool)" "$deployer" true \
    --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash // .'
}

echo "==> v1.18.0 batcher deployer authorization"
echo "    CREATE2=$CREATE2"
echo "    FACTORY=$FACTORY"
echo "    BATCHER=$BATCHER"
echo "    PHASE3=$PHASE3"
echo "    SHARE_MESH=$SHARE_MESH"

echo "==> UniversalCreate2DeployerFromStore"
authorize_create2 "$BATCHER"
authorize_create2 "$PHASE3"
authorize_create2 "$SHARE_MESH"

echo "==> OVaultFactory4626"
authorize_factory "$BATCHER"

echo "==> Verify"
for addr in "$BATCHER" "$PHASE3" "$SHARE_MESH"; do
  c2="$(cast call "$CREATE2" "authorizedDeployers(address)(bool)" "$addr" --rpc-url "$BASE_RPC_URL")"
  echo "  CREATE2 $addr => $c2"
done
fac="$(cast call "$FACTORY" "authorizedDeployers(address)(bool)" "$BATCHER" --rpc-url "$BASE_RPC_URL")"
echo "  FACTORY $BATCHER => $fac"

if [[ "$fac" != "true" ]]; then
  echo "Error: factory authorization failed" >&2
  exit 1
fi
for addr in "$BATCHER" "$PHASE3" "$SHARE_MESH"; do
  c2="$(cast call "$CREATE2" "authorizedDeployers(address)(bool)" "$addr" --rpc-url "$BASE_RPC_URL")"
  if [[ "$c2" != "true" ]]; then
    echo "Error: CREATE2 authorization failed for $addr" >&2
    exit 1
  fi
done

echo "OK: v1.18.0 batcher deployer authorization complete"
