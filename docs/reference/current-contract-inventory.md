---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-04-29
Scope: current live Base infra addresses plus the canonical `v1.9.2` split Phase-1 deployment stack for new per-creator vaults.

## Sources

1. Release packet: `docs/operations/deployment/releases/v1.8.3-mainnet.md`
2. Bytecode / codeId manifest: `deployments/base/v1.8.3-bytecode-manifest.json`
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Live deployment snapshots: `deployments/base/contracts/**/*.json`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb` |
| `creatorOVaultFactory` | `0xC7E919899Fd4C0C4f6f4269a63046107f85848bB` |
| `vaultActivationBatcher` | `0x7Cc0050842433968cc7A0884d192b61FD0b46F63` |
| `lotteryManager` | `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357` |
| `vrfConsumer` | `0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47` |
| `solanaBridgeAdapter` | `0x653326dD0145656eC3b598943C0E84d7405aE6Ae` |
| `bytecodeStore` | `0x77e53f656Ee3c5A962e9DA2Fc97EA1A35ae9b4d5` |
| `create2DeployerFromStore` | `0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd` |
| `creatorOVaultCoreModule` | `0xF670590D1070B1C30E8da76176E841b6e753fDb9` |
| `creatorOVaultStrategiesModule` | `0x7cCFA3E1c7eF5ADab9C9676430c27244f8c8ec7A` |
| `creatorOVaultAdminModule` | `0x48512Db9cDddC3f259036605A8eBD3C8e5dE1598` |
| `deploymentBatcher` | `0x004684670d284EF607E1B2424fcf8ccBda8ef828` |
| `deploymentBatcherPhase2Module` | `0x9794735D53dA4f0884eA43E2764A7E4dd2a38826` |
| `deploymentBatcherPhase3Helper` | `0x7e4b2dd557bA62FD1Dd5f72CBf5FFAAaaB8A468c` |
| `deploymentBatcherUniV4Helper` | `0xCd10BEcd96c13b63cEff49A646Eca1fe6D2f2CC7` |
| `deploymentBatcherUtilsHelper` | `0xb79615C6B128E953347fcd6061DeaEc867482EEC` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb` |
| `lotteryManager` | `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357` |
| `vrfConsumer` | `0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47` |
| `solanaBridgeAdapter` | `0x653326dD0145656eC3b598943C0E84d7405aE6Ae` |
| `universalBytecodeStore` | `0x77e53f656Ee3c5A962e9DA2Fc97EA1A35ae9b4d5` |
| `universalCreate2DeployerFromStore` | `0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd` |
| `vaultActivationBatcher` | `0x7Cc0050842433968cc7A0884d192b61FD0b46F63` |
| `creatorVaultBatcher` | `0x004684670d284EF607E1B2424fcf8ccBda8ef828` |
| `creatorVaultBatcherAutoHandoff` | `0x004684670d284EF607E1B2424fcf8ccBda8ef828` |

## Active Deployment Snapshots

The live Base deployment snapshots are stored in `deployments/base/contracts/**/*.json`.

Current snapshot set:

- `deployments/base/contracts/core/CreatorRegistry.json`
- `deployments/base/contracts/factories/CreatorOVaultFactory.json`
- `deployments/base/contracts/services/lottery/CreatorLotteryManager.json`
- `deployments/base/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.json`
- `deployments/base/contracts/services/bridge/SolanaBridgeAdapter.json`
- `deployments/base/contracts/helpers/batchers/VaultActivationBatcher.json`
- `deployments/base/contracts/helpers/infra/UniversalBytecodeStore.json`
- `deployments/base/contracts/factories/UniversalCreate2DeployerFromStore.json`
- `deployments/base/contracts/helpers/batchers/DeploymentBatcher.json`
- `deployments/base/contracts/helpers/batchers/DeploymentBatcherPhase3Helper.json`

Live batcher child addresses that are read directly from `DeploymentBatcher` are also recorded in the release packet:

- `DeploymentBatcherPhase2Module=0x9794735D53dA4f0884eA43E2764A7E4dd2a38826`
- `DeploymentBatcherPhase3Helper=0x7e4b2dd557bA62FD1Dd5f72CBf5FFAAaaB8A468c`
- `DeploymentBatcherUniV4Helper=0xCd10BEcd96c13b63cEff49A646Eca1fe6D2f2CC7`
- `DeploymentBatcherUtilsHelper=0xb79615C6B128E953347fcd6061DeaEc867482EEC`

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.8.3-bytecode-manifest.json`

Historical reference manifest:

- `deployments/base/v1.8.2-bytecode-manifest.json`
- `deployments/base/v1.7.1-bytecode-manifest.json`

For each deployment contract this includes:

- `creationBytecodeHash`
- `codeId` (`keccak256(creationCode)`)
- `creationBytecodeBytes`

## Canonical Ajna Strategy Inventory

The canonical phase-3 Ajna sleeve remains:

1. `ERC4626StrategyAdapter`
2. `AjnaERC4626Vault`
3. `AjnaVaultAuth`

The active bytecode manifest must include all three entries.

## Operator Checks

1. Run `bash test/v183-release-target-guard.sh`.
2. Run `forge test --match-contract RegistryDefaultScriptsTest`.
3. Run `forge test --match-contract SeedCreatorRegistryConfigTest`.
4. Confirm `DeploymentBatcher` wiring onchain:
   - `cast call 0x004684670d284EF607E1B2424fcf8ccBda8ef828 "bytecodeStore()(address)"`
   - `cast call 0x004684670d284EF607E1B2424fcf8ccBda8ef828 "create2Deployer()(address)"`
   - `cast call 0x004684670d284EF607E1B2424fcf8ccBda8ef828 "vaultCoreModule()(address)"`
   - `cast call 0x004684670d284EF607E1B2424fcf8ccBda8ef828 "vaultStrategiesModule()(address)"`
   - `cast call 0x004684670d284EF607E1B2424fcf8ccBda8ef828 "vaultAdminModule()(address)"`
