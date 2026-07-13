#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/_internal/current-contract-inventory.md"
DEFAULTS="$ROOT_DIR/frontend/src/config/contracts.defaults.ts"
SEED_REGISTRY="$ROOT_DIR/script/SeedRegistry4626.s.sol"
REWARDS_DEPLOY="$ROOT_DIR/script/DeployRewardsEcosystem.s.sol"
POST_BROADCAST="$ROOT_DIR/script/execute-v1180-post-broadcast.sh"
VERCEL_SYNC="$ROOT_DIR/script/sync-v1180-vercel-env.sh"
KPR_SOLANA_CANONICAL="$ROOT_DIR/kpr/utils/solanaCanonicalAddresses.ts"
KPR_SOLANA_SEED_ENV="$ROOT_DIR/kpr/deploy/seed-solana-orchestrator-env.sh"
CURRENT_RELEASE="v1.19.0"
CURRENT_MANIFEST="$ROOT_DIR/deployments/base/${CURRENT_RELEASE}-bytecode-manifest.json"

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

registry="0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0"
factory="0x70d0D2411D362BA50821389383Fa6B829d736232"
activation_batcher="0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3"
solana_adapter="0x9A61814082A26192DD9Cb201b44058506685Be60"
bytecode_store="0xfa3e3b466635DAff910057f18749B93d56F9DE50"
create2_from_store="0x54660E61857a652753d805aD2c7b4f759C138bD5"
batcher="0x02D7abC547F8B1e7E2D7a919D8D1005918361750"
lottery_manager="0xB68F359e01626Ec5d15C624037311C70DacAba43"
phase1_module="0x808fC8e83629019e29df79E592237B4603F9D1b5"
phase2_module="0x9845D8d412DA4686FE8b1886F314Ef8b288b8D71"
phase3_helper="0xB8c10FE668d59E2DEb5771298133c2a3DBFc9bB3"
share_mesh_helper="0x9C965724f6B3387433D82bf67632Bf06470a8988"
utils_helper="0xCBf24949Fc99e7C9b5e16e15a423543930fd4A52"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F|0x004684670d284EF607E1B2424fcf8ccBda8ef828|0x271Ab2C53D79d52ddB14506a44133Fe3FA395332|0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8|0xa99058f424FB3ACC639F59355C65C40149030651|0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1|0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33|0xA9024e1B89C5Be34502A275576Cc137473d65839'
deprecated_solana_adapters='0x2414b595c4f18532A5836B6e2E6d536832c572e8|0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5|0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00|0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1|0x700b4BBAf965c013123bAd02a6562FBa487aC0f1|0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae'

require_rg 'new per-creator launches use the' "$ADDRESSES_DOC" 'addresses doc partial-refresh title'
require_rg '**v1.19.0** bytecode/CREATE2 epoch.' "$ADDRESSES_DOC" 'addresses doc v1.19.0 epoch'
require_rg '### Current infrastructure' "$ADDRESSES_DOC" 'addresses doc current infrastructure heading'
require_rg "Registry4626 | \`$registry\`" "$ADDRESSES_DOC" 'Registry4626 address'
require_rg "OVaultFactory4626 | \`$factory\`" "$ADDRESSES_DOC" 'OVaultFactory4626 address'
require_rg "VaultActivationBatcher | \`$activation_batcher\`" "$ADDRESSES_DOC" 'VaultActivationBatcher address'
require_rg "SolanaBridgeAdapter | \`$solana_adapter\`" "$ADDRESSES_DOC" 'SolanaBridgeAdapter address'
require_rg "UniversalBytecodeStoreV2 | \`$bytecode_store\`" "$ADDRESSES_DOC" 'UniversalBytecodeStoreV2 address'
require_rg "UniversalCreate2DeployerFromStore | \`$create2_from_store\`" "$ADDRESSES_DOC" 'UniversalCreate2DeployerFromStore address'
require_rg "DeploymentBatcher | \`$batcher\`" "$ADDRESSES_DOC" 'DeploymentBatcher address'
require_rg "LotteryManager4626 | \`$lottery_manager\`" "$ADDRESSES_DOC" 'LotteryManager4626 address'
require_rg "DeploymentBatcherPhase1Module | \`$phase1_module\`" "$ADDRESSES_DOC" 'DeploymentBatcherPhase1Module address'
require_rg "DeploymentBatcherPhase2Module | \`$phase2_module\`" "$ADDRESSES_DOC" 'DeploymentBatcherPhase2Module address'
require_rg "DeploymentBatcherPhase3Helper | \`$phase3_helper\`" "$ADDRESSES_DOC" 'DeploymentBatcherPhase3Helper address'
require_rg "DeploymentBatcherShareMeshHelper | \`$share_mesh_helper\`" "$ADDRESSES_DOC" 'DeploymentBatcherShareMeshHelper address'
require_rg "DeploymentBatcherUtilsHelper | \`$utils_helper\`" "$ADDRESSES_DOC" 'DeploymentBatcherUtilsHelper address'

