---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Updated on: 2026-07-28
Scope: current live `v1.20.0` greenfield infrastructure + sealed deploy bytecode.

## Sources

1. Release packet: `docs/_internal/deployment-releases-legacy/v1.20.0-greenfield.md`
2. Bytecode / codeId manifest: `deployments/base/v1.20.0-bytecode-manifest.json` (historical seals: `v1.20.0-bytecode-manifest.json`, `v1.19.1-bytecode-manifest.json`)
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Handoff env: `tmp/base-v1.20.0-handoff.env`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment
6. Greenfield cutover runbook: `docs/_internal/deployment-releases-legacy/v1.20.0-greenfield.md`

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e` |
| `registryBootstrap` | _(not redeployed on v1.20.0 — do not use v1.19 bootstrap against new registry)_ |
| `ovaultFactory` | `0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5` |
| `vaultActivationBatcher` | `0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3` |
| `lotteryManager` | `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b` |
| `vrfConsumer` | `0x56E2453Bf8Cf2C3FC33E7D18Edc2310297f2a251` |
| `bytecodeStore` | `0x8599CA87b28320158941C59CB3cd9a3f12083530` |
| `create2DeployerFromStore` | `0xdffB25505F5050E15B3602296330Ef352127d1Ef` |
| `ovaultCoreModule` | `0xD6B862783Fd362ccF0d39d86E6384D8770e78833` |
| `agentOVaultCoreModule` | `0xD6B862783Fd362ccF0d39d86E6384D8770e78833` |
| `ovaultStrategiesModule` | `0x968b8233053B64A93a4Cde044fFf4f43ea6D3c60` |
| `ovaultAdminModule` | `0x5bC4d71dB82081fCCF3647F1C094BEB202C0DB50` |
| `deploymentBatcher` | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032` |
| `deploymentBatcherPhase1Module` | `0x416FA15e40caA51C20d1795db946c6806C946aC5` |
| `deploymentBatcherPhase2Module` | `0xf1334BE96B3530BBF17506DED98E50D917A45B41` |
| `deploymentBatcherPhase3Helper` | `0x3Ed642288cd03846e9dA956cF95812d3125dD274` |
| `deploymentBatcherShareMeshHelper` | `0x1BCd4768180671Aa435C845239e05Afc81a496cA` |
| `deploymentBatcherUtilsHelper` | `0x99712E96f11670113f66b9356890a2209359C37d` |
| `vaultAuxiliaryDeployBatcher` | `0x15eE1D03a5556C28E5079E68763F8231ad68dAdD` (hardened v1.20.0; authorized) |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e` |
| `lotteryManager` | `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b` |
| `vrfConsumer` | `0x56E2453Bf8Cf2C3FC33E7D18Edc2310297f2a251` |
| `universalBytecodeStore` | `0x8599CA87b28320158941C59CB3cd9a3f12083530` |
| `universalCreate2DeployerFromStore` | `0xdffB25505F5050E15B3602296330Ef352127d1Ef` |
| `vaultActivationBatcher` | `0x37A9136dcD3e3245E4E992a1302dfEBD3d8673B3` |
| `deploymentBatcher` | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032` |
| `deploymentBatcherAutoHandoff` | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032` |

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

- `DeploymentBatcherPhase1Module=0x416FA15e40caA51C20d1795db946c6806C946aC5`
- `DeploymentBatcherPhase2Module=0xf1334BE96B3530BBF17506DED98E50D917A45B41`
- `DeploymentBatcherPhase3Helper=0x3Ed642288cd03846e9dA956cF95812d3125dD274`
- `DeploymentBatcherShareMeshHelper=0x1BCd4768180671Aa435C845239e05Afc81a496cA`
- `DeploymentBatcherUtilsHelper=0x99712E96f11670113f66b9356890a2209359C37d`

Historical v1.16.1 batcher child addresses (deprecated): Phase3 `0xE0971a…`, ShareMesh `0xD2c68F…`, Utils `0xE41231…`

Legacy pre-rotation Phase1Module (deprecated): `0xf3b20557ef8173510693A13EF71F884DB835E8c0`

Retired v1.13.0 Phase1Module (grandfathered vaults only): `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87`

Pre-v1.14.1 batcher (deprecated for new greenfield deploys): `0xa99058f424FB3ACC639F59355C65C40149030651`

Versioning verifier (repo defaults + live getters + store seed):

```bash
BYTECODE_MANIFEST=../deployments/base/v1.20.0-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0x8599CA87b28320158941C59CB3cd9a3f12083530 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
```

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.20.0-bytecode-manifest.json`

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
4. Confirm live batcher wiring onchain (`0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032`):
   - `cast call 0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032 "phase1Module()(address)"` (expect `0x416FA15e40caA51C20d1795db946c6806C946aC5`)
   - `cast call 0x416FA15e40caA51C20d1795db946c6806C946aC5 "create2Deployer()(address)"`
   - `cast call 0x416FA15e40caA51C20d1795db946c6806C946aC5 "vaultCoreModule()(address)"`
   - `cast call 0x416FA15e40caA51C20d1795db946c6806C946aC5 "vaultStrategiesModule()(address)"`
   - `cast call 0x416FA15e40caA51C20d1795db946c6806C946aC5 "vaultAdminModule()(address)"`
5. Verify bytecode store seed: `pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts` with `BYTECODE_MANIFEST=../deployments/base/v1.20.0-bytecode-manifest.json` and `UNIVERSAL_BYTECODE_STORE=0x8599CA87b28320158941C59CB3cd9a3f12083530`.
6. After any future module rotation on the live batcher, ensure the new module code IDs are added to the active manifest and seeded into the UniversalBytecodeStore (see `docs/audits/general-audit-2026-05.md` for the hygiene note).
