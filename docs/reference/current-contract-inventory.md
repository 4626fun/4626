---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-05-05
Scope: current live Base infra addresses plus the canonical `v1.11.0` protocol contract release target for new per-creator vaults.

## Sources

1. Release packet: `docs/operations/deployment/releases/v1.11.0-protocol-contract-readiness.md`
2. Bytecode / codeId manifest: `deployments/base/v1.11.0-bytecode-manifest.json`
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Live deployment snapshots: `deployments/base/contracts/**/*.json`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0xa6216Ea21f4a4d190EdD453A51e4e015A44e60C4` |
| `creatorOVaultFactory` | `0x183b8825Bbe7d92be8F54F811EfF9C0dFe854F6E` |
| `vaultActivationBatcher` | `0x681DC69607f6E8848a56819ce8C6d591E764187a` |
| `lotteryManager` | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` |
| `vrfConsumer` | `0xd62D561A48dCe00D9913206Bfce060F8960B57b5` |
| `solanaBridgeAdapter` | `0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5` |
| `bytecodeStore` | `0xBd21c58f3D59c6E90a6bCCe462c68670F124a792` |
| `create2DeployerFromStore` | `0x24c80676E03f4c160bfa769589280fE9f9509eCb` |
| `creatorOVaultCoreModule` | `0x7818AA425a22D9892b33773ccF60CA22D07446E0` |
| `creatorOVaultStrategiesModule` | `0x8370c2190e8FB9f9A82D213e1f00240374F1Fd9D` |
| `creatorOVaultAdminModule` | `0x493FdDC8dd670EDaCC9b8C94842AfFedbf6E31F7` |
| `deploymentBatcher` | `0x271Ab2C53D79d52ddB14506a44133Fe3FA395332` |
| `deploymentBatcherPhase2Module` | `0x81D70248eB4276a6Db7E7DaB9c3B202e52c87593` |
| `deploymentBatcherPhase3Helper` | `0xC2270DA64Cb6ab39e9361926529AA8462c7d3770` |
| `deploymentBatcherUniV4Helper` | `0xbE953c5Da2Cf31C22087F528615bB8e2079b33A4` |
| `deploymentBatcherUtilsHelper` | `0x9D811694842D3d67Af243bc140961fb9a9ad4040` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0xa6216Ea21f4a4d190EdD453A51e4e015A44e60C4` |
| `lotteryManager` | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` |
| `vrfConsumer` | `0xd62D561A48dCe00D9913206Bfce060F8960B57b5` |
| `solanaBridgeAdapter` | `0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5` |
| `universalBytecodeStore` | `0xBd21c58f3D59c6E90a6bCCe462c68670F124a792` |
| `universalCreate2DeployerFromStore` | `0x24c80676E03f4c160bfa769589280fE9f9509eCb` |
| `vaultActivationBatcher` | `0x681DC69607f6E8848a56819ce8C6d591E764187a` |
| `creatorVaultBatcher` | `0x271Ab2C53D79d52ddB14506a44133Fe3FA395332` |
| `creatorVaultBatcherAutoHandoff` | `0x271Ab2C53D79d52ddB14506a44133Fe3FA395332` |

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

- `DeploymentBatcherPhase2Module=0x81D70248eB4276a6Db7E7DaB9c3B202e52c87593`
- `DeploymentBatcherPhase3Helper=0xC2270DA64Cb6ab39e9361926529AA8462c7d3770`
- `DeploymentBatcherUniV4Helper=0xbE953c5Da2Cf31C22087F528615bB8e2079b33A4`
- `DeploymentBatcherUtilsHelper=0x9D811694842D3d67Af243bc140961fb9a9ad4040`

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.11.0-bytecode-manifest.json`

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
   - `cast call 0x271Ab2C53D79d52ddB14506a44133Fe3FA395332 "bytecodeStore()(address)"`
   - `cast call 0x271Ab2C53D79d52ddB14506a44133Fe3FA395332 "create2Deployer()(address)"`
   - `cast call 0x271Ab2C53D79d52ddB14506a44133Fe3FA395332 "vaultCoreModule()(address)"`
   - `cast call 0x271Ab2C53D79d52ddB14506a44133Fe3FA395332 "vaultStrategiesModule()(address)"`
   - `cast call 0x271Ab2C53D79d52ddB14506a44133Fe3FA395332 "vaultAdminModule()(address)"`
