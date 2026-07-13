#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RPC_URL="${1:-http://127.0.0.1:8545}"
HANDOFF="${ROOT_DIR}/tmp/base-v1.19.0-registration-plane-handoff.env"
MANIFEST="${ROOT_DIR}/deployments/base/v1.19.0-bytecode-manifest.json"
LOG_DIR="${ROOT_DIR}/tmp/v1.19.0-registration-plane-fork"
FORK_GAS_PRICE="${FORK_GAS_PRICE:-1000000000}"

case "$RPC_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *)
    echo "Refusing to rehearse against a non-local RPC: ${RPC_URL}" >&2
    exit 1
    ;;
esac

CLIENT_VERSION="$(cast rpc --rpc-url "$RPC_URL" web3_clientVersion | tr '[:upper:]' '[:lower:]')"
if [[ "$CLIENT_VERSION" != *anvil* ]]; then
  echo "Refusing to rehearse against a non-Anvil RPC: ${CLIENT_VERSION}" >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing ${ROOT_DIR}/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT_DIR/.env"
set +a
export BASE_RPC_URL="$RPC_URL"

mkdir -p "$LOG_DIR"
: > "$HANDOFF"

manifest_code_id() {
  local key="$1"
  jq -er --arg key "$key" '.contracts[$key].codeId' "$MANIFEST"
}

export CREATOR_VAULT_CODE_ID="$(manifest_code_id CreatorOVault)"
export CREATOR_WRAPPER_CODE_ID="$(manifest_code_id CreatorOVaultWrapper)"
export CREATOR_SHARE_OFT_CODE_ID="$(manifest_code_id CreatorShareOFT)"
export CREATOR_GAUGE_CODE_ID="$(manifest_code_id CreatorGaugeController)"
export CREATOR_CCA_CODE_ID="$(manifest_code_id CCALaunchArm)"
export CREATOR_ORACLE_CODE_ID="$(manifest_code_id CreatorOracle)"
export AGENT_VAULT_CODE_ID="$(manifest_code_id AgentOVault)"
export AGENT_WRAPPER_CODE_ID="$(manifest_code_id AgentOVaultWrapper)"
export AGENT_SHARE_OFT_CODE_ID="$(manifest_code_id AgentShareOFT)"
export AGENT_GAUGE_CODE_ID="$(manifest_code_id AgentGaugeController)"
export AGENT_CCA_CODE_ID="$(manifest_code_id AgentRevenueRouter)"
export AGENT_ORACLE_CODE_ID="$(manifest_code_id AgentOracle)"
export OFT_BOOTSTRAP_CODE_ID="$(manifest_code_id OFTBootstrapRegistry)"

export REGISTRATION_PLANE_EPOCH_TAG="v1.19.0-registration-plane"
export REGISTRATION_PLANE_OWNER="0xB05Cf01231cF2fF99499682E64D3780d57c80FdD"
export VRF_CONSUMER="0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36"
export SOLANA_BRIDGE_ADAPTER="0x9A61814082A26192DD9Cb201b44058506685Be60"
export UNIVERSAL_BYTECODE_STORE="0xfa3e3b466635DAff910057f18749B93d56F9DE50"
export UNIVERSAL_CREATE2_DEPLOYER="0x54660E61857a652753d805aD2c7b4f759C138bD5"
export PROTOCOL_TREASURY="0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3"
export PROTOCOL_AUTOMATION="0x08f0875E40781578F902998b2b831cc48d838eBE"
export OVAULT_HUB_COMPOSER="0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1"
export OVAULT_SOLANA_EID="30168"
export SOLANA_SHARE_OFT_PEER="0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f"
export SOLANA_DESTINATION
SOLANA_DESTINATION="$(cast call \
  0x02D7abC547F8B1e7E2D7a919D8D1005918361750 \
  'solanaDestination()(bytes32)' \
  --rpc-url "$RPC_URL")"
cast rpc --rpc-url "$RPC_URL" anvil_setBalance "$REGISTRATION_PLANE_OWNER" \
  0x56BC75E2D63100000 >/dev/null

append_handoff_lines() {
  local log_path="$1"
  local found=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    case "$line" in
      HANDOFF:*)
        printf '%s\n' "${line#HANDOFF:}" >> "$HANDOFF"
        found=1
        ;;
    esac
  done < "$log_path"
  if [[ "$found" -ne 1 ]]; then
    echo "No HANDOFF lines found in ${log_path}" >&2
    exit 1
  fi
}

