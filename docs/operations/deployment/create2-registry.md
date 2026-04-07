---
title: CREATE2 Registry
sidebar_position: 4
---

# CREATE2 Registry

Deterministic deployment inventory for the planned `v1.8.1` vanity infra epoch on Base.

## Overview

4626 infra resets rely on deterministic salt tags and CREATE2 to make addresses reproducible.

For `v1.8.1` the recommended tags are:

- `INFRA_STORE_SALT_TAG=4626:UniversalBytecodeStore:v1.8.1`
- `INFRA_DEPLOYER_FROM_STORE_SALT_TAG=4626:UniversalCreate2DeployerFromStore:v1.8.1`
- `INFRA_VAULT_CORE_MODULE_SALT_TAG=4626:CreatorOVaultCoreModule:v1.8.1`
- `INFRA_VAULT_STRATEGIES_MODULE_SALT_TAG=4626:CreatorOVaultStrategiesModule:v1.8.1`
- `INFRA_VAULT_ADMIN_MODULE_SALT_TAG=4626:CreatorOVaultAdminModule:v1.8.1`
- `INFRA_DEPLOYMENT_BATCHER_SALT_TAG=4626:DeploymentBatcher:v1.8.1`

## v1.8.1 Planned Target Addresses

| Contract | Address |
|---|---|
| `UniversalBytecodeStoreV2` | `0x58071d59d2f5E61A80b3f8770B6564289acD4626` |
| `UniversalCreate2DeployerFromStore` | `0x1c1596090B0e0Bb35b2F7cd77e865FbeE3654626` |
| `CreatorOVaultCoreModule` | `0x9379761d3680401f4d412048B3Ff6FE05dE04626` |
| `CreatorOVaultStrategiesModule` | `0x8fd50C3695749F95801E8c867E264100c2C54626` |
| `CreatorOVaultAdminModule` | `0x6De6c3F10291e87fAEB7590CE01E400571434626` |
| `DeploymentBatcher` | `0xaE81C19c2A2E964e65cCacE89A6eb2309d6E4626` |
| `DeploymentBatcherPhase3Helper` | `0x625992eAdA5942192b029c2a0DF5cBECc65509FB` |

`DeploymentBatcherPhase3Helper` is created inside the `DeploymentBatcher` constructor (same broadcast transaction), not via a standalone CREATE2 salt tag.

## Usage

```bash
export DEPLOYMENT_EPOCH_TAG=v1.8.1
./script/deploy-infra-v2.sh
```

Or pre-generate and pin the manifest explicitly:

```bash
cargo run --manifest-path tools/vanity-salt-grinder/Cargo.toml -- \
  --epoch-tag v1.8.1 \
  --out deployments/base/v1.8.1-vanity-manifest.json

export INFRA_VANITY_MANIFEST_PATH="$PWD/deployments/base/v1.8.1-vanity-manifest.json"
./script/deploy-infra-v2.sh
```

## Verification

- Confirm bytecode store + deployer wiring from batcher:
  - `cast call <batcher> "bytecodeStore()(address)"`
  - `cast call <batcher> "create2Deployer()(address)"`
- Confirm manifest-gated preflight inputs:
  - `deployments/base/v1.8.1-vanity-manifest.json`
- Historical bytecode/codeId manifest remains:
  - `deployments/base/v1.7.1-bytecode-manifest.json`
