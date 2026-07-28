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
KPR_REGISTRY="$ROOT_DIR/kpr/utils/registry.ts"
KPR_SOLANA_SEED_ENV="$ROOT_DIR/kpr/deploy/seed-solana-orchestrator-env.sh"
BATCHER_REGISTRY_AUTH="$ROOT_DIR/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts"
DEPLOY_VAULT_PAGE="$ROOT_DIR/frontend/src/pages/deploy/DeployVault.tsx"
CURRENT_RELEASE="v1.20.0"
CURRENT_MANIFEST="$ROOT_DIR/deployments/base/${CURRENT_RELEASE}-bytecode-manifest.json"
# The production deploy payload is the checked-in DEPLOY_BYTECODE bundle, not
# whatever unrelated contract sources happen to compile in the worktree. The
# verifier below binds that exact bundle to this manifest and to bytes already
# seeded in the live store.

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

require_rg_regex() {
  local pattern="$1"
  local file="$2"
  local label="$3"

  if ! rg -U "$pattern" "$file" >/dev/null; then
    echo "release target guard failed: missing ${label} in ${file}" >&2
    exit 1
  fi
}

load_env_key_if_unset BASE_RPC_URL "$ROOT_DIR/frontend/.env.local"
load_env_key_if_unset BASE_RPC_URL "$ROOT_DIR/frontend/.env"

registry="0xF60a1490C4129f2b6ae540734D3C2C8C6111824e"
factory="0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5"
activation_batcher="0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3"
bytecode_store="0x8599CA87b28320158941C59CB3cd9a3f12083530"
create2_from_store="0xdffB25505F5050E15B3602296330Ef352127d1Ef"
batcher="0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032"
lottery_manager="0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b"
core_module="0xD6B862783Fd362ccF0d39d86E6384D8770e78833"
strategies_module="0x968b8233053B64A93a4Cde044fFf4f43ea6D3c60"
admin_module="0x5bC4d71dB82081fCCF3647F1C094BEB202C0DB50"
phase1_module="0x416FA15e40caA51C20d1795db946c6806C946aC5"
phase2_module="0xf1334BE96B3530BBF17506DED98E50D917A45B41"
phase3_helper="0x3Ed642288cd03846e9dA956cF95812d3125dD274"
share_mesh_helper="0x1BCd4768180671Aa435C845239e05Afc81a496cA"
utils_helper="0x99712E96f11670113f66b9356890a2209359C37d"

deprecated_batchers='0x56E8527Bf0824155e1556aED5740366f248B68ca|0x32403a647e73e04ae42b02bdd1ade9c88698fd0c|0xe3F9490CfD6bd3D68010405d18Bf772C167E7178|0xcDbEeB764df9878ebAFbf101cc818370f703bC4F|0x004684670d284EF607E1B2424fcf8ccBda8ef828|0x271Ab2C53D79d52ddB14506a44133Fe3FA395332|0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8|0xa99058f424FB3ACC639F59355C65C40149030651|0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1|0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33|0xA9024e1B89C5Be34502A275576Cc137473d65839|0x02D7abC547F8B1e7E2D7a919D8D1005918361750|0xa18169caf37fa0347285B16aAFC2B09eCB43F145'
deprecated_solana_adapters='0x2414b595c4f18532A5836B6e2E6d536832c572e8|0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5|0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00|0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1|0x700b4BBAf965c013123bAd02a6562FBa487aC0f1|0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae'

require_rg 'new per-creator launches use the' "$ADDRESSES_DOC" 'addresses doc greenfield title'
require_rg '**v1.20.0**' "$ADDRESSES_DOC" 'addresses doc v1.20.0 epoch'
require_rg '### Current infrastructure' "$ADDRESSES_DOC" 'addresses doc current infrastructure heading'
for spec in \
  "Registry4626|$registry" \
  "OVaultFactory4626|$factory" \
  "VaultActivationBatcher|$activation_batcher" \
  "UniversalBytecodeStoreV2|$bytecode_store" \
  "UniversalCreate2DeployerFromStore|$create2_from_store" \
  "CreatorOVaultCoreModule|$core_module" \
  "CreatorOVaultStrategiesModule|$strategies_module" \
  "CreatorOVaultAdminModule|$admin_module" \
  "DeploymentBatcher|$batcher" \
  "LotteryManager4626|$lottery_manager" \
  "DeploymentBatcherPhase1Module|$phase1_module" \
  "DeploymentBatcherPhase2Module|$phase2_module" \
  "DeploymentBatcherPhase3Helper|$phase3_helper" \
  "DeploymentBatcherShareMeshHelper|$share_mesh_helper" \
  "DeploymentBatcherUtilsHelper|$utils_helper"; do
  label="${spec%%|*}"
  value="${spec#*|}"
  require_rg_regex "\\|[[:space:]]*${label}[[:space:]]*\\|[[:space:]]*\\x60${value}\\x60" "$ADDRESSES_DOC" "${label} address"
