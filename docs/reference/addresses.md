---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Deployed contract addresses for 4626.

> **Canonical source.** This file is the single source of truth for live deployed
> addresses. Per-release notes under `docs/operations/deployment/releases/` are
> frozen point-in-time records; when those disagree with this file, **this file
> wins**. (Fix H-16 consolidation — 4626-308.)

## Base (Hub Chain)

### Current Live Infrastructure (`v1.11.1` protocol contract release target)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x3f64087dc361Ad52300409E5873b26941D6418B6` |
| CreatorOVaultFactory | `0x09a2fd817F30D2599fb13520d06751259b6AdcFE` |
| VaultActivationBatcher | `0x5036FB536f53b15307825eB2006B21E22f0F3193` |
| CreatorLotteryManager | `0x5c0115589d7F4930A0dc93417aE409f44186f4E7` |
| CreatorVRFConsumerV2_5 | `0xE4AcDD5316EcF4D98301509968F0728EEDaaB68E` |
| SolanaBridgeAdapter | `0x700b4BBAf965c013123bAd02a6562FBa487aC0f1` |
| UniversalBytecodeStoreV2 | `0x9C3e2A7bd73690d5b5DC0C47f8dB74c4dc5D1c69` |
| UniversalCreate2DeployerFromStore | `0xF6538d7D18AfFe5057C6f109DBEd33c851A70c7E` |
| CreatorOVaultCoreModule | `0x5f6b5E9044179BF3C4d2f38AB5EC5c60b4B6657b` |
| CreatorOVaultStrategiesModule | `0x6048eC7103Ce9090Ad3B650931A6113a5369A164` |
| CreatorOVaultAdminModule | `0xDBC68d78D2961e4d2ca156D9F0e489B149cb7d73` |
| DeploymentBatcher | `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` |
| DeploymentBatcherPhase2Module | `0x1A806550070d42d18ad5C5325A8b90BeD647E7BB` |
| DeploymentBatcherPhase3Helper | `0x809a20c6655D75C1d408dEd02a6EAB705b7b5153` |
| DeploymentBatcherUniV4Helper | `0xD7A2F1c2C5d73EeB19B495D2Bbe29A9bE2112F0b` |
| DeploymentBatcherUtilsHelper | `0x158C9925BbC53295675a1b0BB489c7Cfba2cfa73` |

Notes:
- Shared/global and split Phase-1 infra were redeployed in the v1.11.1 protocol cutover.
- The repo's canonical release target is `v1.11.1` for the active protocol contract stack used by user vault deployments.
- `DeploymentBatcherPhase2Module`, `DeploymentBatcherPhase3Helper`, `DeploymentBatcherUniV4Helper`, and `DeploymentBatcherUtilsHelper` are constructor-created by `DeploymentBatcher`.
- `DeploymentBatcher` is forensically matched to the live CREATE2 deployment payload; explorer verification for that deployment path still mismatches.

### Per-Creator Deployments

Vault, wrapper, share OFT, gauge, and oracle addresses are creator-specific and are emitted during each launch flow. Use the deploy release packet and onchain events for creator-level address lookups.

## LayerZero Endpoints

| Chain | Endpoint ID | Endpoint Address |
|-------|-------------|------------------|
| Base | 30184 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Ethereum | 30101 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Arbitrum | 30110 | `0x1a44076050125825900e736c501f859c50fE728c` |
| BSC | 30102 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Avalanche | 30106 | `0x1a44076050125825900e736c501f859c50fE728c` |

## External Contracts

| Contract | Chain | Address |
|----------|-------|---------|
| Chainlink VRF Coordinator | Base | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` |
| WETH | Base | `0x4200000000000000000000000000000000000006` |
