#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d)"
FAKE_BIN="$TEST_TMP/bin"
SHARED_GLOBAL_JSON="$TEST_TMP/base-shared-global.json"
HANDOFF_ENV_PATH="$TEST_TMP/base-release-handoff.env"
CALLS_LOG="$TEST_TMP/calls.log"
DEPLOYER_ENV_LOG="$TEST_TMP/deployer-env.log"
SEED_ENV_LOG="$TEST_TMP/seed-env.log"
RUN_LOG="$TEST_TMP/run.log"
export TEST_TMP HANDOFF_ENV_PATH CALLS_LOG DEPLOYER_ENV_LOG SEED_ENV_LOG

cleanup() {
  rm -rf "$TEST_TMP"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN"

cat > "$SHARED_GLOBAL_JSON" <<'EOF'
{
  "releaseTag": "v1.8.3",
  "chainId": 8453,
  "creatorRegistry": "0x1000000000000000000000000000000000000001",
  "creatorVaultFactory": "0x1000000000000000000000000000000000000002",
  "creatorLotteryManager": "0x1000000000000000000000000000000000000003",
  "creatorVrfConsumerV2_5": "0x1000000000000000000000000000000000000004",
  "vaultActivationBatcher": "0x1000000000000000000000000000000000000005",
  "solanaBridgeAdapter": "0x1000000000000000000000000000000000000006"
}
EOF

: > "$HANDOFF_ENV_PATH"

cat > "$FAKE_BIN/forge" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "$*" >> "$CALLS_LOG"

if [[ "$*" == *"DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer"* ]]; then
  {
    echo "DEPLOYMENT_EPOCH_TAG=${DEPLOYMENT_EPOCH_TAG:-}"
    echo "REGISTRY=${REGISTRY:-}"
    echo "VAULT_ACTIVATION_BATCHER=${VAULT_ACTIVATION_BATCHER:-}"
    echo "LOTTERY_MANAGER=${LOTTERY_MANAGER:-}"
    echo "SOLANA_BRIDGE_ADAPTER=${SOLANA_BRIDGE_ADAPTER:-}"
    echo "CONFIGURE_SOLANA=${CONFIGURE_SOLANA:-}"
    echo "CONFIGURE_OVAULT_RUNTIME=${CONFIGURE_OVAULT_RUNTIME:-}"
  } >> "$DEPLOYER_ENV_LOG"
  cat <<'OUT'
== Logs ==
  UniversalBytecodeStoreV2 (predicted): 0x2000000000000000000000000000000000000001
  UniversalCreate2DeployerFromStoreV2 (predicted): 0x2000000000000000000000000000000000000002
  DeploymentBatcher (predicted): 0x2000000000000000000000000000000000000003
  DeploymentBatcher: 0x2000000000000000000000000000000000000003
  CONFIGURE_SOLANA=0 (skipped setSolanaConfig)
  CONFIGURE_OVAULT_RUNTIME=0 (skipped setOVaultRuntimeConfig)

ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.
##
Start verification for (8) contracts
Submitting verification for [contracts/helpers/batchers/DeploymentBatcher.sol:DeploymentBatcher] 0x2000000000000000000000000000000000000003.
Submitted contract for verification:
	Response: `OK`
Contract verification status:
Response: `NOTOK`
Details: `Fail - Unable to verify. Compiled contract deployment bytecode does NOT match the transaction deployment bytecode.`
Error: Failed to verify contract: Checking verification result failed; Contract verification failed:
Status: `0`
Result: `Fail - Unable to verify. Compiled contract deployment bytecode does NOT match the transaction deployment bytecode.`
Error: Not all (7 / 8) contracts were verified!
OUT
  exit 1
fi

if [[ "$*" == *"ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana"* ]]; then
  touch "$TEST_TMP/solana-configured"
  exit 0
fi

if [[ "$*" == *"SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore"* ]]; then
  {
    echo "UNIVERSAL_BYTECODE_STORE=${UNIVERSAL_BYTECODE_STORE:-}"
    echo "DEPLOYMENT_BATCHER=${DEPLOYMENT_BATCHER:-}"
  } >> "$SEED_ENV_LOG"
  touch "$TEST_TMP/seeded"
  exit 0
fi

exit 0
EOF

chmod +x "$FAKE_BIN/forge"

PATH="$FAKE_BIN:$PATH" \
PRIVATE_KEY="0xabc123" \
BASE_RPC_URL="https://base.invalid" \
BASE_FULL_RELEASE_MODE="1" \
CONFIGURE_SOLANA="1" \
CONFIGURE_OVAULT_RUNTIME="1" \
BASE_SHARED_GLOBAL_OUTPUT_PATH="$SHARED_GLOBAL_JSON" \
BASE_RELEASE_HANDOFF_ENV_PATH="$HANDOFF_ENV_PATH" \
bash "$ROOT_DIR/script/deploy-infra-v2.sh" > "$RUN_LOG" 2>&1

rg '^DEPLOYMENT_EPOCH_TAG=v1\.8\.3$' "$DEPLOYER_ENV_LOG" >/dev/null
rg '^REGISTRY=0x1000000000000000000000000000000000000001$' "$DEPLOYER_ENV_LOG" >/dev/null
rg '^LOTTERY_MANAGER=0x1000000000000000000000000000000000000003$' "$DEPLOYER_ENV_LOG" >/dev/null
rg '^VAULT_ACTIVATION_BATCHER=0x1000000000000000000000000000000000000005$' "$DEPLOYER_ENV_LOG" >/dev/null
rg '^SOLANA_BRIDGE_ADAPTER=0x1000000000000000000000000000000000000006$' "$DEPLOYER_ENV_LOG" >/dev/null
rg '^CONFIGURE_SOLANA=0$' "$DEPLOYER_ENV_LOG" >/dev/null
rg '^CONFIGURE_OVAULT_RUNTIME=0$' "$DEPLOYER_ENV_LOG" >/dev/null

rg '^UNIVERSAL_BYTECODE_STORE=0x2000000000000000000000000000000000000001$' "$HANDOFF_ENV_PATH" >/dev/null
rg '^UNIVERSAL_CREATE2_DEPLOYER=0x2000000000000000000000000000000000000002$' "$HANDOFF_ENV_PATH" >/dev/null
rg '^UNIVERSAL_CREATE2_FROM_STORE=0x2000000000000000000000000000000000000002$' "$HANDOFF_ENV_PATH" >/dev/null
rg '^DEPLOYMENT_BATCHER=0x2000000000000000000000000000000000000003$' "$HANDOFF_ENV_PATH" >/dev/null
rg '^CREATOR_VAULT_BATCHER=0x2000000000000000000000000000000000000003$' "$HANDOFF_ENV_PATH" >/dev/null
rg '^CREATOR_VAULT_BATCHER_AUTO_HANDOFF=0x2000000000000000000000000000000000000003$' "$HANDOFF_ENV_PATH" >/dev/null

rg '^UNIVERSAL_BYTECODE_STORE=0x2000000000000000000000000000000000000001$' "$SEED_ENV_LOG" >/dev/null
rg '^DEPLOYMENT_BATCHER=0x2000000000000000000000000000000000000003$' "$SEED_ENV_LOG" >/dev/null

rg 'Continuing despite known DeploymentBatcher verification mismatch after successful onchain deployment\.' "$RUN_LOG" >/dev/null
rg 'Recovered v2 handoff values from deployer log fallback\.' "$RUN_LOG" >/dev/null

if rg 'ConfigureDeploymentBatcherSolana\.s\.sol:ConfigureDeploymentBatcherSolana' "$CALLS_LOG" >/dev/null; then
  echo "Expected treasury-only Solana batcher config to remain opt-in" >&2
  exit 1
fi

test -f "$TEST_TMP/seeded"

echo "deploy infra v2 verification recovery test passed"
