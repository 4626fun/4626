---
title: Architecture
sidebar_position: 3
---

# Architecture

4626's architecture is built for **provenance, identity, and execution**:

- **Provenance (Zora)**: Creator Coins and Content Coins are the discovery layer and identity anchor
- **Execution (Smart Wallet AA)**: Creators can deploy and operate vault infrastructure via EIP-4337/EIP-5792-style batching
- **Social context (Farcaster → Base)**: Farcaster identity is used as a trust signal, and Base group chats are the natural coordination surface

## System Overview

Onchain, 4626 consists of:

- **Shared infrastructure** (deployed once per chain, referenced via `CreatorRegistry`)
- **Per-creator vault stack** (deployed per creator coin)
- **Optional incentives layer** (ve(3,3) voting, voter rewards, bribes)

## Core Contracts

### 1. CreatorOVault (ERC-4626 Vault)

- Holds deposited Creator Coins (e.g., akita tokens)
- Mints vault shares (▢AKITA) representing proportional ownership
- Allocates deposits across multiple yield strategies
- Based on **Yearn V3** architecture (profit unlocking, strategy queues, debt purchasing)

### 2. CreatorOVaultWrapper

- Wraps vault shares (▢AKITA) into **LayerZero OFT** share tokens (■AKITA)
- Enables cross-chain transfers via LayerZero V2 messaging
- 1:1 wrapping ratio (no dilution)

### 3. CreatorShareOFT (LayerZero V2 OFT)

- **Omnichain fungible token** - same token on all chains
- Collects **6.9% fee on all DEX trades** (buys and sells) via `setAddressType` for DEX pools
- Routes fees to **CreatorGaugeController**
- Triggers instant lottery roll for all traders (win or lose determined immediately)

### 4. CreatorGaugeController

- Receives trading fees from all share tokens
- Splits fees: **69% lottery**, **21.39% burn**, **9.61% voter rewards**
- Unwraps fees into vault shares and routes them by configured splits

### 5. CreatorLotteryManager

- **Shared service** (one per chain): triggered by approved swap contracts
- Calculates instant win probability (percentage-based: $1 traded = 0.0004% chance)
- Integrates **Chainlink VRF 2.5** for provably fair randomness on every qualifying trade
- Winners receive 69% of jackpot reserve in **vault shares from ALL active creator vaults** (diversified prize!)
- **Instant lottery** - each trade is an independent roll, winners paid immediately
- Optional boosts via `ve4626BoostManager` and `VaultGaugeVoting`

### 6. CreatorCCAStrategy (Uniswap CCA Integration)

- Allocates vault assets to **Uniswap Continuous Clearing Auction** for fair launch price discovery
- After auction ends, migrates liquidity to Uniswap V4 pool for ongoing trading

### 7. CreatorOracle (Price Oracle)

- Tracks real-time share token price via **Uniswap V4 TWAP**
- Used for vault accounting and lottery prize valuations

### 8. CreatorRegistry

- Central registry for all platform contracts
- Maps Creator Coins → (Vault, Wrapper, OFT, GaugeController, Lottery)
- Stores chain configurations (LayerZero endpoints, DEX infrastructure)

## Token Flow

```
Creator Coin (akita)
   ↓ Deposit
CreatorOVault (▢AKITA shares)
   ↓ Wrap
CreatorOVaultWrapper
   ↓ Mint
CreatorShareOFT (■AKITA)
   ↓ Bridge
LayerZero V2 Messaging → Arbitrum, Ethereum, BSC, etc.
   ↓ Unwrap on destination chain
▢AKITA → Redeem → akita (if available on that chain)
```

## Trading Fee Flow

```
User trades ■AKITA on Uniswap V4 (buy or sell)
   ↓ 6.9% fee deducted
CreatorShareOFT.transfer hook
   ↓ Send fee
CreatorGaugeController
   ↓ Route by configured split:
     - 69% → Lottery prize pool
     - 21.39% → Burned (increases PPS)
     - 9.61% → Voter rewards
CreatorLotteryManager (prize pool)
   ↓ Calculate percentage-based win chance ($1 = 0.0004%)
   ↓ Instant Chainlink VRF roll
   ↓ Winner (if lucky) receives 69% of prize pool in vault shares
```

## Deployment Flow

**User-facing goal**: One creator flow from `/deploy` (wallet/bundler may execute multiple transactions under the hood).

```
User clicks "Deploy" → wallet/bundler executes a phased sequence

Phase 1 — Deterministic deploy (deployment batcher):
- Deploy per-creator contracts (vault, wrapper, share OFT, gauge controller, oracle, CCA strategy)
- Register them in CreatorRegistry

Phase 2 — Configuration (deployment batcher):
- Wire roles + addresses (vault↔wrapper↔OFT, gauge controller config, oracle config)
- Set required approvals/launch permissions

Phase 3 — Optional activation + launch:
- For "go live" actions (deposit → wrap → start CCA), use VaultActivationBatcher
- Wallets that support batching can combine approve+activate; otherwise execute sequentially

Notes:
- Gas sponsorship depends on the configured paymaster/bundler
- Not all wallets/chains will be sponsored
```

## Incentives Layer (Optional)

This layer can be deployed and enabled after the core system is live:

- **ve4626**: Vote-escrow token that represents locked power
- **ve4626BoostManager**: Exposes personal boost signals used by `CreatorLotteryManager`
- **VaultGaugeVoting**: Weekly voting that allocates a bounded probability budget across whitelisted vaults
- **VoterRewardsDistributor**: Receives the voter slice (9.61% default) from each `CreatorGaugeController` and lets voters claim pro-rata per epoch/vault
- **BribesFactory / BribeDepot**: Optional external bribes per vault (epoch-scoped)
