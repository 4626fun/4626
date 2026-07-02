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

registry="0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461"
factory="0x26b74b1d3AadD17e714068d259051409C9f942d1"
activation_batcher="0xB06d99c81994F5829ba462c4afA78eCff75bC281"
solana_adapter="0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1"
bytecode_store="0x7D1029a832E2BEd2C961bC912b623b763862Ad3C"
create2_from_store="0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0"
batcher="0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33"
phase1_module="0x829D0096fF18F096469Ae9D440f58Ae0D106ff06"
phase2_module="0x362495324370f68b30a57743254b154eD6115524"
phase3_helper="0xa5Ba1121214b9187749dfeb1382393c1941e0Da8"
univ4_helper="0xa2D06A329eD7b413646509845412f8C73CbbeDBF"
utils_helper="0x5B59219683b748a321f84eFDfe5A29d3bB945B27"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F|0x004684670d284EF607E1B2424fcf8ccBda8ef828|0x271Ab2C53D79d52ddB14506a44133Fe3FA395332|0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8|0xa99058f424FB3ACC639F59355C65C40149030651|0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1'
deprecated_solana_adapters='0x2414b595c4f18532A5836B6e2E6d536832c572e8|0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5|0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00'

require_rg 'Canonical deployed contract addresses for 4626 on Base mainnet (**v1.15.0**).' "$ADDRESSES_DOC" 'addresses doc v1.15.0 title'
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

require_rg 'Scope: current live Base infra addresses plus the canonical `v1.15.0` greenfield deploy target' "$INVENTORY_DOC" 'inventory v1.15.0 scope'
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
  if ! BYTECODE_MANIFEST="$ROOT_DIR/deployments/base/v1.15.0-bytecode-manifest.json" \
    UNIVERSAL_BYTECODE_STORE="$bytecode_store" \
    pnpm -C "$ROOT_DIR/frontend" exec tsx scripts/ops/verify-bytecode-store-seeded.ts >/dev/null; then
    echo "release target guard failed: deploy versioning verifier failed" >&2
    exit 1
  fi
fi

echo "current split Phase-1 release target guard passed"
