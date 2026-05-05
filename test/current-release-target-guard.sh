#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/reference/current-contract-inventory.md"
DEPLOY_GUIDE="$ROOT_DIR/docs/guides/deploy-vault.md"
DEFAULTS="$ROOT_DIR/frontend/src/config/contracts.defaults.ts"
SEED_REGISTRY="$ROOT_DIR/script/SeedCreatorRegistry.s.sol"

registry="0xa6216Ea21f4a4d190EdD453A51e4e015A44e60C4"
factory="0x183b8825Bbe7d92be8F54F811EfF9C0dFe854F6E"
activation_batcher="0x681DC69607f6E8848a56819ce8C6d591E764187a"
solana_adapter="0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5"
bytecode_store="0xBd21c58f3D59c6E90a6bCCe462c68670F124a792"
create2_from_store="0x24c80676E03f4c160bfa769589280fE9f9509eCb"
batcher="0x271Ab2C53D79d52ddB14506a44133Fe3FA395332"
phase2_module="0x81D70248eB4276a6Db7E7DaB9c3B202e52c87593"
phase3_helper="0xC2270DA64Cb6ab39e9361926529AA8462c7d3770"
univ4_helper="0xbE953c5Da2Cf31C22087F528615bB8e2079b33A4"
utils_helper="0x9D811694842D3d67Af243bc140961fb9a9ad4040"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F'

rg -F 'Current Live Infrastructure (`v1.11.0` protocol contract release target)' "$ADDRESSES_DOC" >/dev/null
rg -F "CreatorRegistry | \`$registry\`" "$ADDRESSES_DOC" >/dev/null
rg -F "CreatorOVaultFactory | \`$factory\`" "$ADDRESSES_DOC" >/dev/null
rg -F "VaultActivationBatcher | \`$activation_batcher\`" "$ADDRESSES_DOC" >/dev/null
rg -F "SolanaBridgeAdapter | \`$solana_adapter\`" "$ADDRESSES_DOC" >/dev/null
rg -F "UniversalBytecodeStoreV2 | \`$bytecode_store\`" "$ADDRESSES_DOC" >/dev/null
rg -F "UniversalCreate2DeployerFromStore | \`$create2_from_store\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcher | \`$batcher\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherPhase2Module | \`$phase2_module\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherPhase3Helper | \`$phase3_helper\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherUniV4Helper | \`$univ4_helper\`" "$ADDRESSES_DOC" >/dev/null
rg -F "DeploymentBatcherUtilsHelper | \`$utils_helper\`" "$ADDRESSES_DOC" >/dev/null

rg -F 'Scope: current live Base infra addresses plus the canonical `v1.11.0` protocol contract release target' "$INVENTORY_DOC" >/dev/null
rg -F "\`solanaBridgeAdapter\` | \`$solana_adapter\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`bytecodeStore\` | \`$bytecode_store\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`create2DeployerFromStore\` | \`$create2_from_store\`" "$INVENTORY_DOC" >/dev/null
rg -F "\`deploymentBatcher\` | \`$batcher\`" "$INVENTORY_DOC" >/dev/null
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

rg -F "Deployment batcher: \`$batcher\`" "$DEPLOY_GUIDE" >/dev/null
rg -F "Deployment batcher auto-handoff alias: \`$batcher\`" "$DEPLOY_GUIDE" >/dev/null
rg -F "export NEW_BATCHER=$batcher" "$DEPLOY_GUIDE" >/dev/null
rg -F "export DEPLOYMENT_BATCHER=$batcher" "$DEPLOY_GUIDE" >/dev/null
rg -F "export SOLANA_BRIDGE_ADAPTER=$solana_adapter" "$DEPLOY_GUIDE" >/dev/null

rg -F "VAULT_BATCHER = $batcher;" "$SEED_REGISTRY" >/dev/null
rg -F "VAULT_ACT_BATCHER = $activation_batcher;" "$SEED_REGISTRY" >/dev/null

if rg "$deprecated_batchers" "$DEFAULTS" "$SEED_REGISTRY" "$DEPLOY_GUIDE" >/dev/null; then
  echo "active deploy defaults still reference a deprecated creator-vault batcher" >&2
  exit 1
fi

echo "current split Phase-1 release target guard passed"
