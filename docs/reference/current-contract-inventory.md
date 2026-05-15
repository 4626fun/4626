---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-05-15
Scope: current live Base infra addresses plus the canonical `v1.11.1` protocol contract release target for new per-creator vaults.

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
| `bytecodeStore` | `0x9C3e2A7bd73690d5b5DC0C47f8dB74c4dc5D1c69` |
| `create2DeployerFromStore` | `0xF6538d7D18AfFe5057C6f109DBEd33c851A70c7E` |
| `creatorOVaultCoreModule` | `0x5f6b5E9044179BF3C4d2f38AB5EC5c60b4B6657b` |
| `creatorOVaultStrategiesModule` | `0x6048eC7103Ce9090Ad3B650931A6113a5369A164` |
| `creatorOVaultAdminModule` | `0xDBC68d78D2961e4d2ca156D9F0e489B149cb7d73` |
| `deploymentBatcher` | `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` |
| `deploymentBatcherPhase2Module` | `0x1A806550070d42d18ad5C5325A8b90BeD647E7BB` |
| `deploymentBatcherPhase3Helper` | `0x809a20c6655D75C1d408dEd02a6EAB705b7b5153` |
| `deploymentBatcherUniV4Helper` | `0xD7A2F1c2C5d73EeB19B495D2Bbe29A9bE2112F0b` |
| `deploymentBatcherUtilsHelper` | `0x158C9925BbC53295675a1b0BB489c7Cfba2cfa73` |
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
| `universalBytecodeStore` | `0x9C3e2A7bd73690d5b5DC0C47f8dB74c4dc5D1c69` |
| `universalCreate2DeployerFromStore` | `0xF6538d7D18AfFe5057C6f109DBEd33c851A70c7E` |
| `vaultActivationBatcher` | `0x5036FB536f53b15307825eB2006B21E22f0F3193` |
| `creatorVaultBatcher` | `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` |
| `creatorVaultBatcherAutoHandoff` | `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` |

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

- `DeploymentBatcherPhase2Module=0x1A806550070d42d18ad5C5325A8b90BeD647E7BB`
- `DeploymentBatcherPhase3Helper=0x809a20c6655D75C1d408dEd02a6EAB705b7b5153`
- `DeploymentBatcherUniV4Helper=0xD7A2F1c2C5d73EeB19B495D2Bbe29A9bE2112F0b`
- `DeploymentBatcherUtilsHelper=0x158C9925BbC53295675a1b0BB489c7Cfba2cfa73`

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
