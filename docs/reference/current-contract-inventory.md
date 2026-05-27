---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-05-26
Scope: current live Base infra addresses plus the canonical `v1.11.2-pipe-a` protocol contract release target for new per-creator vaults.

## Sources

1. Release packet: `docs/operations/deployment/releases/v1.11.1-protocol-contract-readiness.md`
2. Bytecode / codeId manifest: `deployments/base/v1.11.1-bytecode-manifest.json`
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Live deployment snapshots: `deployments/base/contracts/**/*.json`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0x3f64087dc361Ad52300409E5873b26941D6418B6` |
| `creatorOVaultFactory` | `0x09a2fd817F30D2599fb13520d06751259b6AdcFE` |
| `vaultActivationBatcher` | `0x5036FB536f53b15307825eB2006B21E22f0F3193` |
| `lotteryManager` | `0x5c0115589d7F4930A0dc93417aE409f44186f4E7` |
| `vrfConsumer` | `0xE4AcDD5316EcF4D98301509968F0728EEDaaB68E` |
| `solanaBridgeAdapter` | `0x700b4BBAf965c013123bAd02a6562FBa487aC0f1` |
| `bytecodeStore` | `0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4` |
| `create2DeployerFromStore` | `0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7` |
| `creatorOVaultCoreModule` | `0x9f8C2c5700A25b76759f3115B96A68f4d079CDbB` |
| `creatorOVaultStrategiesModule` | `0x98d82B137b7Ff9ba6f9c6fE83Cc2aBFF150782B0` |
| `creatorOVaultAdminModule` | `0x84cbD15c71f7F8127458eBAFaBBDd12415CA2097` |
| `deploymentBatcher` | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| `deploymentBatcherPhase1Module` | `0xf3b20557ef8173510693A13EF71F884DB835E8c0` |
| `deploymentBatcherPhase2Module` | `0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f` |
| `deploymentBatcherPhase3Helper` | `0x3c89e20AbccE3d8F6344AFf6c63c82F5619EFFCB` |
| `deploymentBatcherUniV4Helper` | `0xF71a6236586077CD29C971443D2cce37B543DcBB` |
| `deploymentBatcherUtilsHelper` | `0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x3f64087dc361Ad52300409E5873b26941D6418B6` |
| `lotteryManager` | `0x5c0115589d7F4930A0dc93417aE409f44186f4E7` |
| `vrfConsumer` | `0xE4AcDD5316EcF4D98301509968F0728EEDaaB68E` |
| `solanaBridgeAdapter` | `0x700b4BBAf965c013123bAd02a6562FBa487aC0f1` |
| `universalBytecodeStore` | `0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4` |
| `universalCreate2DeployerFromStore` | `0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7` |
| `vaultActivationBatcher` | `0x5036FB536f53b15307825eB2006B21E22f0F3193` |
| `creatorVaultBatcher` | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| `creatorVaultBatcherAutoHandoff` | `0xa99058f424FB3ACC639F59355C65C40149030651` |

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
- `deployments/base/contracts/helpers/batchers/DeploymentBatcherUniV4Helper.json`

Live batcher child addresses that are read directly from `DeploymentBatcher` are also recorded in the release packet:

- `DeploymentBatcherPhase1Module=0xf3b20557ef8173510693A13EF71F884DB835E8c0`
- `DeploymentBatcherPhase2Module=0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f`
- `DeploymentBatcherPhase3Helper=0x3c89e20AbccE3d8F6344AFf6c63c82F5619EFFCB`
- `DeploymentBatcherUniV4Helper=0xF71a6236586077CD29C971443D2cce37B543DcBB`
- `DeploymentBatcherUtilsHelper=0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D`

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.11.1-bytecode-manifest.json`

Historical reference manifest:

- `deployments/base/v1.9.2-bytecode-manifest.json`
- `deployments/base/v1.8.3-bytecode-manifest.json`

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

1. Run `bash test/current-release-target-guard.sh`.
2. Run `forge test --match-contract RegistryDefaultScriptsTest`.
3. Run `forge test --match-contract SeedCreatorRegistryConfigTest`.
4. Confirm `DeploymentBatcher` wiring onchain:
   - `cast call 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 "bytecodeStore()(address)"`
   - `cast call 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 "create2Deployer()(address)"`
   - `cast call 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 "vaultCoreModule()(address)"`
   - `cast call 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 "vaultStrategiesModule()(address)"`
   - `cast call 0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8 "vaultAdminModule()(address)"`
