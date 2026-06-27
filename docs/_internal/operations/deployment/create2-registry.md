---
title: CREATE2 Registry
sidebar_position: 4
---

# CREATE2 Registry

Deterministic deployment inventory for the canonical `v1.9.2` Base infra epoch target. Addresses below are from the last completed broadcast (the `v1.8.3` epoch on `2026-04-11`); a fresh `v1.9.2` broadcast will derive new CREATE2 addresses from the same salt tag pattern.

## Overview

4626 infra resets rely on deterministic salt tags and CREATE2 so the v2 deployment layer stays reproducible across reruns.

The next `v1.9.2` deployment will use these tags (same pattern the `v1.8.3` broadcast used, with the epoch tag swapped):

- `INFRA_STORE_SALT_TAG=base-release:UniversalBytecodeStore:v1.9.2`
- `INFRA_DEPLOYER_FROM_STORE_SALT_TAG=base-release:UniversalCreate2DeployerFromStore:v1.9.2`
- `INFRA_VAULT_CORE_MODULE_SALT_TAG=base-release:CreatorOVaultCoreModule:v1.9.2`
- `INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=base-release:CreatorOVaultStrategiesModule:v1.9.2`
- `INFRA_VAULT_ADMIN_MODULE_SALT_TAG=base-release:CreatorOVaultAdminModule:v1.9.2`
- `INFRA_DEPLOYMENT_BATCHER_SALT_TAG=base-release:DeploymentBatcher:v1.9.2`

Addresses in the table below are from the `2026-04-11` `v1.8.3` broadcast and remain the live Base CREATE2 addresses until a `v1.9.2` infra broadcast is performed.

## Current Live Base Addresses

| Contract | Address |
|---|---|
| `UniversalBytecodeStoreV2` | `0xA009B1Bf8cB711c115d832AEb392156BA6A4112e` |
| `UniversalCreate2DeployerFromStore` | `0xFd2657b6f1905C3F0494942F618a68963CF792Ec` |
| `CreatorOVaultCoreModule` | `0xeD728378f969f8e94a19fC081172D1e67B80412e` |
| `CreatorOVaultStrategiesModule` | `0x0f1A26b93AD56BBbC5e0486A920621944FF6ABd6` |
| `CreatorOVaultAdminModule` | `0xFC40e9768eeaAE634CBD2A72DA0CF809d3c908e0` |
| `DeploymentBatcher` | `0xcDbEeB764df9878ebAFbf101cc818370f703bC4F` |
| `DeploymentBatcherPhase3Helper` | `0xF185Cb60E108E324f67e75cf8106B8e9950c16ed` |
| `DeploymentBatcherUniV4Helper` | `0xfe1C5eaa76942208298f510c820e7E8328f6d031` |

`DeploymentBatcherPhase3Helper` and `DeploymentBatcherUniV4Helper` are created inside the `DeploymentBatcher` constructor during the same deployment transaction.

## Usage

Deterministic v2-only rerun:

```bash
export DEPLOYMENT_EPOCH_TAG=v1.9.2
./script/deploy-infra-v2.sh
```

Full shared/global plus deterministic release:

```bash
export DEPLOYMENT_EPOCH_TAG=v1.9.2
./script/deploy-base-full-release.sh
```

## Verification

- Confirm bytecode store + deployer wiring from the live batcher:
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "bytecodeStore()(address)"`
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "create2Deployer()(address)"`
- Confirm module / helper children from the live batcher:
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "vaultCoreModule()(address)"`
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "vaultStrategiesModule()(address)"`
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "vaultAdminModule()(address)"`
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "phase3Helper()(address)"`
  - `cast call 0xcDbEeB764df9878ebAFbf101cc818370f703bC4F "uniV4Helper()(address)"`
- Confirm bytecode / codeId inventory:
  - `deployments/base/v1.8.3-bytecode-manifest.json`
- Confirm release packet:
  - `docs/operations/deployment/releases/v1.8.3-mainnet.md`
