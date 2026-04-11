#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PACKET="$ROOT_DIR/docs/operations/deployment/releases/v1.8.3-mainnet.md"
ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/reference/current-contract-inventory.md"
CREATE2_DOC="$ROOT_DIR/docs/operations/deployment/create2-registry.md"
DEPLOY_GUIDE="$ROOT_DIR/docs/guides/deploy-vault.md"
DEPLOYMENTS_README="$ROOT_DIR/deployments/README.md"
DEFAULTS="$ROOT_DIR/frontend/src/config/contracts.defaults.ts"
TRACKER="$ROOT_DIR/frontend/src/hooks/useDeploymentTracker.ts"
DEPLOY_PAGE="$ROOT_DIR/frontend/src/pages/deploy/DeployVault.tsx"
TELEGRAM_PARSER="$ROOT_DIR/frontend/api/_handlers/telegram/webhook/parsers/vaultDeploy.ts"
DRYRUN_ENV="$ROOT_DIR/frontend/.env.deploy-dry-run.example"
ROOT_ENV="$ROOT_DIR/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
BASE_DEPLOYER="$ROOT_DIR/script/DeployBaseMainnetDeployer.s.sol"
SEED_REGISTRY="$ROOT_DIR/script/SeedCreatorRegistry.s.sol"
SEED_STORE="$ROOT_DIR/script/SeedUniversalBytecodeStore.s.sol"
SOLANA_ADAPTER="$ROOT_DIR/script/DeploySolanaBridgeAdapter.s.sol"

test -f "$PACKET"
rg '^# v1\.8\.3 Mainnet Release Packet$' "$PACKET" >/dev/null
rg 'deployments/base/v1\.8\.3-bytecode-manifest\.json' "$PACKET" >/dev/null
rg 'Release target: `v1\.8\.3`' "$PACKET" >/dev/null
rg 'Canonical live release packet for the `v1\.8\.3` Base mainnet broadcast completed on `2026-04-11`\.' "$PACKET" >/dev/null
if rg 'retained shared|planned vanity|v1\.8\.1-vanity-manifest|shared-global-vanity-targets|\.{3}4626' "$PACKET" >/dev/null; then
  echo "v1.8.3 release packet still contains retained-shared or vanity-era assumptions" >&2
  exit 1
fi

rg '0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb' "$ADDRESSES_DOC" >/dev/null
rg '0xcDbEeB764df9878ebAFbf101cc818370f703bC4F' "$ADDRESSES_DOC" >/dev/null
rg 'Current Live Infrastructure \(`v1\.8\.3`\)' "$ADDRESSES_DOC" >/dev/null
if rg 'planned vanity|v1\.8\.1|0x888506B92181c57A2fD06516FFFb6F375b7A4626' "$ADDRESSES_DOC" >/dev/null; then
  echo "addresses reference still points at the pre-v1.8.2 shared/global epoch" >&2
  exit 1
fi

rg 'canonical `v1\.8\.3` release target and manifest' "$INVENTORY_DOC" >/dev/null
rg 'docs/operations/deployment/releases/v1\.8\.3-mainnet\.md' "$INVENTORY_DOC" >/dev/null
rg 'deployments/base/v1\.8\.3-bytecode-manifest\.json' "$INVENTORY_DOC" >/dev/null
rg '0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb' "$INVENTORY_DOC" >/dev/null
rg '0xcDbEeB764df9878ebAFbf101cc818370f703bC4F' "$INVENTORY_DOC" >/dev/null
if rg 'vanity|retained|v1\.8\.1' "$INVENTORY_DOC" >/dev/null; then
  echo "current inventory still describes the abandoned vanity/retained-shared release path" >&2
  exit 1
fi

rg "registry: addr\('9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb'\)," "$DEFAULTS" >/dev/null
rg "lotteryManager: addr\('d593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357'\)," "$DEFAULTS" >/dev/null
rg "vrfConsumer: addr\('dd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47'\)," "$DEFAULTS" >/dev/null
rg "solanaBridgeAdapter: addr\('90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00'\)," "$DEFAULTS" >/dev/null
rg "universalBytecodeStore: addr\('A009B1Bf8cB711c115d832AEb392156BA6A4112e'\)," "$DEFAULTS" >/dev/null
rg "universalCreate2DeployerFromStore: addr\('Fd2657b6f1905C3F0494942F618a68963CF792Ec'\)," "$DEFAULTS" >/dev/null
rg "vaultActivationBatcher: addr\('7Cc0050842433968cc7A0884d192b61FD0b46F63'\)," "$DEFAULTS" >/dev/null
rg "creatorVaultBatcher: addr\('cDbEeB764df9878ebAFbf101cc818370f703bC4F'\)," "$DEFAULTS" >/dev/null
rg "creatorVaultBatcherAutoHandoff: addr\('cDbEeB764df9878ebAFbf101cc818370f703bC4F'\)," "$DEFAULTS" >/dev/null

rg 'canonical live `v1\.8\.3` Base infra epoch' "$CREATE2_DOC" >/dev/null
rg '2026-04-11' "$CREATE2_DOC" >/dev/null
rg '0xcDbEeB764df9878ebAFbf101cc818370f703bC4F' "$CREATE2_DOC" >/dev/null

