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

### Current Live Infrastructure (`v1.10.2` split Phase-1 release target)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb` |
| CreatorOVaultFactory | `0xC7E919899Fd4C0C4f6f4269a63046107f85848bB` |
| VaultActivationBatcher | `0x7Cc0050842433968cc7A0884d192b61FD0b46F63` |
| CreatorLotteryManager | `<v1.10.1 manager TBD post-broadcast>` |
| CreatorVRFConsumerV2_5 | `0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47` |
| SolanaBridgeAdapter | `0x653326dD0145656eC3b598943C0E84d7405aE6Ae` |
| UniversalBytecodeStoreV2 | `0x77e53f656Ee3c5A962e9DA2Fc97EA1A35ae9b4d5` |
| UniversalCreate2DeployerFromStore | `0x808f2Cf1b7e7afaC561dd9d2A2aA20be15EEb3fd` |
| CreatorOVaultCoreModule | `0xF670590D1070B1C30E8da76176E841b6e753fDb9` |
| CreatorOVaultStrategiesModule | `0x7cCFA3E1c7eF5ADab9C9676430c27244f8c8ec7A` |
| CreatorOVaultAdminModule | `0x48512Db9cDddC3f259036605A8eBD3C8e5dE1598` |
| DeploymentBatcher | `0x004684670d284EF607E1B2424fcf8ccBda8ef828` |
| DeploymentBatcherPhase2Module | `0x9794735D53dA4f0884eA43E2764A7E4dd2a38826` |
| DeploymentBatcherPhase3Helper | `0x7e4b2dd557bA62FD1Dd5f72CBf5FFAAaaB8A468c` |
| DeploymentBatcherUniV4Helper | `0xCd10BEcd96c13b63cEff49A646Eca1fe6D2f2CC7` |
| DeploymentBatcherUtilsHelper | `0xb79615C6B128E953347fcd6061DeaEc867482EEC` |

Notes:
- Shared/global contracts carry over where still canonical; the active deployment entrypoint is the split Phase-1 batcher above.
- The repo's canonical release target is `v1.10.2` for the active split Phase-1 stack.
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
