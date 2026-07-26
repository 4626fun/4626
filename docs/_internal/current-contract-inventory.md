---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Updated on: 2026-07-24
Scope: current live `v1.19.3` deploy-bytecode infrastructure with the `v1.19.4` Creator-core repair (v1.19.1 greenfield addresses).

## Sources

1. Release packet: `docs/_internal/deployment-releases-legacy/v1.19.3.md` (shell history: `v1.19.1-greenfield.md`)
2. Bytecode / codeId manifest: `deployments/base/v1.19.3-bytecode-manifest.json` (historical seals: `v1.19.2-bytecode-manifest.json`, `v1.19.1-bytecode-manifest.json`)
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Handoff env: `tmp/base-v1.19.1-handoff.env` (greenfield shell; bytecode epoch is v1.19.3)
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment
6. Greenfield cutover runbook: `docs/_internal/deployment-releases-legacy/v1.19.1-greenfield.md`

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2` |
| `registryBootstrap` | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB` |
| `ovaultFactory` | `0xCAb65a066A4D52DD29ffB418B319819176b89610` |
| `vaultActivationBatcher` | `0x6552C6AF7a76646E938C0FBf549c5ec9a22c5bcA` |
| `lotteryManager` | `0xB45E68a5867935a5734E4185977F81c528006650` |
| `vrfConsumer` | `0x98fb5e0af3120B32E2E03400B6E51d0bde433670` |
| `bytecodeStore` | `0xF9622613682a12E46b914c7498716F42E44c4d36` |
| `create2DeployerFromStore` | `0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2` |
| `ovaultCoreModule` | `0x0513cf245EF2Cf54534416211F7B890405bF76D1` |
| `agentOVaultCoreModule` | `0xe3f7115aba3658201a3be2EaF699173E5cD0d6fE` |
| `ovaultStrategiesModule` | `0x6481675Fe2aed61b2D0392Ddd2E67EFCE04c3849` |
| `ovaultAdminModule` | `0xD5c887cd16DBb3A9095eB9635ECf57b77D1d9B37` |
| `deploymentBatcher` | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| `deploymentBatcherPhase1Module` | `0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3` |
| `deploymentBatcherPhase2Module` | `0x1217bA070DBf64303117939301788925030295d1` |
| `deploymentBatcherPhase3Helper` | `0xC54Fb8d8232a8a654E512b3bDf761c8Eb2783B74` |
| `deploymentBatcherShareMeshHelper` | `0x73b6efB7196CdFa6c095Dc196559c88818Cd3211` |
| `deploymentBatcherUtilsHelper` | `0x8833225A423f4B1BB071702CB68d71fA4af434f2` |
| `vaultAuxiliaryDeployBatcher` | `0xaA9229c1649a7eC6DA85a76097E0910B24F9408e` (hardened v1.19.1; authorized) |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2` |
| `lotteryManager` | `0xB45E68a5867935a5734E4185977F81c528006650` |
| `vrfConsumer` | `0x98fb5e0af3120B32E2E03400B6E51d0bde433670` |
| `universalBytecodeStore` | `0xF9622613682a12E46b914c7498716F42E44c4d36` |
| `universalCreate2DeployerFromStore` | `0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2` |
| `vaultActivationBatcher` | `0x6552C6AF7a76646E938C0FBf549c5ec9a22c5bcA` |
| `deploymentBatcher` | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| `deploymentBatcherAutoHandoff` | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |

## Active Deployment Snapshots

The live Base deployment snapshots are stored in `deployments/base/contracts/**/*.json`.

Current snapshot set:

- `deployments/base/contracts/shared/core/CreatorRegistry.json`
- `deployments/base/contracts/factories/CreatorOVaultFactory.json`
- `deployments/base/contracts/services/lottery/CreatorLotteryManager.json`
- `deployments/base/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.json`
- `deployments/base/contracts/helpers/batchers/VaultActivationBatcher.json`
- `deployments/base/contracts/helpers/infra/UniversalBytecodeStore.json`
- `deployments/base/contracts/factories/UniversalCreate2DeployerFromStore.json`
- `deployments/base/contracts/helpers/batchers/DeploymentBatcher.json`
- `deployments/base/contracts/helpers/batchers/DeploymentBatcherPhase3Helper.json`
- `deployments/base/contracts/helpers/batchers/DeploymentBatcherShareMeshHelper.json` (post-`v1.16.1`; legacy `DeploymentBatcherUniV4Helper.json` retained for prior batchers)

The Twin `SolanaBridgeAdapter` is not current infrastructure. Its immutable
historical deployment snapshot is archived at
`deployments/base/archive/SolanaBridgeAdapter.retired.json`.

Active Solana routing is LayerZero ShareOFT only. Each creator's Solana mint
and OFT Store are distinct Solana pubkeys, and every creator token requires an
explicit
`Registry4626.setRemoteOFTPeerBytes32(creatorToken, solanaEid, peer)` entry
before `finalizePhase2`; there is no adapter or global-peer fallback.

Live batcher child addresses that are read directly from `DeploymentBatcher` are also recorded in the release packet:

- `DeploymentBatcherPhase1Module=0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3`
- `DeploymentBatcherPhase2Module=0x1217bA070DBf64303117939301788925030295d1`
- `DeploymentBatcherPhase3Helper=0xC54Fb8d8232a8a654E512b3bDf761c8Eb2783B74`
- `DeploymentBatcherShareMeshHelper=0x73b6efB7196CdFa6c095Dc196559c88818Cd3211`
- `DeploymentBatcherUtilsHelper=0x8833225A423f4B1BB071702CB68d71fA4af434f2`

Historical v1.16.1 batcher child addresses (deprecated): Phase3 `0xE0971a…`, ShareMesh `0xD2c68F…`, Utils `0xE41231…`

Legacy pre-rotation Phase1Module (deprecated): `0xf3b20557ef8173510693A13EF71F884DB835E8c0`

Retired v1.13.0 Phase1Module (grandfathered vaults only): `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87`

Pre-v1.14.1 batcher (deprecated for new greenfield deploys): `0xa99058f424FB3ACC639F59355C65C40149030651`

Versioning verifier (repo defaults + live getters + store seed):

```bash
BYTECODE_MANIFEST=../deployments/base/v1.19.3-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0xF9622613682a12E46b914c7498716F42E44c4d36 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
```

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.19.3-bytecode-manifest.json`

