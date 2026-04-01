# Current Contract Inventory (Base)

Generated on: 2026-04-01  
Scope: `v1.7.1` deployment reset materials and canonical Base defaults.

## Sources

1. Fresh epoch deterministic outputs (`INFRA_*_SALT_TAG` set to `...:v1.7.1`)
2. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
3. Active manifests: `deployments/base/contracts/**/*.json`
4. Archived prior snapshot: `deployments/base/archive/2026-01-addresses.json`

## Canonical v1.7.1 Infra Targets

| Contract / Field | Address |
|---|---|
| `registry` | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| `bytecodeStore` | `0x6A578022609cdb65C614FF28912C49FC1EC97071` |
| `create2DeployerFromStore` | `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a` |
| `deploymentBatcher` | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` |
| `deploymentBatcherPhase3Helper` | `0x74F204C95F959B7f4f4e927B6c56CF1026f4789F` |
| `creatorOVaultCoreModule` | `0x4890776DA44f014A932dF4a9a1F8dBE648E91e3D` |
| `creatorOVaultStrategiesModule` | `0x1E357B6B7a837CAF75Eb14016d2733779FEed9CE` |
| `creatorOVaultAdminModule` | `0xBF2ab516BAA04aeac061f359a483622Ff006f153` |
| `vaultActivationBatcher` | `0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB` |
| `lotteryManager` | `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` |
| `solanaBridgeAdapter` | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Verification disposition for this epoch:
- `DeploymentBatcherPhase3Helper`: explorer verified
- `DeploymentBatcher`: forensically matched to onchain CREATE2 payload, explorer-unverified (retries closed unless explorer behavior changes)

## Frontend/API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| `creatorVaultBatcher` | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` |
| `creatorVaultBatcherAutoHandoff` | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` |
| `universalBytecodeStore` | `0x6A578022609cdb65C614FF28912C49FC1EC97071` |
| `universalCreate2DeployerFromStore` | `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a` |

## Active Manifests

Current canonical manifests live in `deployments/base/contracts/**/*.json` and are aligned to this reset packet.

The previous `2026-01` address set is archived in:

- `deployments/base/archive/2026-01-addresses.json`

## Bytecode / CodeId Evidence

Release bytecode manifest:

- `deployments/base/v1.7.1-bytecode-manifest.json`

For each deployment contract this includes:

- `creationBytecodeHash`
- `codeId` (`keccak256(creationCode)`)
- bytecode size in bytes

## Canonical Ajna Strategy Inventory

The canonical phase-3 Ajna sleeve remains:

1. `ERC4626StrategyAdapter`
2. `AjnaERC4626Vault`
3. `AjnaVaultAuth`

Deploy/codeId manifests must include all three entries.

## Cutover Checklist

After broadcast of the v1.7.1 epoch:

1. Verify `DeploymentBatcher.bytecodeStore()` and `.create2Deployer()` match this inventory.
2. Verify bytecode pointers for all `v1.7.1` `codeId`s in `UniversalBytecodeStore`.
3. Keep `frontend/src/config/contracts.defaults.ts` and env examples in sync with final onchain values.
