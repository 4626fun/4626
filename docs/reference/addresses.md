---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Deployed contract addresses for 4626.

## Base (Hub Chain)

### Shared Infrastructure (`v1.7.1` canonical epoch)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| VaultActivationBatcher | `0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB` |
| CreatorLotteryManager | `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` |
| CreatorVRFConsumerV2_5 | `0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304` |
| UniversalBytecodeStoreV2 | `0x6A578022609cdb65C614FF28912C49FC1EC97071` |
| UniversalCreate2DeployerFromStore | `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a` |
| DeploymentBatcher | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` |
| DeploymentBatcherPhase3Helper | `0x74F204C95F959B7f4f4e927B6c56CF1026f4789F` |
| SolanaBridgeAdapter | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` |

Notes:
- `DeploymentBatcherPhase3Helper` is created by the `DeploymentBatcher` constructor.
- `DeploymentBatcher` is forensically matched to onchain deployment payload and intentionally explorer-unverified for this epoch.

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
