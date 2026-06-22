---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-06-22
Scope: current live Base infra addresses plus the canonical `v1.14.1` greenfield deploy target for new per-creator vaults.

## Sources

1. Release packet: `docs/operations/deployment/releases/v1.14.0-bytecode-epoch.md` (v1.14.0 baseline; v1.14.1 is a refresh on the same bytecode epoch)
2. Bytecode / codeId manifest: `deployments/base/v1.14.1-bytecode-manifest.json`
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Live deployment snapshots: `deployments/base/contracts/**/*.json`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0xDD7B106a15540bA2F59464590222bF47D8C9394E` |
| `creatorOVaultFactory` | `0xf4a4d70D9fB3b29c56eB2aaE264FBd3DF9221A6a` |
| `vaultActivationBatcher` | `0x5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A` |
| `lotteryManager` | `0x29F901864D65Eb848BC548ebCEAcD6dAD39EFd26` |
| `vrfConsumer` | `0x86B605400DBb67cc4756493c7791422184e4dC59` |
| `solanaBridgeAdapter` | `0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae` |
| `bytecodeStore` | `0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314` |
| `create2DeployerFromStore` | `0x2fA570Cb17925Da86b303D4651f06b83057a10c4` |
| `creatorOVaultCoreModule` | `0xD4553478780571A1A5F6cCCC0735F897F15a85Cf` |
| `creatorOVaultStrategiesModule` | `0x4036e3D2d029451cEB68d521a5D0233F56518681` |
| `creatorOVaultAdminModule` | `0xDd136c20F8f6688089e55a6CA8709718c5183307` |
| `deploymentBatcher` | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| `deploymentBatcherPhase1Module` | `0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266` |
| `deploymentBatcherPhase2Module` | `0xde192645Fb02dD05f586930e55D709E89c320435` |
| `deploymentBatcherPhase3Helper` | `0xE0971a924E33251556fE73a4025166701b772dBe` |
| `deploymentBatcherUniV4Helper` | `0xD2c68F175FB4DB4069A2ebBc3f02B31C635438eb` |
| `deploymentBatcherUtilsHelper` | `0xE41231e399511baaDa8844C9D1c83C096e3f2E60` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0xDD7B106a15540bA2F59464590222bF47D8C9394E` |
| `lotteryManager` | `0x29F901864D65Eb848BC548ebCEAcD6dAD39EFd26` |
| `vrfConsumer` | `0x86B605400DBb67cc4756493c7791422184e4dC59` |
| `solanaBridgeAdapter` | `0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae` |
| `universalBytecodeStore` | `0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314` |
| `universalCreate2DeployerFromStore` | `0x2fA570Cb17925Da86b303D4651f06b83057a10c4` |
| `vaultActivationBatcher` | `0x5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A` |
| `creatorVaultBatcher` | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| `creatorVaultBatcherAutoHandoff` | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |

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

- `DeploymentBatcherPhase1Module=0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266`
- `DeploymentBatcherPhase2Module=0xde192645Fb02dD05f586930e55D709E89c320435`
- `DeploymentBatcherPhase3Helper=0xE0971a924E33251556fE73a4025166701b772dBe`
- `DeploymentBatcherUniV4Helper=0xD2c68F175FB4DB4069A2ebBc3f02B31C635438eb`
- `DeploymentBatcherUtilsHelper=0xE41231e399511baaDa8844C9D1c83C096e3f2E60`

Legacy pre-rotation Phase1Module (deprecated): `0xf3b20557ef8173510693A13EF71F884DB835E8c0`

Retired v1.13.0 v2 Phase1Module (grandfathered vaults only): `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87`

Pre-v1.14.1 batcher (deprecated for new greenfield deploys): `0xa99058f424FB3ACC639F59355C65C40149030651`

Versioning verifier (repo defaults + live getters + store seed):

```bash
BYTECODE_MANIFEST=../../deployments/base/v1.14.1-bytecode-manifest.json \
  pnpm -C frontend exec tsx scripts/ops/verify-v1140-deploy-versioning.ts
```

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.14.1-bytecode-manifest.json`

Historical reference manifests:

- `deployments/base/v1.14.0-bytecode-manifest.json`
- `deployments/base/v1.12.0-bytecode-manifest.json`
- `deployments/base/v1.11.1-bytecode-manifest.json`
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
4. Confirm live batcher wiring onchain (`0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1`):
   - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "phase1Module()(address)"`
   - `cast call 0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266 "create2Deployer()(address)"`
   - `cast call 0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266 "vaultCoreModule()(address)"`
   - `cast call 0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266 "vaultStrategiesModule()(address)"`
   - `cast call 0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266 "vaultAdminModule()(address)"`
5. Verify bytecode store seed: `pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts` with `BYTECODE_MANIFEST=../../deployments/base/v1.14.1-bytecode-manifest.json`.
6. After any future module rotation on the live batcher, ensure the new module code IDs are added to the active manifest and seeded into the UniversalBytecodeStore (see `docs/audits/general-audit-2026-05.md` for the hygiene note).
