---
title: CREATE2 Registry
sidebar_position: 4
---

# CREATE2 Registry

Deterministic deployment inventory for the `v1.7.1` infra epoch on Base.

## Overview

4626 infra resets rely on deterministic salt tags and CREATE2 to make addresses reproducible.

For `v1.7.1` the canonical tags are:

- `INFRA_STORE_SALT_TAG=4626:UniversalBytecodeStore:v1.7.1`
- `INFRA_DEPLOYER_FROM_STORE_SALT_TAG=4626:UniversalCreate2DeployerFromStore:v1.7.1`
- `INFRA_VAULT_CORE_MODULE_SALT_TAG=4626:CreatorOVaultCoreModule:v1.7.1`
- `INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=4626:CreatorOVaultStrategiesModule:v1.7.1`
- `INFRA_VAULT_ADMIN_MODULE_SALT_TAG=4626:CreatorOVaultAdminModule:v1.7.1`
- `INFRA_DEPLOYMENT_BATCHER_SALT_TAG=4626:DeploymentBatcher:v1.7.1`

## v1.7.1 Target Addresses

| Contract | Address |
|---|---|
| `UniversalBytecodeStoreV2` | `0x6A578022609cdb65C614FF28912C49FC1EC97071` |
| `UniversalCreate2DeployerFromStore` | `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a` |
| `CreatorOVaultCoreModule` | `0x4890776DA44f014A932dF4a9a1F8dBE648E91e3D` |
| `CreatorOVaultStrategiesModule` | `0x1E357B6B7a837CAF75Eb14016d2733779FEed9CE` |
| `CreatorOVaultAdminModule` | `0xBF2ab516BAA04aeac061f359a483622Ff006f153` |
| `DeploymentBatcher` | `0x8DD90086281E0Bd70E8362eCE021e6eC57167fdB` |

## Usage

```bash
export DEPLOYMENT_EPOCH_TAG=v1.7.1
./script/deploy-infra-v2.sh
```

## Verification

- Confirm bytecode store + deployer wiring from batcher:
  - `cast call <batcher> "bytecodeStore()(address)"`
  - `cast call <batcher> "create2Deployer()(address)"`
- Confirm release bytecode/codeId manifest:
  - `deployments/base/v1.7.1-bytecode-manifest.json`