write_static_handoff() {
  {
    printf 'REGISTRATION_PLANE_OWNER=%s\n' "$REGISTRATION_PLANE_OWNER"
    printf 'VRF_CONSUMER=%s\n' "$VRF_CONSUMER"
    printf 'SOLANA_BRIDGE_ADAPTER=%s\n' "$SOLANA_BRIDGE_ADAPTER"
    printf 'UNIVERSAL_BYTECODE_STORE=%s\n' "$UNIVERSAL_BYTECODE_STORE"
    printf 'UNIVERSAL_CREATE2_DEPLOYER=%s\n' "$UNIVERSAL_CREATE2_DEPLOYER"
    printf 'PROTOCOL_TREASURY=%s\n' "$PROTOCOL_TREASURY"
    printf 'PROTOCOL_AUTOMATION=%s\n' "$PROTOCOL_AUTOMATION"
    printf 'SOLANA_DESTINATION=%s\n' "$SOLANA_DESTINATION"
    printf 'OVAULT_HUB_COMPOSER=%s\n' "$OVAULT_HUB_COMPOSER"
    printf 'OVAULT_SOLANA_EID=%s\n' "$OVAULT_SOLANA_EID"
    printf 'SOLANA_SHARE_OFT_PEER=%s\n' "$SOLANA_SHARE_OFT_PEER"
  } >> "$HANDOFF"
}

echo "==> [1/9] Deploy deterministic registration-plane contracts"
forge script script/DeployV1190RegistrationPlane.s.sol:DeployV1190RegistrationPlane \
  --rpc-url "$RPC_URL" --legacy --gas-price "$FORK_GAS_PRICE" --broadcast -vvvv | tee "$LOG_DIR/registration-plane.log"
append_handoff_lines "$LOG_DIR/registration-plane.log"
write_static_handoff

set -a
# shellcheck disable=SC1090
source "$HANDOFF"
set +a
export REGISTRY="$REGISTRY_4626"
export LOTTERY_MANAGER
export VAULT_ACTIVATION_BATCHER
export AGENT_VAULT_CORE_MODULE
export INFRA_STORE_SALT="0x0000000000000000000000000000000000000000000000000000000000000000"
export INFRA_DEPLOYER_FROM_STORE_SALT="0x0000000000000000000000000000000000000000000000000000000000000000"

echo "==> [2/9] Deploy current batcher shell and modules while reusing store/deployer"
CREATE2_FROM_STORE_OWNER="$REGISTRATION_PLANE_OWNER" \
forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url "$RPC_URL" --legacy --gas-price "$FORK_GAS_PRICE" --broadcast -vvvv | tee "$LOG_DIR/phased-infra.log"
append_handoff_lines "$LOG_DIR/phased-infra.log"

set -a
# shellcheck disable=SC1090
source "$HANDOFF"
set +a

echo "==> [3/9] Seed current release bytecode into the reused store"
./script/seed-greenfield-bytecode-store.sh v1.19.0 | tee "$LOG_DIR/bytecode-seed.log"

echo "==> [4/9] Safe-wire helpers, module codehashes, codeIds, factory, and Solana config"
BASE_RPC_URL="$RPC_URL" pnpm -C frontend exec tsx scripts/ops/execute-v1190-registration-plane-safe.ts \
  --handoff "$HANDOFF" \
  --manifest "$MANIFEST" \
  --rpc "$RPC_URL" | tee "$LOG_DIR/safe-wiring.json"

echo "==> [5/9] Authorize wired batcher helpers on the reused CREATE2 deployer"
CREATE2_FROM_STORE_OWNER="$REGISTRATION_PLANE_OWNER" \
forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url "$RPC_URL" --legacy --gas-price "$FORK_GAS_PRICE" --broadcast -vvvv | tee "$LOG_DIR/phased-infra-authorize.log"

echo "==> [6/9] Bind batcher, authorize CREATE2, and retarget adapter on fork"
export NEW_DEPLOYMENT_BATCHER="$DEPLOYMENT_BATCHER"
export RETARGET_SOLANA_ADAPTER=1
forge script script/DeployV1190RegistrationPlane.s.sol:DeployV1190RegistrationPlane \
  --rpc-url "$RPC_URL" --legacy --gas-price "$FORK_GAS_PRICE" --broadcast -vvvv | tee "$LOG_DIR/finalize-registration-plane.log"

echo "==> [7/9] Verify complete registration-plane wiring and AKITA isolation"
BASE_RPC_URL="$RPC_URL" pnpm -C frontend exec tsx scripts/ops/verify-v1190-registration-plane.ts \
  --handoff "$HANDOFF" \
  --manifest "$MANIFEST" \
  --rpc "$RPC_URL" | tee "$LOG_DIR/verification.json"

echo "==> [8/9] Execute one greenfield Phase1/Phase2 registration lifecycle"
forge script script/RehearseV1190GreenfieldLifecycle.s.sol:RehearseV1190GreenfieldLifecycle \
  --rpc-url "$RPC_URL" --legacy --gas-price "$FORK_GAS_PRICE" --broadcast --slow --gas-estimate-multiplier 380 -vvvv \
  | tee "$LOG_DIR/greenfield-lifecycle.log"

echo "==> [9/9] Generate unsigned Safe calldata packet"
BASE_RPC_URL="$RPC_URL" pnpm -C frontend exec tsx scripts/ops/execute-v1190-registration-plane-safe.ts \
  --handoff "$HANDOFF" \
  --manifest "$MANIFEST" \
  --rpc "$RPC_URL" \
  --dry-run > "$LOG_DIR/unsigned-safe-calldata.json"

echo "Registration-plane fork rehearsal passed."
echo "Handoff: ${HANDOFF}"
echo "Evidence: ${LOG_DIR}"
