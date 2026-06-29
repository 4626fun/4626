---
title: Contract Addresses
sidebar_position: 1
---

# Contract Addresses

Canonical deployed contract addresses for 4626 on Base mainnet (**v1.14.1**).

For launch procedures, see [Getting started](/getting-started). This page lists **shared infrastructure** (batcher, factories, registry). Per-creator vault, wrapper, and ShareOFT addresses are emitted at deploy and available in the application and onchain events.

> **Terms:** **New vault launch** = fresh deploy on the current release (internal: *greenfield*). **Solana bridge at finalize** = ~30% of `■` bridged during activation (internal: *Pipe A*). See [Glossary](/reference/glossary#quick-definitions).

> **Canonical source.** When documentation or tooling disagrees with this file, **this file wins**.

## Base

### Current infrastructure

| Contract | Address |
|----------|---------|
| CreatorRegistry | `0xDD7B106a15540bA2F59464590222bF47D8C9394E` |
| CreatorOVaultFactory | `0xf4a4d70D9fB3b29c56eB2aaE264FBd3DF9221A6a` |
| VaultActivationBatcher | `0x5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A` |
| CreatorLotteryManager | `0x29F901864D65Eb848BC548ebCEAcD6dAD39EFd26` |
| CreatorVRFConsumerV2_5 | `0x86B605400DBb67cc4756493c7791422184e4dC59` |
| SolanaBridgeAdapter | `0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae` |
| UniversalBytecodeStoreV2 | `0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314` |
| UniversalCreate2DeployerFromStore | `0x2fA570Cb17925Da86b303D4651f06b83057a10c4` |
| CreatorOVaultCoreModule | `0xD4553478780571A1A5F6cCCC0735F897F15a85Cf` |
| CreatorOVaultStrategiesModule | `0x4036e3D2d029451cEB68d521a5D0233F56518681` |
| CreatorOVaultAdminModule | `0xDd136c20F8f6688089e55a6CA8709718c5183307` |
| DeploymentBatcher | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| DeploymentBatcherPhase1Module | `0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266` |
| DeploymentBatcherPhase2Module | `0xde192645Fb02dD05f586930e55D709E89c320435` |
| DeploymentBatcherPhase3Helper | `0xE0971a924E33251556fE73a4025166701b772dBe` |
| DeploymentBatcherUniV4Helper | `0xD2c68F175FB4DB4069A2ebBc3f02B31C635438eb` |
| DeploymentBatcherUtilsHelper | `0xE41231e399511baaDa8844C9D1c83C096e3f2E60` |

Notes:
- **v1.14.1** is a full shared/global + split Phase-1 refresh that keeps CreatorOVault `CreatorOVaultModuleStorage.v3` and rotates the batcher shell, helper modules, registry, and store/deployer pair.
- `DeploymentBatcher` deploys as a slim shell; helpers and `DeploymentBatcherPhase1Module` wire post-deploy via protocol treasury Safe (`wireDeploymentHelpers` + `setPhase1Module`).
- **New vault launches** (greenfield) use **Phase1Module immutables** (`phase1Module()` → `0x0fac…`), not batcher-shell module getters (shell may still expose legacy `.current` modules).
- Retired v1.13.0 Phase1Module (`0x19Bd8…`) is for **legacy vaults** only — not for new launches after the v1.14.1 cutover.
- Pre-v1.14.1 batchers (`0xa99058…` and older) are deprecated for **new vault launches**.

## Environment cutover (v1.14.1)

After an infra epoch deploy, update **local `.env`**, **Vercel** (`production`, `preview`, `development`), and any operator host env to these keys. Canonical values:

| Env key | v1.14.1 value |
|---------|----------------|
| `CREATOR_REGISTRY` / `VITE_REGISTRY` | `0xDD7B106a15540bA2F59464590222bF47D8C9394E` |
| `CREATOR_FACTORY` / `VITE_FACTORY` | `0xf4a4d70D9fB3b29c56eB2aaE264FBd3DF9221A6a` |
| `VAULT_ACTIVATION_BATCHER` / `VITE_VAULT_ACTIVATION_BATCHER` | `0x5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A` |
| `LOTTERY_MANAGER` / `VITE_LOTTERY_MANAGER` | `0x29F901864D65Eb848BC548ebCEAcD6dAD39EFd26` |
| `UNIVERSAL_BYTECODE_STORE` / `VITE_UNIVERSAL_BYTECODE_STORE` | `0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314` |
| `UNIVERSAL_CREATE2_FROM_STORE` / `UNIVERSAL_CREATE2_DEPLOYER` / `VITE_UNIVERSAL_CREATE2_DEPLOYER` | `0x2fA570Cb17925Da86b303D4651f06b83057a10c4` |
| `DEPLOYMENT_BATCHER` / `CREATOR_VAULT_BATCHER` / `VITE_CREATOR_VAULT_BATCHER` | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| `CREATOR_VAULT_BATCHER_AUTO_HANDOFF` / `VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF` | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| `SOLANA_BRIDGE_ADAPTER` / `VITE_SOLANA_BRIDGE_ADAPTER` | `0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae` |
| `VITE_DEPLOYMENT_VERSION` | `v1.14.1` (CREATE2 namespace for **new vault launches**) |

**Deploy script env overrides:** when running `./script/deploy-infra-v2.sh`, pin `REGISTRY=0xDD7B106…`, `VAULT_ACTIVATION_BATCHER=0x5EaFfa41…`, and `PROTOCOL_AUTOMATION` to the protocol treasury Safe (`0x7d429e…`) if not already in `.env` — stale local values predict the wrong CREATE2 batcher address.

Redeploy the Vercel app after env changes; run `pnpm -C frontend ops:verify-akita-prelaunch --production` and `verify-bytecode-store-seeded.ts` against `deployments/base/v1.14.1-bytecode-manifest.json` before traffic cutover.

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
