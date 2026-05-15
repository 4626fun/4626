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
bytecode_store="0x9C3e2A7bd73690d5b5DC0C47f8dB74c4dc5D1c69"
create2_from_store="0xF6538d7D18AfFe5057C6f109DBEd33c851A70c7E"
batcher="0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8"
phase2_module="0x1A806550070d42d18ad5C5325A8b90BeD647E7BB"
phase3_helper="0x809a20c6655D75C1d408dEd02a6EAB705b7b5153"
univ4_helper="0xD7A2F1c2C5d73EeB19B495D2Bbe29A9bE2112F0b"
utils_helper="0x158C9925BbC53295675a1b0BB489c7Cfba2cfa73"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F|0x004684670d284EF607E1B2424fcf8ccBda8ef828|0x271Ab2C53D79d52ddB14506a44133Fe3FA395332'

rg -F 'Current Live Infrastructure (`v1.11.1` protocol contract release target)' "$ADDRESSES_DOC" >/dev/null
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

rg -F 'Scope: current live Base infra addresses plus the canonical `v1.11.1` protocol contract release target' "$INVENTORY_DOC" >/dev/null
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

rg -F "VAULT_BATCHER = $batcher;" "$SEED_REGISTRY" >/dev/null
rg -F "VAULT_ACT_BATCHER = $activation_batcher;" "$SEED_REGISTRY" >/dev/null

if rg "$deprecated_batchers" "$DEFAULTS" "$SEED_REGISTRY" >/dev/null; then
  echo "active deploy defaults still reference a deprecated creator-vault batcher" >&2
  exit 1
fi

echo "current split Phase-1 release target guard passed"
