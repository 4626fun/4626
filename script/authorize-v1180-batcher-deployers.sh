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

# Force live v1.20.0 pins (docs/reference/addresses.md) after handoff source.
# Authorizing the new batcher on a superseded CREATE2 reports success while
# live deploys still fail with NotAuthorizedDeployer.
CREATE2="0xdffB25505F5050E15B3602296330Ef352127d1Ef"
FACTORY="0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5"
BATCHER="0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032"
PHASE3="0x3Ed642288cd03846e9dA956cF95812d3125dD274"
SHARE_MESH="0x1BCd4768180671Aa435C845239e05Afc81a496cA"

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