done

require_rg '`v1.20.0`' "$INVENTORY_DOC" 'inventory v1.20.0 scope'
require_rg "\`lotteryManager\` | \`$lottery_manager\`" "$INVENTORY_DOC" 'inventory LotteryManager4626 address'
require_rg "\`bytecodeStore\` | \`$bytecode_store\`" "$INVENTORY_DOC" 'inventory bytecodeStore address'
require_rg "\`create2DeployerFromStore\` | \`$create2_from_store\`" "$INVENTORY_DOC" 'inventory create2DeployerFromStore address'
require_rg "\`deploymentBatcher\` | \`$batcher\`" "$INVENTORY_DOC" 'inventory deploymentBatcher address'
require_rg "\`deploymentBatcherPhase1Module\` | \`$phase1_module\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase1Module address'
require_rg "\`deploymentBatcherPhase2Module\` | \`$phase2_module\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase2Module address'
require_rg "\`deploymentBatcherPhase3Helper\` | \`$phase3_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherPhase3Helper address'
require_rg "\`deploymentBatcherShareMeshHelper\` | \`$share_mesh_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherShareMeshHelper address'
require_rg "\`deploymentBatcherUtilsHelper\` | \`$utils_helper\`" "$INVENTORY_DOC" 'inventory deploymentBatcherUtilsHelper address'

require_rg_regex "SPLIT_PHASE1_DEPLOYMENT_BATCHER[[:space:]]*=[[:space:]]*addr\\([^;]*['\"]${batcher#0x}['\"]" "$DEFAULTS" 'frontend split Phase-1 batcher constant'
require_rg_regex "SPLIT_PHASE1_PHASE1_MODULE[[:space:]]*=[[:space:]]*addr\\([^;]*['\"]${phase1_module#0x}['\"]" "$DEFAULTS" 'frontend live Phase1Module constant'
require_rg_regex "SPLIT_PHASE1_PHASE2_MODULE[[:space:]]*=[[:space:]]*addr\\([^;]*['\"]${phase2_module#0x}['\"]" "$DEFAULTS" 'frontend live Phase2Module constant'

if rg -n 'solanaBridgeAdapter' "$DEFAULTS" >/dev/null; then
  echo "release target guard failed: frontend contracts.defaults still exports solanaBridgeAdapter (LZ ShareOFT only)" >&2
  exit 1
fi

if find "$ROOT_DIR/contracts" -name 'SolanaBridgeAdapter.sol' -print -quit | grep -q .; then
  echo "release target guard failed: SolanaBridgeAdapter.sol still present under contracts/ (Twin adapter removed)" >&2
  exit 1
fi

require_rg_regex "lotteryManager:[[:space:]]*addr\\(['\"]${lottery_manager#0x}['\"]\\)" "$DEFAULTS" 'frontend LotteryManager4626 default'
require_rg_regex "universalBytecodeStore:[[:space:]]*addr\\(['\"]${bytecode_store#0x}['\"]\\)" "$DEFAULTS" 'frontend bytecode store default'
require_rg_regex "universalCreate2DeployerFromStore:[[:space:]]*addr\\([^;]*['\"]${create2_from_store#0x}['\"]" "$DEFAULTS" 'frontend create2 deployer default'
require_rg_regex "payoutRouterFactory:[[:space:]]*addr\\(['\"]0000000000000000000000000000000000000000['\"]\\)" "$DEFAULTS" 'frontend zero payoutRouterFactory default'
require_rg "deploymentBatcher: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" 'frontend deploymentBatcher default'
require_rg "deploymentBatcherAutoHandoff: SPLIT_PHASE1_DEPLOYMENT_BATCHER" "$DEFAULTS" 'frontend deploymentBatcherAutoHandoff default'
require_rg_regex "['\"]$lottery_manager['\"][[:space:]]+as[[:space:]]+const" "$KPR_SOLANA_CANONICAL" 'KPR canonical LotteryManager4626'
require_rg_regex "DEFAULT_REGISTRY_4626 = ['\"]$registry['\"]" "$KPR_REGISTRY" 'KPR default Registry4626'
require_rg 'BASE_DEFAULTS.registry' "$BATCHER_REGISTRY_AUTH" 'deploy dry-run registry auth uses BASE_DEFAULTS'
require_rg "DEFAULT_DEPLOYMENT_VERSION = 'v1.20.0'" "$DEPLOY_VAULT_PAGE" 'DeployVault default deployment version'
require_rg '0x5c0115589d7F4930A0dc93417aE409f44186f4E7' "$KPR_SOLANA_SEED_ENV" 'KPR retired v1.13 LotteryManager migration'
require_rg '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1' "$KPR_SOLANA_SEED_ENV" 'KPR superseded v1.18 LotteryManager migration'

