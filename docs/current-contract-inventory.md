# Current Contract Inventory (Base)

Generated on: 2026-02-28  
Scope: 4626 deploy stack and related infra used by this repo.

## Sources

1. Live onchain batcher (phased deployer): `0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753`
2. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
3. Deployment manifests: `deployments/base/contracts/**/*.json`
4. Local env snapshot: `.env`

## Live Onchain (Authoritative For Current Deploy Path)

Queried from the deployment batcher at `0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753`:

| Contract / Field | Address |
|---|---|
| `registry` | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| `bytecodeStore` | `0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c` |
| `create2Deployer` | `0x0243F14771054c890E5Ef5D467D0137a20B2d94B` |
| `protocolTreasury` | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| `poolManager` | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| `taxHook` | `0xca975B9dAF772C71161f3648437c3616E5Be0088` |
| `chainlinkEthUsd` | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` |
| `vaultActivationBatcher` | `0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB` |
| `lotteryManager` | `0x77705A2f173dd52F28300447506Dc35086c34626` |
| `solanaBridgeAdapter` | `0x0000000000000000000000000000000000000000` |
| `solanaDestination` | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| `uniswapV3Factory` | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` |
| `uniswapRouter` | `0x2626664c2603336E57B271c5C0b26F421741e481` |
| `ajnaFactory` | `0x214f62B5836D83f3D6c4f71F174209097B1A779C` |
| `CHARM_FACTORY` | `0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa` |

## Frontend Defaults (Runtime Config Defaults)

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| `lotteryManager` | `0x77705A2f173dd52F28300447506Dc35086c34626` |
| `vrfConsumer` | `0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304` |
| `vaultActivationBatcher` | `0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB` |
| `creatorVaultBatcher` | `0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753` |
| `solanaBridgeAdapter` | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` |
| `universalBytecodeStore` | `0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c` |
| `universalCreate2DeployerFromStore` | `0x0243F14771054c890E5Ef5D467D0137a20B2d94B` |

## Deployment Manifests (Historical/Script Outputs)

From `deployments/base/contracts/**/*.json`:

| Contract | Address | Deployed At |
|---|---|---|
| CreatorRegistry | `0x02c8031c39E10832A831b954Df7a2c1bf9Df052D` | `2026-01-14` |
| CreatorOVaultFactory | `0xcCa08f9b94dD478266D0D1D2e9B7758414280FfD` | `2026-01-14` |
| UniversalCreate2DeployerFromStore | `0xDb65C152B0496208A117FF7C04ddd5039F3035c6` | `2026-01-14` |
| VaultActivationBatcher | `0x4b67e3a4284090e5191c27B8F24248eC82DF055D` | `2026-01-14` |
| UniversalBytecodeStore | `0xCDf45B94348DBBABba4bE6f4a5341badb83D4dC4` | `2026-01-14` |
| CreatorLotteryManager | `0xA02A858E67c98320dCFB218831B645692E8f3483` | `2026-01-14` |
| CreatorVRFConsumerV2_5 | `0x0265236984DE964CB0422BaeFbDb2de7C9d590F5` | `2026-01-14` |
| SolanaBridgeAdapter | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` | `2026-02-22T06:16:05Z` |

## Current Drift (Needs Canonical Decision)

1. Deployment manifests are historical and still include older infra addresses (`0xA02A...`, `0xDb65...`, `0xCDf4...`).
2. Live phased deployer has Solana routing enabled (`solanaBridgeAdapter` + `solanaDestination` are set).
3. Legacy `CreatorOVaultFactory` remains in manifests/scripts but is not used in phased deploy runtime.

## Usage Notes

1. `CreatorOVaultFactory` is not part of the current phased deploy execution (deployment-batcher path).
2. Runtime app paths now resolve `ccaStrategy` from batcher events / registry-derived resolution and do not require factory reads.
3. Remaining `CreatorOVaultFactory` references are legacy scripts/docs and optional historical manifests.

## Recommended Canonical Source

For deploy-path correctness, treat live phased deployer immutables as canonical until you rotate to a new deployer address, then update:

1. `frontend/src/config/contracts.defaults.ts`
2. `frontend/server/_lib/contracts.ts` (via same defaults file)
3. Vercel env overrides (remove stale overrides unless intentionally set)
4. `deployments/base/contracts/**/*.json` (backfill with current infra generation)
