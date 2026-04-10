---
title: CREATE2 Registry
sidebar_position: 4
---

# CREATE2 Registry

Deterministic deployment inventory for the next `v1.8.3` Base infra epoch.

## Overview

4626 infra resets rely on deterministic salt tags and CREATE2 so the v2 deployment layer stays reproducible across reruns.

For `v1.8.3` the recommended tags are:

- `INFRA_STORE_SALT_TAG=base-release:UniversalBytecodeStore:v1.8.3`
- `INFRA_DEPLOYER_FROM_STORE_SALT_TAG=base-release:UniversalCreate2DeployerFromStore:v1.8.3`
- `INFRA_VAULT_CORE_MODULE_SALT_TAG=base-release:CreatorOVaultCoreModule:v1.8.3`
- `INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=base-release:CreatorOVaultStrategiesModule:v1.8.3`
- `INFRA_VAULT_ADMIN_MODULE_SALT_TAG=base-release:CreatorOVaultAdminModule:v1.8.3`
- `INFRA_DEPLOYMENT_BATCHER_SALT_TAG=base-release:DeploymentBatcher:v1.8.3`

Current live addresses still remain on the prior Base epoch until the `v1.8.3` broadcast completes.

## Current Live Base Addresses

| Contract | Address |
|---|---|
| `UniversalBytecodeStoreV2` | `0xc8050cfeDA4CCd04079f37f1D95cD54279156E46` |
| `UniversalCreate2DeployerFromStore` | `0x95700DA39462f97b0E874ED7e05BBF76413d7Ac1` |
| `CreatorOVaultCoreModule` | `0xf2367B030992e5661503bb9Bc7e712cf66799bC7` |
| `CreatorOVaultStrategiesModule` | `0x897837200b1f4F8D6bec9b00d56Ed0189f55832b` |
| `CreatorOVaultAdminModule` | `0x940C8Fc97295AA4D9D2C5FcB26571BB4a98bbC19` |
| `DeploymentBatcher` | `0x721420F190cc4525bb8Adc72D4c66eEB806AFC37` |
| `DeploymentBatcherPhase3Helper` | `0x42612DA05Bd72d9B58f0Fa63161dDd8a3FEFd568` |
| `DeploymentBatcherUniV4Helper` | `0x5Ed8A640abF700e4c3A627Ad7cc8A8bdDEe5F34f` |

`DeploymentBatcherPhase3Helper` and `DeploymentBatcherUniV4Helper` are created inside the `DeploymentBatcher` constructor during the same deployment transaction.

## Usage

Deterministic v2-only rerun:

```bash
export DEPLOYMENT_EPOCH_TAG=v1.8.3
./script/deploy-infra-v2.sh
```

Full shared/global plus deterministic release:

```bash
export DEPLOYMENT_EPOCH_TAG=v1.8.3
./script/deploy-base-full-release.sh
```

## Verification

- Confirm bytecode store + deployer wiring from the live batcher:
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "bytecodeStore()(address)"`
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "create2Deployer()(address)"`
- Confirm module / helper children from the live batcher:
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "vaultCoreModule()(address)"`
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "vaultStrategiesModule()(address)"`
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "vaultAdminModule()(address)"`
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "phase3Helper()(address)"`
  - `cast call 0x721420F190cc4525bb8Adc72D4c66eEB806AFC37 "uniV4Helper()(address)"`
- Confirm bytecode / codeId inventory:
  - `deployments/base/v1.8.3-bytecode-manifest.json`
- Confirm release packet:
  - `docs/operations/deployment/releases/v1.8.3-mainnet.md`