require_rg "VAULT_BATCHER = $batcher;" "$SEED_REGISTRY" 'SeedRegistry4626 VAULT_BATCHER'
require_rg "VAULT_ACT_BATCHER = $activation_batcher;" "$SEED_REGISTRY" 'SeedRegistry4626 VAULT_ACT_BATCHER'
require_rg "DEFAULT_REGISTRY = $registry;" "$SEED_REGISTRY" 'SeedRegistry4626 registry'
require_rg "OVAULT_FACTORY = $factory;" "$SEED_REGISTRY" 'SeedRegistry4626 OVaultFactory'
require_rg "LOTTERY_MANAGER = $lottery_manager;" "$SEED_REGISTRY" 'SeedRegistry4626 lottery manager'
require_rg "DEFAULT_REGISTRY = $registry;" "$REWARDS_DEPLOY" 'rewards registry'
require_rg "DEFAULT_LOTTERY_MANAGER = $lottery_manager;" "$REWARDS_DEPLOY" 'rewards lottery manager'
require_rg "DEFAULT_REGISTRY = $registry;" "$ROOT_DIR/script/DeployBaseMainnetDeployer.s.sol" 'BaseMainnetDeployer registry'
require_rg "DEFAULT_LOTTERY_MANAGER = $lottery_manager;" "$ROOT_DIR/script/DeployBaseMainnetDeployer.s.sol" 'BaseMainnetDeployer lottery manager'
require_rg "DEFAULT_VAULT_ACTIVATION_BATCHER = $activation_batcher;" "$ROOT_DIR/script/DeployBaseMainnetDeployer.s.sol" 'BaseMainnetDeployer activation batcher'
require_rg "LOTTERY_MANAGER=\"$lottery_manager\"" "$POST_BROADCAST" 'post-broadcast lottery manager'
require_rg "UNIVERSAL_CREATE2_DEPLOYER=\"$create2_from_store\"" "$POST_BROADCAST" 'post-broadcast CREATE2 deployer'
require_rg "DEPLOYMENT_BATCHER_PHASE3_HELPER=\"$phase3_helper\"" "$POST_BROADCAST" 'post-broadcast Phase3 helper'
require_rg "DEPLOYMENT_BATCHER_SHARE_MESH_HELPER=\"$share_mesh_helper\"" "$POST_BROADCAST" 'post-broadcast ShareMesh helper'
require_rg "CREATE2=\"$create2_from_store\"" "$ROOT_DIR/script/authorize-v1180-batcher-deployers.sh" 'authorize-script CREATE2 deployer'
require_rg "FACTORY=\"$factory\"" "$ROOT_DIR/script/authorize-v1180-batcher-deployers.sh" 'authorize-script OVaultFactory'
require_rg "BATCHER=\"$batcher\"" "$ROOT_DIR/script/authorize-v1180-batcher-deployers.sh" 'authorize-script DeploymentBatcher'
require_rg "PHASE3=\"$phase3_helper\"" "$ROOT_DIR/script/authorize-v1180-batcher-deployers.sh" 'authorize-script Phase3 helper'
require_rg "SHARE_MESH=\"$share_mesh_helper\"" "$ROOT_DIR/script/authorize-v1180-batcher-deployers.sh" 'authorize-script ShareMesh helper'
require_rg "LOTTERY_MANAGER=\"$lottery_manager\"" "$VERCEL_SYNC" 'Vercel sync lottery manager'
require_rg "UNIVERSAL_CREATE2_DEPLOYER=\"$create2_from_store\"" "$VERCEL_SYNC" 'Vercel sync CREATE2 deployer'
require_rg "DEPLOYMENT_BATCHER=\"$batcher\"" "$VERCEL_SYNC" 'Vercel sync DeploymentBatcher'
require_rg "REGISTRY=\"$registry\"" "$VERCEL_SYNC" 'Vercel sync Registry4626'
require_rg 'tmp/base-v1.20.0-handoff.env' "$ROOT_DIR/script/authorize-v1180-batcher-deployers.sh" 'authorize-script prefers v1.20.0 handoff'
require_rg 'tmp/base-v1.20.0-handoff.env' "$POST_BROADCAST" 'post-broadcast prefers v1.20.0 handoff'
require_rg 'tmp/base-v1.20.0-handoff.env' "$VERCEL_SYNC" 'Vercel sync prefers v1.20.0 handoff'

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
