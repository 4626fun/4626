#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/reference/current-contract-inventory.md"
DEFAULTS="$ROOT_DIR/frontend/src/config/contracts.defaults.ts"
SEED_REGISTRY="$ROOT_DIR/script/SeedCreatorRegistry.s.sol"

registry="0x3f64087dc361Ad52300409E5873b26941D6418B6"
factory="0x09a2fd817F30D2599fb13520d06751259b6AdcFE"
activation_batcher="0x5036FB536f53b15307825eB2006B21E22f0F3193"
solana_adapter="0x700b4BBAf965c013123bAd02a6562FBa487aC0f1"
bytecode_store="0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4"
create2_from_store="0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7"
batcher="0xa99058f424FB3ACC639F59355C65C40149030651"
phase1_module="0xE83876c67E1E845A199f64fb33D76ADC62EAaB9D"
phase2_module="0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f"
phase3_helper="0x674a2D5EE33e184e2120B373a9AcB3fef640885c"
univ4_helper="0xF71a6236586077CD29C971443D2cce37B543DcBB"
utils_helper="0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F|0x004684670d284EF607E1B2424fcf8ccBda8ef828|0x271Ab2C53D79d52ddB14506a44133Fe3FA395332|0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8'
deprecated_solana_adapters='0x2414b595c4f18532A5836B6e2E6d536832c572e8|0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5|0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00'

rg -F 'Current Live Infrastructure (`v1.14.0` greenfield deploy target)' "$ADDRESSES_DOC" >/dev/null
rg -F "CreatorRegistry | \`$registry\`" "$ADDRESSES_DOC" >/dev/null
rg -F "CreatorOVaultFactory | \`$factory\`" "$ADDRESSES_DOC" >/dev/null
rg -F "VaultActivationBatcher | \`$activation_batcher\`" "$ADDRESSES_DOC" >/dev/null
rg -F "SolanaBridgeAdapter | \`$solana_adapter\`" "$ADDRESSES_DOC" >/dev/null
rg -F "UniversalBytecodeStoreV2 | \`$bytecode_store\`" "$ADDRESSES_DOC" >/dev/null
rg -F "UniversalCreate2DeployerFromStore | \`$create2_from_store\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcher | \`$batcher\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherPhase1Module | \`$phase1_module\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherPhase2Module | \`$phase2_module\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherPhase3Helper | \`$phase3_helper\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherUniV4Helper | \`$univ4_helper\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherUtilsHelper | \`$utils_helper\`" "$ADDRESSES_DOC" >/dev/null

rg -F 'Scope: current live Base infra addresses plus the canonical `v1.14.0` greenfield deploy target' "$INVENTORY_DOC" >/dev/null
rg -F "\`solanaBridgeAdapter\` | \`$solana_adapter\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`bytecodeStore\` | \`$bytecode_store\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`create2DeployerFromStore\` | \`$create2_from_store\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcher\` | \`$batcher\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcherPhase1Module\` | \`$phase1_module\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcherPhase2Module\` | \`$phase2_module\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcherPhase3Helper\` | \`$phase3_helper\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcherUniV4Helper\` | \`$univ4_helper\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcherUtilsHelper\` | \`$utils_helper\`" "$INVENTORY_DOC" >/dev/null

rg -F "SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('${batcher#0x}')" "$DEFAULTS" >/dev/null
rg -F "solanaBridgeAdapter: addr('${solana_adapter#0x}')," "$DEFAULTS" >/dev/null
rg -F "universalBytecodeStore: addr('${bytecode_store#0x}')," "$DEFAULTS" >/dev/null
rg -F "universalCreate2DeployerFromStore: addr('${create2_from_store#0x}')," "$DEFAULTS" >/dev/null
rg -F "payoutRouterFactory: addr('0000000000000000000000000000000000000000')," "$DEFAULTS" >/dev/null
rg -F "creatorVaultBatcher: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" >/dev/null
rg -F "creatorVaultBatcherAutoHandoff: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" >/dev/null

rg -F "VAULT_BATCHER = $batcher;" "$SEED_REGISTRY" >/dev/null
rg -F "VAULT_ACT_BATCHER = $activation_batcher;" "$SEED_REGISTRY" >/dev/null

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
  pnpm -C "$ROOT_DIR/frontend" exec tsx scripts/ops/verify-v1140-deploy-versioning.ts >/dev/null
fi

echo "current split Phase-1 release target guard passed"
