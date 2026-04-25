---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-04-25
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
| `bytecodeStore` | `0x4F047c895aA1390D4d0607B2aDDAc54a08ccfe5A` |
| `create2DeployerFromStore` | `0x6f02c56B2F6C213f727D303Ce9E12e6bE1D224f0` |
| `creatorOVaultCoreModule` | `0xeD728378f969f8e94a19fC081172D1e67B80412e` |
| `creatorOVaultStrategiesModule` | `0x0f1A26b93AD56BBbC5e0486A920621944FF6ABd6` |
| `creatorOVaultAdminModule` | `0xFC40e9768eeaAE634CBD2A72DA0CF809d3c908e0` |
| `deploymentBatcher` | `0x32403a647e73e04ae42b02bdd1ade9c88698fd0c` |
| `deploymentBatcherPhase3Helper` | `0xF185Cb60E108E324f67e75cf8106B8e9950c16ed` |
| `deploymentBatcherUniV4Helper` | `0xfe1C5eaa76942208298f510c820e7E8328f6d031` |
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
| `universalBytecodeStore` | `0x4F047c895aA1390D4d0607B2aDDAc54a08ccfe5A` |
| `universalCreate2DeployerFromStore` | `0x6f02c56B2F6C213f727D303Ce9E12e6bE1D224f0` |
| `vaultActivationBatcher` | `0x7Cc0050842433968cc7A0884d192b61FD0b46F63` |
| `creatorVaultBatcher` | `0x32403a647e73e04ae42b02bdd1ade9c88698fd0c` |
| `creatorVaultBatcherAutoHandoff` | `0x32403a647e73e04ae42b02bdd1ade9c88698fd0c` |

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

- `DeploymentBatcherPhase3Helper=0xF185Cb60E108E324f67e75cf8106B8e9950c16ed`
- `DeploymentBatcherUniV4Helper=0xfe1C5eaa76942208298f510c820e7E8328f6d031`

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
   - `cast call 0x32403a647e73e04ae42b02bdd1ade9c88698fd0c "bytecodeStore()(address)"`
   - `cast call 0x32403a647e73e04ae42b02bdd1ade9c88698fd0c "create2Deployer()(address)"`
   - `cast call 0x32403a647e73e04ae42b02bdd1ade9c88698fd0c "vaultCoreModule()(address)"`
   - `cast call 0x32403a647e73e04ae42b02bdd1ade9c88698fd0c "vaultStrategiesModule()(address)"`
   - `cast call 0x32403a647e73e04ae42b02bdd1ade9c88698fd0c "vaultAdminModule()(address)"`
