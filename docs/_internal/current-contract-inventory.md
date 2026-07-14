---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Updated on: 2026-07-12
Scope: current live v1.18.0 Base shared infrastructure plus the canonical
`v1.19.0` bytecode/CREATE2 target for new per-creator vaults.

## Sources

1. Release packet: `docs/_internal/deployment-releases-legacy/v1.19.0-partial-refresh.md`
2. Bytecode / codeId manifest: `deployments/base/v1.19.0-bytecode-manifest.json`
3. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
4. Handoff env: `tmp/base-v1.18.0-handoff.env`
5. Onchain `DeploymentBatcher` wiring checks against the current live Base deployment
6. Prepared next epoch (not live): `deployments/base/v1.19.1-bytecode-manifest.json` +
   hardened aux batcher rotation in
   `docs/_internal/operations/deployment/deploy-capable-batcher-rotation.md`

## Canonical Base Infrastructure

| Contract / Field | Address |
|---|---|
| `registry` | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| `registryBootstrap` | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB` |
| `ovaultFactory` | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| `vaultActivationBatcher` | `0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3` |
| `lotteryManager` | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| `vrfConsumer` | `0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36` |
| `bytecodeStore` | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| `create2DeployerFromStore` | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| `ovaultCoreModule` | `0xE5C1de158Cb66ffCE15b26BE6F40f598c642EF43` |
| `ovaultStrategiesModule` | `0x8757065daf34D8B536FC35BdfE3001D43FAbAA7e` |
| `ovaultAdminModule` | `0x506400ce30228378Ee4682cfcBD55625154Bc063` |
| `deploymentBatcher` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| `deploymentBatcherPhase1Module` | `0x808fC8e83629019e29df79E592237B4603F9D1b5` |
| `deploymentBatcherPhase2Module` | `0x9845D8d412DA4686FE8b1886F314Ef8b288b8D71` |
| `deploymentBatcherPhase3Helper` | `0xB8c10FE668d59E2DEb5771298133c2a3DBFc9bB3` |
| `deploymentBatcherShareMeshHelper` | `0x9C965724f6B3387433D82bf67632Bf06470a8988` |
| `deploymentBatcherUtilsHelper` | `0xCBf24949Fc99e7C9b5e16e15a423543930fd4A52` |
| `vaultAuxiliaryDeployBatcher` | `0xa3986F2F812a80a4Ee4A33646bE5248D9e22eb88` (pre-hardening; rotate before Agent aux hard cutover) |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Frontend / API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| `lotteryManager` | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| `vrfConsumer` | `0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36` |
| `universalBytecodeStore` | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| `universalCreate2DeployerFromStore` | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| `vaultActivationBatcher` | `0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3` |
| `deploymentBatcher` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| `deploymentBatcherAutoHandoff` | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |

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

- `DeploymentBatcherPhase1Module=0x808fC8e83629019e29df79E592237B4603F9D1b5`
- `DeploymentBatcherPhase2Module=0x9845D8d412DA4686FE8b1886F314Ef8b288b8D71`
- `DeploymentBatcherPhase3Helper=0xB8c10FE668d59E2DEb5771298133c2a3DBFc9bB3`
- `DeploymentBatcherShareMeshHelper=0x9C965724f6B3387433D82bf67632Bf06470a8988`
- `DeploymentBatcherUtilsHelper=0xCBf24949Fc99e7C9b5e16e15a423543930fd4A52`

Historical v1.16.1 batcher child addresses (deprecated): Phase3 `0xE0971a…`, ShareMesh `0xD2c68F…`, Utils `0xE41231…`

Legacy pre-rotation Phase1Module (deprecated): `0xf3b20557ef8173510693A13EF71F884DB835E8c0`

Retired v1.13.0 v2 Phase1Module (grandfathered vaults only): `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87`

Pre-v1.14.1 batcher (deprecated for new greenfield deploys): `0xa99058f424FB3ACC639F59355C65C40149030651`

Versioning verifier (repo defaults + live getters + store seed):

```bash
BYTECODE_MANIFEST=../../deployments/base/v1.18.0-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0xfa3e3b466635DAff910057f18749B93d56F9DE50 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
```

## Bytecode / CodeId Evidence

Primary release manifest:

- `deployments/base/v1.18.0-bytecode-manifest.json`

Historical reference manifests:

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
4. Confirm live batcher wiring onchain (`0x02D7abC547F8B1e7E2D7a919D8D1005918361750`):
   - `cast call 0x02D7abC547F8B1e7E2D7a919D8D1005918361750 "phase1Module()(address)"`
   - `cast call 0x808fC8e83629019e29df79E592237B4603F9D1b5 "create2Deployer()(address)"`
   - `cast call 0x808fC8e83629019e29df79E592237B4603F9D1b5 "vaultCoreModule()(address)"`
   - `cast call 0x808fC8e83629019e29df79E592237B4603F9D1b5 "vaultStrategiesModule()(address)"`
   - `cast call 0x808fC8e83629019e29df79E592237B4603F9D1b5 "vaultAdminModule()(address)"`
5. Verify bytecode store seed: `pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts` with `BYTECODE_MANIFEST=../../deployments/base/v1.18.0-bytecode-manifest.json` and `UNIVERSAL_BYTECODE_STORE=0xfa3e3b466635DAff910057f18749B93d56F9DE50`.
6. After any future module rotation on the live batcher, ensure the new module code IDs are added to the active manifest and seeded into the UniversalBytecodeStore (see `docs/audits/general-audit-2026-05.md` for the hygiene note).