Historical reference manifests:

- `deployments/base/v1.19.2-bytecode-manifest.json`
- `deployments/base/v1.19.1-bytecode-manifest.json`
- `deployments/base/v1.16.1-bytecode-manifest.json`
- `deployments/base/v1.14.1-bytecode-manifest.json`
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
3. Run `forge test --match-contract SeedRegistry4626ConfigTest`.
4. Confirm live batcher wiring onchain (`0xa18169caf37fa0347285B16aAFC2B09eCB43F145`):
   - `cast call 0xa18169caf37fa0347285B16aAFC2B09eCB43F145 "phase1Module()(address)"` (expect `0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3`)
   - `cast call 0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3 "create2Deployer()(address)"`
   - `cast call 0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3 "vaultCoreModule()(address)"`
   - `cast call 0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3 "vaultStrategiesModule()(address)"`
   - `cast call 0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3 "vaultAdminModule()(address)"`
5. Verify bytecode store seed: `pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts` with `BYTECODE_MANIFEST=../deployments/base/v1.19.3-bytecode-manifest.json` and `UNIVERSAL_BYTECODE_STORE=0xF9622613682a12E46b914c7498716F42E44c4d36`.
6. After any future module rotation on the live batcher, ensure the new module code IDs are added to the active manifest and seeded into the UniversalBytecodeStore (see `docs/audits/general-audit-2026-05.md` for the hygiene note).
