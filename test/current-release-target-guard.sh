#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/reference/current-contract-inventory.md"
DEPLOY_GUIDE="$ROOT_DIR/docs/guides/deploy-vault.md"
DEFAULTS="$ROOT_DIR/frontend/src/config/contracts.defaults.ts"
SEED_REGISTRY="$ROOT_DIR/script/SeedCreatorRegistry.s.sol"

registry="0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb"
factory="0xC7E919899Fd4C0C4f6f4269a63046107f85848bB"
activation_batcher="0x7Cc0050842433968cc7A0884d192b61FD0b46F63"
solana_adapter="0x653326dD0145656eC3b598943C0E84d7405aE6Ae"
bytecode_store="0x77e53f656Ee3c5A962e9DA2Fc97EA1A35ae9b4d5"
create2_from_store="0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd"
batcher="0x004684670d284EF607E1B2424fcf8ccBda8ef828"
phase2_module="0x9794735D53dA4f0884eA43E2764A7E4dd2a38826"
phase3_helper="0x7e4b2dd557bA62FD1Dd5f72CBf5FFAAaaB8A468c"
univ4_helper="0xCd10BEcd96c13b63cEff49A646Eca1fe6D2f2CC7"
utils_helper="0xb79615C6B128E953347fcd6061DeaEc867482EEC"

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
