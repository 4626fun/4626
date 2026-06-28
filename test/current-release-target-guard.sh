#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/_internal/current-contract-inventory.md"
DEFAULTS="$ROOT_DIR/frontend/src/config/contracts.defaults.ts"
SEED_REGISTRY="$ROOT_DIR/script/SeedCreatorRegistry.s.sol"

load_env_key_if_unset() {
  local key="$1"
  local file="$2"
  if [[ -n "${!key:-}" || ! -f "$file" ]]; then
    return 0
  fi

  local line value
  line="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  value="${line#*=}"
  value="${value%$'\r'}"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  export "${key}=${value}"
}

require_rg() {
  local needle="$1"
  local file="$2"
  local label="$3"

  if ! rg -F "$needle" "$file" >/dev/null; then
    echo "release target guard failed: missing ${label} in ${file}" >&2
    exit 1
  fi
}

load_env_key_if_unset BASE_RPC_URL "$ROOT_DIR/frontend/.env.local"
load_env_key_if_unset BASE_RPC_URL "$ROOT_DIR/frontend/.env"

registry="0xDD7B106a15540bA2F59464590222bF47D8C9394E"
factory="0xf4a4d70D9fB3b29c56eB2aaE264FBd3DF9221A6a"
activation_batcher="0x5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A"
solana_adapter="0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae"
bytecode_store="0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314"
create2_from_store="0x2fA570Cb17925Da86b303D4651f06b83057a10c4"
batcher="0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1"
phase1_module="0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266"
phase2_module="0xde192645Fb02dD05f586930e55D709E89c320435"
phase3_helper="0xE0971a924E33251556fE73a4025166701b772dBe"
univ4_helper="0xD2c68F175FB4DB4069A2ebBc3f02B31C635438eb"
utils_helper="0xE41231e399511baaDa8844C9D1c83C096e3f2E60"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F|0x004684670d284EF607E1B2424fcf8ccBda8ef828|0x271Ab2C53D79d52ddB14506a44133Fe3FA395332|0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8|0xa99058f424FB3ACC639F59355C65C40149030651'
deprecated_solana_adapters='0x2414b595c4f18532A5836B6e2E6d536832c572e8|0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5|0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00'

require_rg 'Canonical deployed contract addresses for 4626 on Base mainnet (**v1.14.1**).' "$ADDRESSES_DOC" 'addresses doc v1.14.1 title'
require_rg '### Current infrastructure' "$ADDRESSES_DOC" 'addresses doc current infrastructure heading'
require_rg "CreatorRegistry | \`$registry\`" "$ADDRESSES_DOC" 'CreatorRegistry address'
require_rg "CreatorOVaultFactory | \`$factory\`" "$ADDRESSES_DOC" 'CreatorOVaultFactory address'
require_rg "VaultActivationBatcher | \`$activation_batcher\`" "$ADDRESSES_DOC" 'VaultActivationBatcher address'
require_rg "SolanaBridgeAdapter | \`$solana_adapter\`" "$ADDRESSES_DOC" 'SolanaBridgeAdapter address'
require_rg "UniversalBytecodeStoreV2 | \`$bytecode_store\`" "$ADDRESSES_DOC" 'UniversalBytecodeStoreV2 address'
require_rg "UniversalCreate2DeployerFromStore | \`$create2_from_store\`" "$ADDRESSES_DOC" 'UniversalCreate2DeployerFromStore address'
require_rg "DeploymentBatcher | \`$batcher\`" "$ADDRESSES_DOC" 'DeploymentBatcher address'
require_rg "DeploymentBatcherPhase1Module | \`$phase1_module\`" "$ADDRESSES_DOC" 'DeploymentBatcherPhase1Module address'
require_rg "DeploymentBatcherPhase2Module | \`$phase2_module\`" "$ADDRESSES_DOC" 'DeploymentBatcherPhase2Module address'
require_rg "DeploymentBatcherPhase3Helper | \`$phase3_helper\`" "$ADDRESSES_DOC" 'DeploymentBatcherPhase3Helper address'
require_rg "DeploymentBatcherUniV4Helper | \`$univ4_helper\`" "$ADDRESSES_DOC" 'DeploymentBatcherUniV4Helper address'
require_rg "DeploymentBatcherUtilsHelper | \`$utils_helper\`" "$ADDRESSES_DOC" 'DeploymentBatcherUtilsHelper address'

require_rg 'Scope: current live Base infra addresses plus the canonical `v1.14.1` greenfield deploy target' "$INVENTORY_DOC" 'inventory v1.14.1 scope'
require_rg "\`solanaBridgeAdapter\` | \`$solana_adapter\`" "$INVENTORY_DOC" 'inventory SolanaBridgeAdapter address'
require_rg "\`bytecodeStore\` | \`$bytecode_store\`" "$INVENTORY_DOC" 'inventory bytecodeStore address'
require_rg "\`create2DeployerFromStore\` | \`$create2_from_store\`" "$INVENTORY_DOC" 'inventory create2DeployerFromStore address'
require_rg "\`deploymentBatcher\` | \`$batcher\`" "$INVENTORY_DOC" 'inventory deploymentBatcher address'
require_rg "\`deploymentBatcherPhase1Module\` | \`$phase1_module\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase1Module address'
require_rg "\`deploymentBatcherPhase2Module\` | \`$phase2_module\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase2Module address'
require_rg "\`deploymentBatcherPhase3Helper\` | \`$phase3_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase3Helper address'
require_rg "\`deploymentBatcherUniV4Helper\` | \`$univ4_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherUniV4Helper address'
require_rg "\`deploymentBatcherUtilsHelper\` | \`$utils_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherUtilsHelper address'

require_rg "SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('${batcher#0x}')" "$DEFAULTS" 'frontend split Phase-1 batcher constant'
require_rg "solanaBridgeAdapter: addr('${solana_adapter#0x}')," "$DEFAULTS" 'frontend SolanaBridgeAdapter default'
require_rg "universalBytecodeStore: addr('${bytecode_store#0x}')," "$DEFAULTS" 'frontend bytecode store default'
require_rg "universalCreate2DeployerFromStore: addr('${create2_from_store#0x}')," "$DEFAULTS" 'frontend create2 deployer default'
require_rg "payoutRouterFactory: addr('0000000000000000000000000000000000000000')," "$DEFAULTS" 'frontend zero payoutRouterFactory default'
require_rg "creatorVaultBatcher: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" 'frontend creatorVaultBatcher default'
require_rg "creatorVaultBatcherAutoHandoff: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" 'frontend creatorVaultBatcherAutoHandoff default'

require_rg "VAULT_BATCHER = $batcher;" "$SEED_REGISTRY" 'SeedCreatorRegistry VAULT_BATCHER'
require_rg "VAULT_ACT_BATCHER = $activation_batcher;" "$SEED_REGISTRY" 'SeedCreatorRegistry VAULT_ACT_BATCHER'

if rg "$deprecated_batchers" "$DEFAULTS" "$SEED_REGISTRY" >/dev/null; then
  echo "active deploy defaults still reference a deprecated creator-vault batcher" >&2
  exit 1
fi

stale_adapter_hits="$(
  rg "$deprecated_solana_adapters" \
    frontend/src frontend/server frontend/api kpr/script kpr/scripts script \
    --glob '!**/*.test.ts' \
    --glob '!docs/**' \
    --glob '!deployments/**' \
    2>/dev/null || true
)"
if [[ -n "$stale_adapter_hits" ]]; then
  echo "active code still references a deprecated SolanaBridgeAdapter address:" >&2
  echo "$stale_adapter_hits" >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  if ! BYTECODE_MANIFEST="$ROOT_DIR/deployments/base/v1.14.1-bytecode-manifest.json" \
    pnpm -C "$ROOT_DIR/frontend" exec tsx scripts/ops/verify-v1140-deploy-versioning.ts >/dev/null; then
    echo "release target guard failed: deploy versioning verifier failed" >&2
    exit 1
  fi
fi

echo "current split Phase-1 release target guard passed"
