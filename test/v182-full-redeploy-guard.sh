#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PACKET="$ROOT_DIR/docs/operations/deployment/releases/v1.8.2-mainnet.md"
ADDRESSES_DOC="$ROOT_DIR/docs/reference/addresses.md"
INVENTORY_DOC="$ROOT_DIR/docs/reference/current-contract-inventory.md"
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
rg '^# v1\.8\.2 Mainnet Release Packet$' "$PACKET" >/dev/null
rg 'deployments/base/v1\.8\.2-bytecode-manifest\.json' "$PACKET" >/dev/null
rg '0x79d0d68904BbB50361C9721CbDD17276E046771D' "$PACKET" >/dev/null
rg '0x721420F190cc4525bb8Adc72D4c66eEB806AFC37' "$PACKET" >/dev/null
rg '0xc8050cfeDA4CCd04079f37f1D95cD54279156E46' "$PACKET" >/dev/null
if rg 'retained shared|planned vanity|v1\.8\.1-vanity-manifest|shared-global-vanity-targets|\.{3}4626' "$PACKET" >/dev/null; then
  echo "v1.8.2 full-release packet still contains retained-shared or vanity-era assumptions" >&2
  exit 1
fi

rg '0x79d0d68904BbB50361C9721CbDD17276E046771D' "$ADDRESSES_DOC" >/dev/null
rg '0x721420F190cc4525bb8Adc72D4c66eEB806AFC37' "$ADDRESSES_DOC" >/dev/null
if rg 'planned vanity|v1\.8\.1|0x888506B92181c57A2fD06516FFFb6F375b7A4626' "$ADDRESSES_DOC" >/dev/null; then
  echo "addresses reference still points at the pre-v1.8.2 shared/global epoch" >&2
  exit 1
fi

rg 'Scope: `v1\.8\.2` full-redeploy release packet and current canonical Base defaults\.' "$INVENTORY_DOC" >/dev/null
rg '0x79d0d68904BbB50361C9721CbDD17276E046771D' "$INVENTORY_DOC" >/dev/null
rg '0x721420F190cc4525bb8Adc72D4c66eEB806AFC37' "$INVENTORY_DOC" >/dev/null
if rg 'vanity|retained|v1\.8\.1' "$INVENTORY_DOC" >/dev/null; then
  echo "current inventory still describes the abandoned vanity/retained-shared release path" >&2
  exit 1
fi

rg "registry: addr\('79d0d68904BbB50361C9721CbDD17276E046771D'\)," "$DEFAULTS" >/dev/null
rg "lotteryManager: addr\('A137BEef789B80c76187E1b6DEef60fC7db6d280'\)," "$DEFAULTS" >/dev/null
rg "vrfConsumer: addr\('22ae936027Fe0c348758634bF8694E00D96338ac'\)," "$DEFAULTS" >/dev/null
rg "solanaBridgeAdapter: addr\('1B3E713852dEC5d983AD11BD1567eed0723ceA9b'\)," "$DEFAULTS" >/dev/null
rg "universalBytecodeStore: addr\('c8050cfeDA4CCd04079f37f1D95cD54279156E46'\)," "$DEFAULTS" >/dev/null
rg "universalCreate2DeployerFromStore: addr\('95700DA39462f97b0E874ED7e05BBF76413d7Ac1'\)," "$DEFAULTS" >/dev/null
rg "vaultActivationBatcher: addr\('8b63912cD2490D1Ab0796c57Cc5909fF0059CECd'\)," "$DEFAULTS" >/dev/null
rg "creatorVaultBatcher: addr\('721420F190cc4525bb8Adc72D4c66eEB806AFC37'\)," "$DEFAULTS" >/dev/null
rg "creatorVaultBatcherAutoHandoff: addr\('721420F190cc4525bb8Adc72D4c66eEB806AFC37'\)," "$DEFAULTS" >/dev/null

rg "DEFAULT_DEPLOYMENT_VERSION = 'v1\.8\.2'" "$DEPLOY_PAGE" >/dev/null
rg "\?\? 'v1\.8\.2'" "$TRACKER" >/dev/null
rg "return v.length > 0 \? v : 'v1\.8\.2'" "$TRACKER" >/dev/null
rg "const DEFAULT_VERSION = 'v1\.8\.2'" "$TELEGRAM_PARSER" >/dev/null
rg 'v1\.8\.2-dryrun' "$DRYRUN_ENV" >/dev/null

