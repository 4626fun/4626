---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Deployed contract addresses for 4626.

## Base (Hub Chain)

### Shared Infrastructure (current live `v1.7.1`, planned vanity `v1.8.1`)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| VaultActivationBatcher | `0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB` |
| CreatorLotteryManager | `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` |
| CreatorVRFConsumerV2_5 | `0x9F85d8EEe5d2b8dC1E99b598B9c2B084934d0304` |
| UniversalBytecodeStoreV2 | `0x6A578022609cdb65C614FF28912C49FC1EC97071` live, `0x58071d59d2f5E61A80b3f8770B6564289acD4626` planned |
| UniversalCreate2DeployerFromStore | `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a` live, `0x1c1596090B0e0Bb35b2F7cd77e865FbeE3654626` planned |
| DeploymentBatcher | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` live, `0xaE81C19c2A2E964e65cCacE89A6eb2309d6E4626` planned |
| DeploymentBatcherPhase3Helper | `0x74F204C95F959B7f4f4e927B6c56CF1026f4789F` live, `0x625992eAdA5942192b029c2a0DF5cBECc65509FB` planned |
| SolanaBridgeAdapter | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` |

Notes:
- `DeploymentBatcherPhase3Helper` is created by the `DeploymentBatcher` constructor.
- `DeploymentBatcher` is forensically matched to onchain deployment payload and intentionally explorer-unverified for this epoch.
- Planned vanity addresses come from `deployments/base/v1.8.1-vanity-manifest.json` and are enforced by deploy-script preflight.

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