require_rg '`v1.19.0` bytecode/CREATE2 target for new per-creator vaults.' "$INVENTORY_DOC" 'inventory v1.19.0 scope'
require_rg "\`solanaBridgeAdapter\` | \`$solana_adapter\`" "$INVENTORY_DOC" 'inventory SolanaBridgeAdapter address'
require_rg "\`lotteryManager\` | \`$lottery_manager\`" "$INVENTORY_DOC" 'inventory LotteryManager4626 address'
require_rg "\`bytecodeStore\` | \`$bytecode_store\`" "$INVENTORY_DOC" 'inventory bytecodeStore address'
require_rg "\`create2DeployerFromStore\` | \`$create2_from_store\`" "$INVENTORY_DOC" 'inventory create2DeployerFromStore address'
require_rg "\`deploymentBatcher\` | \`$batcher\`" "$INVENTORY_DOC" 'inventory deploymentBatcher address'
require_rg "\`deploymentBatcherPhase1Module\` | \`$phase1_module\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase1Module address'
require_rg "\`deploymentBatcherPhase2Module\` | \`$phase2_module\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase2Module address'
require_rg "\`deploymentBatcherPhase3Helper\` | \`$phase3_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase3Helper address'
require_rg "\`deploymentBatcherShareMeshHelper\` | \`$share_mesh_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherShareMeshHelper address'
require_rg "\`deploymentBatcherUtilsHelper\` | \`$utils_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherUtilsHelper address'

require_rg "SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('${batcher#0x}')" "$DEFAULTS" 'frontend split Phase-1 batcher constant'
require_rg "solanaBridgeAdapter: addr('${solana_adapter#0x}')," "$DEFAULTS" 'frontend SolanaBridgeAdapter default'
require_rg "lotteryManager: addr('${lottery_manager#0x}')," "$DEFAULTS" 'frontend LotteryManager4626 default'
require_rg "universalBytecodeStore: addr('${bytecode_store#0x}')," "$DEFAULTS" 'frontend bytecode store default'
require_rg "universalCreate2DeployerFromStore: addr('${create2_from_store#0x}')," "$DEFAULTS" 'frontend create2 deployer default'
require_rg "payoutRouterFactory: addr('0000000000000000000000000000000000000000')," "$DEFAULTS" 'frontend zero payoutRouterFactory default'
require_rg "deploymentBatcher: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" 'frontend deploymentBatcher default'
require_rg "deploymentBatcherAutoHandoff: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" 'frontend deploymentBatcherAutoHandoff default'
require_rg "'$solana_adapter' as const;" "$KPR_SOLANA_CANONICAL" 'KPR canonical SolanaBridgeAdapter'
require_rg "'$lottery_manager' as const;" "$KPR_SOLANA_CANONICAL" 'KPR canonical LotteryManager4626'
require_rg '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1' "$KPR_SOLANA_SEED_ENV" 'KPR retired v1.13 SolanaBridgeAdapter migration'
require_rg '0x5c0115589d7F4930A0dc93417aE409f44186f4E7' "$KPR_SOLANA_SEED_ENV" 'KPR retired v1.13 LotteryManager migration'
require_rg '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1' "$KPR_SOLANA_SEED_ENV" 'KPR superseded v1.18 LotteryManager migration'