rg '^CREATOR_REGISTRY=0x79d0d68904BbB50361C9721CbDD17276E046771D$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_FACTORY=0xb66aA49d94569a8589f380D53e8a3f1F60165000$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_LOTTERY_MANAGER=0xA137BEef789B80c76187E1b6DEef60fC7db6d280$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_VRF_CONSUMER=0x22ae936027Fe0c348758634bF8694E00D96338ac$' "$ROOT_ENV" >/dev/null
rg '^VAULT_ACTIVATION_BATCHER=0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd$' "$ROOT_ENV" >/dev/null
rg '^SOLANA_BRIDGE_ADAPTER=0x1B3E713852dEC5d983AD11BD1567eed0723ceA9b$' "$ROOT_ENV" >/dev/null
rg '^UNIVERSAL_BYTECODE_STORE=0xc8050cfeDA4CCd04079f37f1D95cD54279156E46$' "$ROOT_ENV" >/dev/null
rg '^UNIVERSAL_CREATE2_FROM_STORE=0x95700DA39462f97b0E874ED7e05BBF76413d7Ac1$' "$ROOT_ENV" >/dev/null
rg '^CREATOR_VAULT_BATCHER=0x721420F190cc4525bb8Adc72D4c66eEB806AFC37$' "$ROOT_ENV" >/dev/null
rg '^DEPLOYMENT_BATCHER=0x721420F190cc4525bb8Adc72D4c66eEB806AFC37$' "$ROOT_ENV" >/dev/null
if rg '0x888506B92181c57A2fD06516FFFb6F375b7A4626|0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3|0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304|0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB|0x6A578022609cdb65C614FF28912C49FC1EC97071|0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a|0x14435cc4A8D307b4d3979148E5AB71Af1ed19088|0x2414b595c4f18532A5836B6e2E6d536832c572e8|v1\.7\.1' "$ROOT_ENV" >/dev/null; then
  echo ".env.example still points at pre-v1.8.2 Base infra" >&2
  exit 1
fi

rg '^VITE_DEPLOYMENT_VERSION=v1\.8\.2$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_REGISTRY=0x79d0d68904BbB50361C9721CbDD17276E046771D$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_LOTTERY_MANAGER=0xA137BEef789B80c76187E1b6DEef60fC7db6d280$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_VRF_CONSUMER=0x22ae936027Fe0c348758634bF8694E00D96338ac$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_VAULT_ACTIVATION_BATCHER=0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_FACTORY=0xb66aA49d94569a8589f380D53e8a3f1F60165000$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_CREATOR_VAULT_BATCHER=0x721420F190cc4525bb8Adc72D4c66eEB806AFC37$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_SOLANA_BRIDGE_ADAPTER=0x1B3E713852dEC5d983AD11BD1567eed0723ceA9b$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_UNIVERSAL_BYTECODE_STORE=0xc8050cfeDA4CCd04079f37f1D95cD54279156E46$' "$FRONTEND_ENV" >/dev/null
rg '^VITE_UNIVERSAL_CREATE2_DEPLOYER=0x95700DA39462f97b0E874ED7e05BBF76413d7Ac1$' "$FRONTEND_ENV" >/dev/null
if rg '0x888506B92181c57A2fD06516FFFb6F375b7A4626|0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3|0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304|0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB|0x6A578022609cdb65C614FF28912C49FC1EC97071|0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a|0x14435cc4A8D307b4d3979148E5AB71Af1ed19088|0x2414b595c4f18532A5836B6e2E6d536832c572e8|VITE_DEPLOYMENT_VERSION=v1\.7\.1' "$FRONTEND_ENV" >/dev/null; then
  echo "frontend/.env.example still points at pre-v1.8.2 Base infra" >&2
  exit 1
fi

rg 'DEFAULT_REGISTRY = 0x79d0d68904BbB50361C9721CbDD17276E046771D;' "$BASE_DEPLOYER" >/dev/null
rg 'DEFAULT_VAULT_ACTIVATION_BATCHER = 0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd;' "$BASE_DEPLOYER" >/dev/null
rg 'DEFAULT_LOTTERY_MANAGER = 0xA137BEef789B80c76187E1b6DEef60fC7db6d280;' "$BASE_DEPLOYER" >/dev/null
rg 'DEFAULT_REGISTRY = 0x79d0d68904BbB50361C9721CbDD17276E046771D;' "$SEED_REGISTRY" >/dev/null
rg 'VAULT_ACT_BATCHER = 0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd;' "$SEED_REGISTRY" >/dev/null
rg 'DEFAULT_BYTECODE_STORE = 0xc8050cfeDA4CCd04079f37f1D95cD54279156E46;' "$SEED_STORE" >/dev/null
rg 'DEFAULT_CREATOR_REGISTRY = 0x79d0d68904BbB50361C9721CbDD17276E046771D;' "$SOLANA_ADAPTER" >/dev/null
rg 'DEFAULT_LOTTERY_MANAGER = 0xA137BEef789B80c76187E1b6DEef60fC7db6d280;' "$SOLANA_ADAPTER" >/dev/null

echo "v1.8.2 full redeploy guard passed"
