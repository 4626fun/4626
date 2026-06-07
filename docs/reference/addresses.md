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

### Current Live Infrastructure (`v1.13.0` greenfield deploy target)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x3f64087dc361Ad52300409E5873b26941D6418B6` |
| CreatorOVaultFactory | `0x09a2fd817F30D2599fb13520d06751259b6AdcFE` |
| VaultActivationBatcher | `0x5036FB536f53b15307825eB2006B21E22f0F3193` |
| CreatorLotteryManager | `0x5c0115589d7F4930A0dc93417aE409f44186f4E7` |
| CreatorVRFConsumerV2_5 | `0xE4AcDD5316EcF4D98301509968F0728EEDaaB68E` |
| SolanaBridgeAdapter | `0x700b4BBAf965c013123bAd02a6562FBa487aC0f1` |
| UniversalBytecodeStoreV2 | `0x8B51E6784A0C6681F5de25bAC4f9B2fDCEDE72b4` |
| UniversalCreate2DeployerFromStore | `0x4760216AFd59B843671E0FdFCe6498Ec8CFf38a7` |
| CreatorOVaultCoreModule | `0xfaebF89F739769A348B871289488fc1b99F53140` |
| CreatorOVaultStrategiesModule | `0xbd2E73f420FD4665013586c0128f0dEC1438F007` |
| CreatorOVaultAdminModule | `0x3AA2e85589EEb57cBB5BbA240E5404A51eC824a7` |
| DeploymentBatcher | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| DeploymentBatcherPhase1Module | `0x19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87` |
| DeploymentBatcherPhase2Module | `0x67FD8A34E5b26F875a9513DFf37521A1ca92d80f` |
| DeploymentBatcherPhase3Helper | `0x674a2D5EE33e184e2120B373a9AcB3fef640885c` |
| DeploymentBatcherUniV4Helper | `0xF71a6236586077CD29C971443D2cce37B543DcBB` |
| DeploymentBatcherUtilsHelper | `0xD71C4910C7bB38FB1089Cca42b0883F1BFFfa28D` |

Notes:
- Shared/global and split Phase-1 infra shell remain from v1.11.2-pipe-a; **v1.13.0** continues the CreatorOVault `CreatorOVaultModuleStorage.v2` module fingerprint on the live split Phase-1 stack.
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- Pre-Pipe-A batcher `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` is deprecated — do not use for greenfield deploys.

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
