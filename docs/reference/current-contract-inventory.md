---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-04-10  
Scope: current live Base infra addresses plus the canonical `v1.8.3` release target and manifest.

## Sources

1. Release packet: `docs/operations/deployment/releases/v1.8.3-mainnet.md`
2. Bytecode / codeId manifest: `deployments/base/v1.8.3-bytecode-manifest.json`
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Live deployment snapshots: `deployments/base/contracts/**/*.json`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0x79d0d68904BbB50361C9721CbDD17276E046771D` |
| `creatorOVaultFactory` | `0xb66aA49d94569a8589f380D53e8a3f1F60165000` |
| `vaultActivationBatcher` | `0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd` |
| `lotteryManager` | `0xA137BEef789B80c76187E1b6DEef60fC7db6d280` |
| `vrfConsumer` | `0x22ae936027Fe0c348758634bF8694E00D96338ac` |
| `solanaBridgeAdapter` | `0x1B3E713852dEC5d983AD11BD1567eed0723ceA9b` |
| `bytecodeStore` | `0xc8050cfeDA4CCd04079f37f1D95cD54279156E46` |
| `create2DeployerFromStore` | `0x95700DA39462f97b0E874ED7e05BBF76413d7Ac1` |
| `creatorOVaultCoreModule` | `0xf2367B030992e5661503bb9Bc7e712cf66799bC7` |
| `creatorOVaultStrategiesModule` | `0x897837200b1f4F8D6bec9b00d56Ed0189f55832b` |
| `creatorOVaultAdminModule` | `0x940C8Fc97295AA4D9D2C5FcB26571BB4a98bbC19` |
| `deploymentBatcher` | `0x721420F190cc4525bb8Adc72D4c66eEB806AFC37` |
| `deploymentBatcherPhase3Helper` | `0x42612DA05Bd72d9B58f0Fa63161dDd8a3FEFd568` |
| `deploymentBatcherUniV4Helper` | `0x5Ed8A640abF700e4c3A627Ad7cc8A8bdDEe5F34f` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x79d0d68904BbB50361C9721CbDD17276E046771D` |
| `lotteryManager` | `0xA137BEef789B80c76187E1b6DEef60fC7db6d280` |
| `vrfConsumer` | `0x22ae936027Fe0c348758634bF8694E00D96338ac` |
| `solanaBridgeAdapter` | `0x1B3E713852dEC5d983AD11BD1567eed0723ceA9b` |
| `universalBytecodeStore` | `0xc8050cfeDA4CCd04079f37f1D95cD54279156E46` |
| `universalCreate2DeployerFromStore` | `0x95700DA39462f97b0E874ED7e05BBF76413d7Ac1` |
| `vaultActivationBatcher` | `0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd` |
| `creatorVaultBatcher` | `0x721420F190cc4525bb8Adc72D4c66eEB806AFC37` |
| `creatorVaultBatcherAutoHandoff` | `0x721420F190cc4525bb8Adc72D4c66eEB806AFC37` |

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

- `DeploymentBatcherPhase3Helper=0x42612DA05Bd72d9B58f0Fa63161dDd8a3FEFd568`
- `DeploymentBatcherUniV4Helper=0x5Ed8A640abF700e4c3A627Ad7cc8A8bdDEe5F34f`

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
   - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "bytecodeStore()(address)"`
   - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "create2Deployer()(address)"`
   - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "phase3Helper()(address)"`
   - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "uniV4Helper()(address)"`
