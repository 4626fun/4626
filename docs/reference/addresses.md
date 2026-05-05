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

### Current Live Infrastructure (`v1.11.0` protocol contract release target)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0xa6216Ea21f4a4d190EdD453A51e4e015A44e60C4` |
| CreatorOVaultFactory | `0x183b8825Bbe7d92be8F54F811EfF9C0dFe854F6E` |
| VaultActivationBatcher | `0x681DC69607f6E8848a56819ce8C6d591E764187a` |
| CreatorLotteryManager | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` |
| CreatorVRFConsumerV2_5 | `0xd62D561A48dCe00D9913206Bfce060F8960B57b5` |
| SolanaBridgeAdapter | `0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5` |
| UniversalBytecodeStoreV2 | `0xBd21c58f3D59c6E90a6bCCe462c68670F124a792` |
| UniversalCreate2DeployerFromStore | `0x24c80676E03f4c160bfa769589280fE9f9509eCb` |
| CreatorOVaultCoreModule | `0x7818AA425a22D9892b33773ccF60CA22D07446E0` |
| CreatorOVaultStrategiesModule | `0x8370c2190e8FB9f9A82D213e1f00240374F1Fd9D` |
| CreatorOVaultAdminModule | `0x493FdDC8dd670EDaCC9b8C94842AfFedbf6E31F7` |
| DeploymentBatcher | `0x271Ab2C53D79d52ddB14506a44133Fe3FA395332` |
| DeploymentBatcherPhase2Module | `0x81D70248eB4276a6Db7E7DaB9c3B202e52c87593` |
| DeploymentBatcherPhase3Helper | `0xC2270DA64Cb6ab39e9361926529AA8462c7d3770` |
| DeploymentBatcherUniV4Helper | `0xbE953c5Da2Cf31C22087F528615bB8e2079b33A4` |
| DeploymentBatcherUtilsHelper | `0x9D811694842D3d67Af243bc140961fb9a9ad4040` |

Notes:
- Shared/global and split Phase-1 infra were redeployed in the v1.11.0 protocol cutover.
- The repo's canonical release target is `v1.11.0` for the active protocol contract stack used by user vault deployments.
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
