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

- **Shared infrastructure** (deployed once per chain, referenced via `Registry4626`)
- **Per-creator vault stack** (deployed per creator coin)
- **Optional incentives layer** (ve(3,3) voting, voter rewards, bribes)

Each creator vault has two extension families:

- **Legs (strategies)** — deploy and manage the **creator coin** in yield sleeves (Charm, Ajna; wired via `addStrategy`)
- **Arms** — **extend ShareOFT (■)** — launch, mesh liquidity, bridge routing, and trade-fee plumbing; never `addStrategy`

## Core Contracts

### 1. CreatorOVault (ERC-4626 Vault)

- Holds deposited Creator Coins (e.g., akita tokens)
- Mints vault shares (▢AKITA) representing proportional ownership
- Allocates deposits across multiple yield strategies
- Based on **Yearn V3** architecture (profit unlocking, strategy queues, debt purchasing)

### 2. CreatorOVaultWrapper

- Wraps ▢ → ■ for DEX + LayerZero (`NORMALIZATION_FACTOR = 1000`)
- `deposit()` presents ~1 creator coin ≈ 1 ■ — [Token units](/reference/glossary#token-units)

### 3. CreatorShareOFT (LayerZero V2 OFT)

- Omnichain ■ token; native fee on buy-side (`SwapOnly → non-SwapOnly`)
- Sell-side fees are hook-dependent
- Routes fees to `tradeFeeCollector` (typically `CreatorGaugeController`)
- Qualifying hub buys can trigger VRF lottery

### 4. CreatorGaugeController

- Receives trade fees; **immutable** BPS: **69% lottery (■)** · **21.39% voters (■)** · **9.61% burn (unwrap → ▢)** · **0% creator**
- Splits in ■ first; only the burn slice unwraps

### 5. LotteryManager4626

- Shared per-chain service on qualifying **buys**
- Win chance ≈ $1 → 0.0004%; Chainlink VRF 2.5
- Pays **ShareOFT ■** from the triggering gauge reserve (default single-vault)
- Optional boosts via `ve4626BoostManager` / `ve4626GaugeVoting`

Boundary: gauge = jackpot **custodian**; LotteryManager = **payout authority** (+ win-chance calc).
### 6. Share CCA launch arm (Uniswap CCA)

- **Vault arm** (not a leg / not `addStrategy`): fair-launch primary market for ■ ShareOFT via Uniswap **Continuous Clearing Auction**
- Onchain: `CCALaunchArm` (vault pointer: `ccaLaunchArm`)
- Post-graduation: `sweepCurrency()` → `migrate()` (V4 pool init + oracle only; **no LP mint**) → mesh arm (`OVaultLPManager`) via `seedLpManager` / `seedRebalance`
- Full launch completion still requires explicit hook config/alignment checks (separate operational step)

### 7. CreatorOracle (Price Oracle)

- Tracks real-time share token price via **Uniswap V4 TWAP**
- Used for vault accounting and lottery prize valuations

### 8. Registry4626

- Central registry for all platform contracts (canonical type: `Registry4626`, not legacy “CreatorRegistry”)
- Maps Creator Coins → (Vault, Wrapper, OFT, GaugeController, Lottery)
- Stores chain configurations (LayerZero endpoints, DEX infrastructure)

## Token Flow

```
Creator Coin (akita)  [Base only]
   ↓ Deposit (+ virtual offset ~×1000)
CreatorOVault (▢AKITA shares)
   ↓ Wrap (÷1000 normalization)
CreatorOVaultWrapper → CreatorShareOFT (■AKITA)
   ↓ Bridge (LayerZero V2)
Remote chain ShareOFT (■ only — no local vault / no creator-coin redeem)
```

User `wrapper.deposit()` presents ~1 creator coin → ~1 ■ (offsets cancel). Details: [Token units](/reference/glossary#token-units).

## Trading Fee Flow

```
User buys ■AKITA (qualifying SwapOnly → non-SwapOnly)
   ↓
Two fee planes:
  - Native OFT plane: buy-side transfer trigger
  - Hook plane: sell-side/additional policy if hook configured
   ↓
tradeFeeCollector (typically CreatorGaugeController)
   ↓ Split in ShareOFT ■ (immutable BPS):
     - 69% ■ → jackpotReserve (gauge custodian)
     - 21.39% ■ → voter branch (ve4626VoterRewardsDistributor)
     - 9.61% → unwrap → ▢ burned (PPS ↑)
LotteryManager4626 (payout authority)
   ↓ Calculates win chance ($1 = 0.0004%); instant Chainlink VRF roll
   ↓ Winner (if lucky) receives rewardPercentage of that gauge’s jackpotReserve in ShareOFT ■
```

## Deployment Flow

**User-facing goal**: One creator flow from `/deploy` (wallet/bundler may execute multiple transactions under the hood).

```
User clicks "Deploy" → wallet/bundler executes a phased sequence

Phase 1 — Deterministic deploy (deployment batcher):
- Deploy per-creator contracts (vault, wrapper, share OFT, gauge controller, oracle, share CCA launch arm)
- Register them in Registry4626

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
- **ve4626BoostManager**: Exposes personal boost signals used by `LotteryManager4626`
- **ve4626GaugeVoting**: Weekly voting that allocates a bounded probability budget across whitelisted vaults
- **ve4626VoterRewardsDistributor**: Receives the voter slice (21.39% ShareOFT) from each `CreatorGaugeController` and lets voters claim pro-rata per epoch/vault
- **BribesFactory4626 / BribeDepot4626**: Optional external bribes per vault (epoch-scoped)