rg 'Current live Base defaults come from the `2026-04-11` `v1\.8\.3` broadcast:' "$DEPLOY_GUIDE" >/dev/null
rg 'export NEW_BATCHER=0xcDbEeB764df9878ebAFbf101cc818370f703bC4F' "$DEPLOY_GUIDE" >/dev/null
rg 'export SOLANA_BRIDGE_ADAPTER=0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00' "$DEPLOY_GUIDE" >/dev/null

rg 'broadcast on `2026-04-11`' "$DEPLOYMENTS_README" >/dev/null

rg "DEFAULT_DEPLOYMENT_VERSION = 'v1\.8\.3'" "$DEPLOY_PAGE" >/dev/null
rg "\?\? 'v1\.8\.3'" "$TRACKER" >/dev/null
rg "return v.length > 0 \? v : 'v1\.8\.3'" "$TRACKER" >/dev/null
rg "const DEFAULT_VERSION = 'v1\.8\.3'" "$TELEGRAM_PARSER" >/dev/null
rg 'v1\.8\.3-dryrun' "$DRYRUN_ENV" >/dev/null

rg '^CREATOR_REGISTRY=0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_FACTORY=0xC7E919899Fd4C0C4f6f4269a63046107f85848bB$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_LOTTERY_MANAGER=0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_VRF_CONSUMER=0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47$' "$ROOT_ENV" >/dev/null
rg '^VAULT_ACTIVATION_BATCHER=0x7Cc0050842433968cc7A0884d192b61FD0b46F63$' "$ROOT_ENV" >/dev/null
rg '^SOLANA_BRIDGE_ADAPTER=0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00$' "$ROOT_ENV" >/dev/null
rg '^UNIVERSAL_BYTECODE_STORE=0xA009B1Bf8cB711c115d832AEb392156BA6A4112e$' "$ROOT_ENV" >/dev/null
rg '^UNIVERSAL_CREATE2_FROM_STORE=0xFd2657b6f1905C3F0494942F618a68963CF792Ec$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_VAULT_BATCHER=0xcDbEeB764df9878ebAFbf101cc818370f703bC4F$' "$ROOT_ENV" >/dev/null
rg '^DEPLOYMENT_BATCHER=0xcDbEeB764df9878ebAFbf101cc818370f703bC4F$' "$ROOT_ENV" >/dev/null
if rg '0x888506B92181c57A2fD06516FFFb6F375b7A4626|0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3|0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304|0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB|0x6A578022609cdb65C614FF28912C49FC1EC97071|0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a|0x14435cc4A8D307b4d3979148E5AB71Af1ed19088|0x2414b595c4f18532A5836B6e2E6d536832c572e8|v1\.7\.1' "$ROOT_ENV" >/dev/null; then
  echo ".env.example still points at legacy Base infra" >&2
  exit 1
fi

rg '^VITE_DEPLOYMENT_VERSION=v1\.8\.3$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_REGISTRY=0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_LOTTERY_MANAGER=0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_VRF_CONSUMER=0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_VAULT_ACTIVATION_BATCHER=0x7Cc0050842433968cc7A0884d192b61FD0b46F63$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_FACTORY=0xC7E919899Fd4C0C4f6f4269a63046107f85848bB$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_CREATOR_VAULT_BATCHER=0xcDbEeB764df9878ebAFbf101cc818370f703bC4F$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_SOLANA_BRIDGE_ADAPTER=0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_UNIVERSAL_BYTECODE_STORE=0xA009B1Bf8cB711c115d832AEb392156BA6A4112e$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_UNIVERSAL_CREATE2_DEPLOYER=0xFd2657b6f1905C3F0494942F618a68963CF792Ec$' "$FRONTEND_ENV" >/dev/null
if rg '0x888506B92181c57A2fD06516FFFb6F375b7A4626|0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3|0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304|0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB|0x6A578022609cdb65C614FF28912C49FC1EC97071|0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a|0x14435cc4A8D307b4d3979148E5AB71Af1ed19088|0x2414b595c4f18532A5836B6e2E6d536832c572e8|VITE_DEPLOYMENT_VERSION=v1\.7\.1' "$FRONTEND_ENV" >/dev/null; then
  echo "frontend/.env.example still points at legacy Base infra" >&2
  exit 1
fi

rg 'DEFAULT_REGISTRY = 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb;' "$BASE_DEPLOYER" >/dev/null
rg 'DEFAULT_VAULT_ACTIVATION_BATCHER = 0x7Cc0050842433968cc7A0884d192b61FD0b46F63;' "$BASE_DEPLOYER" >/dev/null
rg 'DEFAULT_LOTTERY_MANAGER = 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357;' "$BASE_DEPLOYER" >/dev/null
rg 'DEFAULT_REGISTRY = 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb;' "$SEED_REGISTRY" >/dev/null
rg 'VAULT_ACT_BATCHER = 0x7Cc0050842433968cc7A0884d192b61FD0b46F63;' "$SEED_REGISTRY" >/dev/null
rg 'DEFAULT_BYTECODE_STORE = 0xA009B1Bf8cB711c115d832AEb392156BA6A4112e;' "$SEED_STORE" >/dev/null
rg 'DEFAULT_CREATOR_REGISTRY = 0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb;' "$SOLANA_ADAPTER" >/dev/null
rg 'DEFAULT_LOTTERY_MANAGER = 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357;' "$SOLANA_ADAPTER" >/dev/null

echo "v1.8.3 release target guard passed"