require_rg "VAULT_BATCHER = $batcher;" "$SEED_REGISTRY" 'SeedRegistry4626 VAULT_BATCHER'
require_rg "VAULT_ACT_BATCHER = $activation_batcher;" "$SEED_REGISTRY" 'SeedRegistry4626 VAULT_ACT_BATCHER'
require_rg "DEFAULT_REGISTRY = $registry;" "$SEED_REGISTRY" 'SeedRegistry4626 registry'
require_rg "LOTTERY_MANAGER = $lottery_manager;" "$SEED_REGISTRY" 'SeedRegistry4626 lottery manager'
require_rg "DEFAULT_REGISTRY = $registry;" "$REWARDS_DEPLOY" 'rewards registry'
require_rg "DEFAULT_LOTTERY_MANAGER = $lottery_manager;" "$REWARDS_DEPLOY" 'rewards lottery manager'
require_rg "LOTTERY_MANAGER=\"\${LOTTERY_MANAGER:-$lottery_manager}\"" "$POST_BROADCAST" 'post-broadcast lottery manager'
require_rg "LOTTERY_MANAGER=\"\${LOTTERY_MANAGER:-$lottery_manager}\"" "$VERCEL_SYNC" 'Vercel sync lottery manager'

for retired_script in \
  "$ROOT_DIR/script/DeployLotteryManagerCreate2.s.sol" \
  "$ROOT_DIR/script/DeployLotteryManagerCreate2V2.s.sol" \
  "$ROOT_DIR/script/OperationalWiring.s.sol" \
  "$ROOT_DIR/script/DeployCoreInfraV2Extras.s.sol" \
  "$ROOT_DIR/script/DeployTier1Upgrade.s.sol"; do
  require_rg 'revert DeprecatedDeploymentScript();' "$retired_script" 'deprecated-script fail-closed guard'
done

if rg "$deprecated_batchers" "$DEFAULTS" "$SEED_REGISTRY" >/dev/null; then
  echo "active deploy defaults still reference a deprecated creator-vault batcher" >&2
  exit 1
fi

stale_adapter_hits="$(
  rg "$deprecated_solana_adapters" \
    frontend/src frontend/server frontend/api kpr script \
    --glob '!**/*.test.ts' \
    --glob '!kpr/utils/solanaCanonicalAddresses.ts' \
    --glob '!script/OperationalWiring.s.sol' \
    --glob '!script/DeployLotteryManagerCreate2V2.s.sol' \
    --glob '!script/DeployTier1Upgrade.s.sol' \
    --glob '!docs/**' \
    --glob '!deployments/**' \
    2>/dev/null |
    rg -v 'KPR_SOLANA_LEGACY_BRIDGE_ADAPTERS|DEPRECATED_SOLANA_ADAPTERS' || true
)"
if [[ -n "$stale_adapter_hits" ]]; then
  echo "active code still references a deprecated SolanaBridgeAdapter address:" >&2
  echo "$stale_adapter_hits" >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  if [[ ! -f "$CURRENT_MANIFEST" ]]; then
    echo "release target guard failed: missing ${CURRENT_MANIFEST}" >&2
    exit 1
  fi

  source_manifest="$(mktemp)"
  trap 'rm -f "$source_manifest"' EXIT
  BYTECODE_MANIFEST_OUT="$source_manifest" \
    "$ROOT_DIR/script/generate_bytecode_manifest.sh" "$CURRENT_RELEASE" >/dev/null
  if ! diff -u \
    <(jq -S '.contracts | map_values(.codeId)' "$source_manifest") \
    <(jq -S '.contracts | map_values(.codeId)' "$CURRENT_MANIFEST") >/dev/null; then
    echo "release target guard failed: ${CURRENT_RELEASE} manifest does not match current source artifacts" >&2
    exit 1
  fi

  if [[ "${CURRENT_RELEASE_GUARD_SOURCE_ONLY:-0}" != "1" ]]; then
    if ! BYTECODE_MANIFEST="$CURRENT_MANIFEST" \
      UNIVERSAL_BYTECODE_STORE="$bytecode_store" \
      pnpm -C "$ROOT_DIR/frontend" exec tsx scripts/ops/verify-bytecode-store-seeded.ts >/dev/null; then
      echo "release target guard failed: deploy versioning verifier failed" >&2
      exit 1
    fi
  fi
fi

echo "current split Phase-1 release target guard passed"
