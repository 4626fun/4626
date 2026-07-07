---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed contract addresses for 4626 on Base mainnet (**v1.16.1-share-mesh**).

For launch procedures, see [Getting started](/getting-started). This page lists **shared infrastructure** (batcher, factories, registry). Per-creator vault, wrapper, and ShareOFT addresses are emitted at deploy and available in the application and onchain events.

> **Terms:** **New vault launch** = fresh deploy on the current release (internal: *greenfield*). **Solana bridge at finalize** = ~30% of `■` bridged during activation (internal: *Pipe A*). See [Glossary](/reference/glossary#quick-definitions).

> **Canonical source.** When documentation or tooling disagrees with this file, **this file wins**. Addresses link to [BaseScan](https://basescan.org) on Base mainnet.

## Base

### Current infrastructure

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461` |
| OVaultFactory4626 | `0x26b74b1d3AadD17e714068d259051409C9f942d1` |
| VaultActivationBatcher | `0xB06d99c81994F5829ba462c4afA78eCff75bC281` |
| CreatorLotteryManager | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` |
| CreatorVRFConsumerV2_5 | `0x933A3BE4a4BF00dD3B71c50Dee4972539a32bE47` |
| SolanaBridgeAdapter | `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1` |
| UniversalBytecodeStoreV2 | `0x7D1029a832E2BEd2C961bC912b623b763862Ad3C` |
| UniversalCreate2DeployerFromStore | `0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0` |
| CreatorOVaultCoreModule | `0x396cF02c219cfA5288C3e472Fbc9634fe4D44B68` |
| CreatorOVaultStrategiesModule | `0x21BCC0461fC5890ca2a3C06707EAaea30736e8f7` |
| CreatorOVaultAdminModule | `0xba261a7B732f0a743Ea7187567ff93Ea3C9af93f` |
| DeploymentBatcher | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| DeploymentBatcherPhase1Module | `0xc7d44c4136f10a780B93cCA901F8Fcf2cc130bD1` |
| DeploymentBatcherPhase2Module | `0xD641076Ff1b1121c3cF85F5d69B386bCE91a6bb2` |
| DeploymentBatcherPhase3Helper | `0x219eA6e7c28b20c668CbaCD99246C1c17a5D97F6` |
| DeploymentBatcherShareMeshHelper | `0x64aA8ba6aD4641034Ca5A1bF31609a5fa9e5dc80` |
| DeploymentBatcherUtilsHelper | `0x5B59219683b748a321f84eFDfe5A29d3bB945B27` |

Notes:
- **v1.16.1-share-mesh** adds `CCALaunchArm` + post-CCA share-mesh LP manager completion on a fresh batcher shell. Phase 3 remains **45% Charm + 45% Ajna + 10% idle**; Solana is **ShareOFT mesh at Phase 2 finalize** (~30% via Pipe A).
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** use **Phase1Module immutables** (`phase1Module()` → `0xc7d44…`), not batcher-shell module getters.
- Pre-v1.16.1 batchers (`0x17163e…`, `0x660B25…`, `0xa99058…`, and older) are deprecated for **new vault launches**.

## Environment cutover (v1.16.1-share-mesh)

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env | Client (Vite) env | v1.16.1-share-mesh value |
|------------|-------------------|---------------------------|
| `CREATOR_REGISTRY` | `VITE_REGISTRY` | `0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461` |
| `CREATOR_FACTORY` | `VITE_FACTORY` | `0x26b74b1d3AadD17e714068d259051409C9f942d1` |
| `VAULT_ACTIVATION_BATCHER` | `VITE_VAULT_ACTIVATION_BATCHER` | `0xB06d99c81994F5829ba462c4afA78eCff75bC281` |
| `LOTTERY_MANAGER` | `VITE_LOTTERY_MANAGER` | `0x29F901864D65Eb848BC548ebCEacD6dAD39EFd26` |
| `UNIVERSAL_BYTECODE_STORE` | `VITE_UNIVERSAL_BYTECODE_STORE` | `0x7D1029a832E2BEd2C961bC912b623b763862Ad3C` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER` | `0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0` |
| `DEPLOYMENT_BATCHER`, `CREATOR_VAULT_BATCHER` | `VITE_CREATOR_VAULT_BATCHER` | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| `CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| `SOLANA_BRIDGE_ADAPTER` | `VITE_SOLANA_BRIDGE_ADAPTER` | `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1` |
| — | `VITE_DEPLOYMENT_VERSION` | `v1.16.1` |

`VITE_DEPLOYMENT_VERSION` pins the CREATE2 namespace for **new vault launches**.

**Deploy script env overrides:** when running `./script/deploy-infra-v2.sh`, pin `REGISTRY=0x1eb9A3…`, `VAULT_ACTIVATION_BATCHER=0xB06d99…`, and `PROTOCOL_AUTOMATION_SAFE=0x7d429e…` if not already in `.env`.

Redeploy the Vercel app after env changes; run `pnpm -C frontend ops:verify-akita-prelaunch --production` and `verify-bytecode-store-seeded.ts` against `deployments/base/v1.16.1-bytecode-manifest.json` before traffic cutover.

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
