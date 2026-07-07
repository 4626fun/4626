---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed contract addresses for 4626 on Base mainnet (**v1.15.0**).

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
| DeploymentBatcher | `0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33` |
| DeploymentBatcherPhase1Module | `0x829D0096fF18F096469Ae9D440f58Ae0D106ff06` |
| DeploymentBatcherPhase2Module | `0x362495324370f68b30a57743254b154eD6115524` |
| DeploymentBatcherPhase3Helper | `0xa5Ba1121214b9187749dfeb1382393c1941e0Da8` |
| DeploymentBatcherUniV4Helper | `0xa2D06A329eD7b413646509845412f8C73CbbeDBF` |
| DeploymentBatcherUtilsHelper | `0x5B59219683b748a321f84eFDfe5A29d3bB945B27` |

Notes:
- **v1.15.0** is a full shared/global + split Phase-1 refresh with July 2026 audit fixes. Phase 3 is **45% Charm + 45% Ajna + 10% idle**; Solana is **ShareOFT mesh at Phase 2 finalize** (~30% via Pipe A).
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** use **Phase1Module immutables** (`phase1Module()` → `0x829D…`), not batcher-shell module getters.
- Pre-v1.15.0 batchers (`0x660B25…`, `0xa99058…`, and older) are deprecated for **new vault launches**.

## Environment cutover (v1.15.0)

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env | Client (Vite) env | v1.15.0 value |
|------------|-------------------|----------------|
| `CREATOR_REGISTRY` | `VITE_REGISTRY` | `0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461` |
| `CREATOR_FACTORY` | `VITE_FACTORY` | `0x26b74b1d3AadD17e714068d259051409C9f942d1` |
| `VAULT_ACTIVATION_BATCHER` | `VITE_VAULT_ACTIVATION_BATCHER` | `0xB06d99c81994F5829ba462c4afA78eCff75bC281` |
| `LOTTERY_MANAGER` | `VITE_LOTTERY_MANAGER` | `0x29F901864D65Eb848BC548ebCEacD6dAD39EFd26` |
| `UNIVERSAL_BYTECODE_STORE` | `VITE_UNIVERSAL_BYTECODE_STORE` | `0x7D1029a832E2BEd2C961bC912b623b763862Ad3C` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER` | `0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0` |
| `DEPLOYMENT_BATCHER`, `CREATOR_VAULT_BATCHER` | `VITE_CREATOR_VAULT_BATCHER` | `0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33` |
| `CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33` |
| `SOLANA_BRIDGE_ADAPTER` | `VITE_SOLANA_BRIDGE_ADAPTER` | `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1` |
| — | `VITE_DEPLOYMENT_VERSION` | `v1.15.0` |

`VITE_DEPLOYMENT_VERSION` pins the CREATE2 namespace for **new vault launches**.

**Deploy script env overrides:** when running `./script/deploy-infra-v2.sh`, pin `REGISTRY=0x1eb9A3…`, `VAULT_ACTIVATION_BATCHER=0xB06d99…`, and `PROTOCOL_AUTOMATION_SAFE=0x7d429e…` if not already in `.env`.

Redeploy the Vercel app after env changes; run `pnpm -C frontend ops:verify-akita-prelaunch --production` and `verify-bytecode-store-seeded.ts` against `deployments/base/v1.15.0-bytecode-manifest.json` before traffic cutover.

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
