---
title: CREATE2 Registry
sidebar_position: 4
---

# CREATE2 Registry

Deterministic deployment inventory for the canonical **v1.14.1** Base infra epoch. Addresses below are from the live broadcast (2026-06); salt tags use the `base-release:<Contract>:v1.14.1` pattern.

## Overview

4626 infra resets rely on deterministic salt tags and CREATE2 so the v2 deployment layer stays reproducible across reruns.

The **v1.14.1** deployment uses these tags:

- `INFRA_STORE_SALT_TAG=base-release:UniversalBytecodeStore:v1.14.1`
- `INFRA_DEPLOYER_FROM_STORE_SALT_TAG=base-release:UniversalCreate2DeployerFromStore:v1.14.1`
- `INFRA_VAULT_CORE_MODULE_SALT_TAG=base-release:CreatorOVaultCoreModule:v1.14.1`
- `INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=base-release:CreatorOVaultStrategiesModule:v1.14.1`
- `INFRA_VAULT_ADMIN_MODULE_SALT_TAG=base-release:CreatorOVaultAdminModule:v1.14.1`
- `INFRA_DEPLOYMENT_BATCHER_SALT_TAG=base-release:DeploymentBatcher:v1.14.1`

Older epoch addresses are preserved in [Contract addresses](/reference/addresses) (retired rows) and under `docs/_internal/deployment-releases-legacy/`.

## Current Live Base Addresses (v1.14.1)

| Contract | Address |
|---|---|
| `UniversalBytecodeStoreV2` (chunked) | `0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314` |
| `UniversalCreate2DeployerFromStore` | `0x2fA570Cb17925Da86b303D4651f06b83057a10c4` |
| `CreatorOVaultCoreModule` | `0xD4553478780571A1A5F6cCCC0735F897F15a85Cf` |
| `CreatorOVaultStrategiesModule` | `0x4036e3D2d029451cEB68d521a5D0233F56518681` |
| `CreatorOVaultAdminModule` | `0xDd136c20F8f6688089e55a6CA8709718c5183307` |
| `DeploymentBatcher` | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| `DeploymentBatcherPhase1Module` | `0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266` |
| `DeploymentBatcherPhase3Helper` | `0xE0971a924E33251556fE73a4025166701b772dBe` |
| `DeploymentBatcherUniV4Helper` | `0xD2c68F175FB4DB4069A2ebBc3f02B31C635438eb` |

`DeploymentBatcherPhase3Helper` and `DeploymentBatcherUniV4Helper` are created inside the `DeploymentBatcher` constructor during the same deployment transaction.

Full canonical table (registry, lottery, Solana adapter, env cutover keys): [Contract addresses](/reference/addresses#environment-cutover-v1141).

## Usage

Deterministic v2-only rerun:

```bash
export DEPLOYMENT_EPOCH_TAG=v1.14.1
./script/deploy-infra-v2.sh
```

Full shared/global plus deterministic release:

```bash
export DEPLOYMENT_EPOCH_TAG=v1.14.1
./script/deploy-base-full-release.sh
```

## Verification

- Confirm bytecode store + deployer wiring from the live batcher:
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "bytecodeStore()(address)"`
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "create2Deployer()(address)"`
- Confirm module / helper children from the live batcher:
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "vaultCoreModule()(address)"`
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "vaultStrategiesModule()(address)"`
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "vaultAdminModule()(address)"`
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "phase3Helper()(address)"`
  - `cast call 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1 "uniV4Helper()(address)"`
- Confirm bytecode / codeId inventory:
  - `deployments/base/v1.14.1-bytecode-manifest.json`
- Confirm release packet:
  - `docs/_internal/operations/operations/deployment/releases/current.md`
