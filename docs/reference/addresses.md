---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Deployed contract addresses for 4626.

## Base (Hub Chain)

### Current Live Infrastructure (`v1.9.2` deploy namespace, `v1.8.3` infra broadcast)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb` |
| CreatorOVaultFactory | `0xC7E919899Fd4C0C4f6f4269a63046107f85848bB` |
| VaultActivationBatcher | `0x7Cc0050842433968cc7A0884d192b61FD0b46F63` |
| CreatorLotteryManager | `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357` |
| CreatorVRFConsumerV2_5 | `0xdd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47` |
| SolanaBridgeAdapter | `0x653326dD0145656eC3b598943C0E84d7405aE6Ae` |
| UniversalBytecodeStoreV2 | `0xA009B1Bf8cB711c115d832AEb392156BA6A4112e` |
| UniversalCreate2DeployerFromStore | `0xFd2657b6f1905C3F0494942F618a68963CF792Ec` |
| CreatorOVaultCoreModule | `0xeD728378f969f8e94a19fC081172D1e67B80412e` |
| CreatorOVaultStrategiesModule | `0x0f1A26b93AD56BBbC5e0486A920621944FF6ABd6` |
| CreatorOVaultAdminModule | `0xFC40e9768eeaAE634CBD2A72DA0CF809d3c908e0` |
| DeploymentBatcher | `0xcDbEeB764df9878ebAFbf101cc818370f703bC4F` |
| DeploymentBatcherPhase3Helper | `0xF185Cb60E108E324f67e75cf8106B8e9950c16ed` |
| DeploymentBatcherUniV4Helper | `0xfe1C5eaa76942208298f510c820e7E8328f6d031` |

Notes:
- Shared/global contracts were freshly broadcast for the current live Base infra epoch and handed off into the deterministic v2 batcher deployment.
- The repo's canonical deployment namespace is `v1.9.2` (fresh CREATE2 salt space for new per-creator deploys); the addresses above come from the `v1.8.3` infra broadcast that backs them.
- `DeploymentBatcherPhase3Helper` and `DeploymentBatcherUniV4Helper` are constructor-created by `DeploymentBatcher`.
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
