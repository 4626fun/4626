---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Deployed contract addresses for 4626.

## Base (Hub Chain)

### Canonical Infrastructure (`v1.8.2` full redeploy)

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x79d0d68904BbB50361C9721CbDD17276E046771D` |
| CreatorOVaultFactory | `0xb66aA49d94569a8589f380D53e8a3f1F60165000` |
| VaultActivationBatcher | `0x8b63912cD2490D1Ab0796c57Cc5909fF0059CECd` |
| CreatorLotteryManager | `0xA137BEef789B80c76187E1b6DEef60fC7db6d280` |
| CreatorVRFConsumerV2_5 | `0x22ae936027Fe0c348758634bF8694E00D96338ac` |
| SolanaBridgeAdapter | `0x1B3E713852dEC5d983AD11BD1567eed0723ceA9b` |
| UniversalBytecodeStoreV2 | `0xc8050cfeDA4CCd04079f37f1D95cD54279156E46` |
| UniversalCreate2DeployerFromStore | `0x95700DA39462f97b0E874ED7e05BBF76413d7Ac1` |
| CreatorOVaultCoreModule | `0xf2367B030992e5661503bb9Bc7e712cf66799bC7` |
| CreatorOVaultStrategiesModule | `0x897837200b1f4F8D6bec9b00d56Ed0189f55832b` |
| CreatorOVaultAdminModule | `0x940C8Fc97295AA4D9D2C5FcB26571BB4a98bbC19` |
| DeploymentBatcher | `0x721420F190cc4525bb8Adc72D4c66eEB806AFC37` |
| DeploymentBatcherPhase3Helper | `0x42612DA05Bd72d9B58f0Fa63161dDd8a3FEFd568` |
| DeploymentBatcherUniV4Helper | `0x5Ed8A640abF700e4c3A627Ad7cc8A8bdDEe5F34f` |

Notes:
- Shared/global contracts were freshly broadcast for the `v1.8.2` release and handed off into the deterministic v2 batcher deployment.
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
