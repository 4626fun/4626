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
| Registry4626 | `0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461` |
| OVaultFactory4626 | `0x26b74b1d3AadD17e714068d259051409C9f942d1` |
| VaultActivationBatcher | `0xB06d99c81994F5829ba462c4afA78eCff75bC281` |
| LotteryManager4626 | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` |
| VRFConsumer4626 | `0x933A3BE4a4BF00dD3B71c50Dee4972539a32bE47` |
| SolanaBridgeAdapter | `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1` |
| UniversalBytecodeStoreV2 | `0x7D1029a832E2BEd2C961bC912b623b763862Ad3C` |
| UniversalCreate2DeployerFromStore | `0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0` |
| CreatorOVaultCoreModule | `0x396cF02c219cfA5288C3e472Fbc9634fe4D44B68` |
| CreatorOVaultStrategiesModule | `0x21BCC0461fC5890ca2a3C06707EAaea30736e8f7` |
| CreatorOVaultAdminModule | `0xba261a7B732f0a743Ea7187567ff93Ea3C9af93f` |
| DeploymentBatcher | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| DeploymentBatcherPhase1Module | `0xc7d44c4136f10a780B93cCA901F8Fcf2cc130bD1` |
| DeploymentBatcherPhase2Module | `0xD641076Ff1b1121c3cF85F5d69B386bCE91a6bb2` |
| DeploymentBatcherPhase3Helper | `0x38Abe158e1A71774Cfa014287b574d52051133Fc` |
| DeploymentBatcherShareMeshHelper | `0x64aA8ba6aD4641034Ca5A1bF31609a5fa9e5dc80` |
| DeploymentBatcherUtilsHelper | `0x5B59219683b748a321f84eFDfe5A29d3bB945B27` |

Notes:
- **v1.16.1-share-mesh** adds `CCALaunchArm` + post-CCA share-mesh LP manager completion on a fresh batcher shell. Phase 3 remains **45% Charm + 45% Ajna + 10% idle**; Solana is **ShareOFT mesh at Phase 2 finalize** (~30% via Pipe A).
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** use **Phase1Module immutables** (`phase1Module()` → `0xc7d44…`), not batcher-shell module getters.
- Pre-v1.16.1 batchers (`0x17163e…`, `0x660B25…`, `0xa99058…`, and older) are deprecated for **new vault launches**.

### Protocol Safes

| Role | Address |
|------|---------|
| Protocol treasury Safe (cold custody, strategy ownership) | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| Protocol automation Safe (hot lane — Charm manager, Ajna admin) | `0x08f0875E40781578F902998b2b831cc48d838eBE` |

Do **not** set `PROTOCOL_AUTOMATION_SAFE` to the treasury address. Phase 3 deploys wire Charm `manager` and Ajna `admin` to the automation Safe; treasury keeps adapter ownership only.

### AMOE (ZK lottery entry)

| Contract / role | Address | Notes |
|-----------------|---------|-------|
| `LotteryAmoeRouter` (v3, PLONK + 9 public inputs) | `0x066e11d795656A2A980585a414BC0fD6BB12e057` | **Production router.** Fan-out target = `LotteryManager4626` `0xD62a…` on Registry4626 `0x1eb9…`. |
| `LotteryManager4626` (v1.16.1) | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` | Canonical manager for AKITA + new stack. |
| Legacy `LotteryAmoeRouter` | `0xc57aedc38eba3edfa116f92b3fc427af7eb06b0a` | **Deprecated.** Was wired to v1.11 manager `0x04CADE…`; do not point Vercel here. |
| Legacy manager (v1.11) | `0x04CADE6FDf564A5005FF80930d8e8784cb1A7Cf8` | Pre–v1.16.1. Kill-switch relayer after cutover. |
| Allowlist + ledger publisher | `0xAb6d5C10b03300326cd7fab7267ae192842967b5` | Canonical CSW — must match on-chain `allowlistPublisher` / `pointsLedgerPublisher`. |
| Protocol AMOE creator coin (AKITA) | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | Default target for protocol-entry AMOE flows. |

**Cutover checklist (production):**

1. `./script/wire-amoe-router-v1161.sh` — `router.setManager(0xD62a…)`, `manager.setAuthorizedAmoeRelayer(0x066e11…)`, publishers → canonical CSW.
2. Set `LOTTERY_AMOE_ROUTER=0x066e11d795656A2A980585a414BC0fD6BB12e057` on Vercel (`production`, `preview`, `development`) and redeploy.
3. Republish allowlist + points-ledger Merkle roots on the v3 router (`/api/v1/lottery/amoe/publish-cron` or manual ops). Roots are **one-shot per epoch** on each router address.
4. Confirm signed AMOE messages embed `Lottery Manager: 0xD62a…` (nonce API reads live `LOTTERY_MANAGER` env).

## Environment cutover (v1.16.1-share-mesh)

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Server env | Client (Vite) env | v1.16.1-share-mesh value |
|------------|-------------------|---------------------------|
| `CREATOR_REGISTRY` | `VITE_REGISTRY` | `0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461` |
| `CREATOR_FACTORY` | `VITE_FACTORY` | `0x26b74b1d3AadD17e714068d259051409C9f942d1` |
| `VAULT_ACTIVATION_BATCHER` | `VITE_VAULT_ACTIVATION_BATCHER` | `0xB06d99c81994F5829ba462c4afA78eCff75bC281` |
| `LOTTERY_MANAGER` | `VITE_LOTTERY_MANAGER` | `0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b` |
| `UNIVERSAL_BYTECODE_STORE` | `VITE_UNIVERSAL_BYTECODE_STORE` | `0x7D1029a832E2BEd2C961bC912b623b763862Ad3C` |
| `UNIVERSAL_CREATE2_FROM_STORE`, `UNIVERSAL_CREATE2_DEPLOYER` | `VITE_UNIVERSAL_CREATE2_DEPLOYER` | `0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0` |
| `DEPLOYMENT_BATCHER`, `CREATOR_VAULT_BATCHER` | `VITE_CREATOR_VAULT_BATCHER` | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| `CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| `SOLANA_BRIDGE_ADAPTER` | `VITE_SOLANA_BRIDGE_ADAPTER` | `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1` |
| `LOTTERY_AMOE_ROUTER` | — | `0x066e11d795656A2A980585a414BC0fD6BB12e057` |
| — | `VITE_DEPLOYMENT_VERSION` | `v1.16.1` |

`VITE_DEPLOYMENT_VERSION` pins the CREATE2 namespace for **new vault launches**.

**Deploy script env overrides:** when running `./script/deploy-infra-v2.sh` or `./script/upgrade-batcher-shell-share-mesh.sh`, pin `REGISTRY=0x1eb9A3…`, `VAULT_ACTIVATION_BATCHER=0xB06d99…`, `PROTOCOL_TREASURY=0x7d429e…`, and `PROTOCOL_AUTOMATION_SAFE=0x08f0875…` if not already in `.env`. If the live Phase3 helper still points automation at treasury, run `./script/upgrade-phase3-automation.sh` after the shell cutover.

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
