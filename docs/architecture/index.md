---
title: Architecture
sidebar_position: 3
---

# Architecture

4626's architecture is built for **provenance, identity, and execution**:

- **Provenance (Zora / AgentTokenV4)**: Creator Coins and Agent tokens are discovery / identity anchors for their product lanes
- **Execution (Smart Wallet AA)**: Operators deploy and run vault infrastructure via EIP-4337/EIP-5792-style batching
- **Social context (Farcaster → Base)**: Farcaster identity is a trust signal; Base group chats are a coordination surface

Canonical product-lane reference: [Product lanes](./product-lanes.md) · folder map: [`contracts/README.md`](../../contracts/README.md).

## Three axes (do not conflate)

| Axis | Meaning |
|------|---------|
| **Product vault lane** | `VaultKind.Creator` → `contracts/creator/` (■/▢) · `VaultKind.Agent` → `contracts/agent/` (◆/◇, FOT). Unrelated to XMTP/Keepr. |
| **Value lanes** | Gauge split: **69%** jackpot · **21.39%** voters · **9.61%** burn · **0%** creator ongoing |
| **Runtime agent** | Canonical CSW / XMTP Keepr / deploy-session automation — not a vault product lane |

## System Overview

Onchain, 4626 consists of:

- **Shared infrastructure** (`contracts/shared/`) — once per chain via `Registry4626`, lottery, ve, strategies, batchers
- **Per-token vault stacks** — creator lane and/or agent lane (deployed per underlying token)
- **Non-mesh products** (`contracts/other/`, e.g. AlfaClub) — outside the OVault mesh until they need ShareOFT/gauge/lottery
- **Optional incentives layer** (ve(3,3) voting, voter rewards, bribes)

Each mesh vault has two extension families:

- **Legs (strategies)** — yield sleeves on the vault **asset** (Charm, Ajna; `addStrategy`)
- **Arms** — extend ShareOFT (■ or ◆) — launch, mesh liquidity, bridge routing, trade-fee plumbing; never `addStrategy`

## Core Contracts

### 1. CreatorOVault / AgentOVault (ERC-4626)

- Holds deposited lane assets (Zora creator coin or AgentTokenV4)
- Mints vault shares (▢ / ◇) representing proportional ownership
- Allocates deposits across yield strategies (Yearn V3-style)
- Agent lane uses measured fee-on-transfer accounting (`AgentOVaultCoreModule`)

### 2. CreatorOVaultWrapper / AgentOVaultWrapper

- Wraps ▢→■ or ◇→◆ for DEX + LayerZero (`NORMALIZATION_FACTOR = 1000`)
- `deposit()` presents ~1 underlying ≈ 1 share token — [Token units](/reference/glossary#token-units)

### 3. CreatorShareOFT / AgentShareOFT (LayerZero V2 OFT)

- Omnichain share token; native fee on buy-side (`SwapOnly → non-SwapOnly`)
- Sell-side fees are hook-dependent
- Routes fees to `tradeFeeCollector` (typically the lane gauge controller)
- Qualifying hub buys can trigger VRF lottery

### 4. CreatorGaugeController / AgentGaugeController

- Receives trade fees; **immutable** BPS: **69% lottery** · **21.39% voters** · **9.61% burn** · **0% creator**
- Splits in share-token units first; only the burn slice unwraps

### 5. LotteryManager4626

- Shared per-chain service on qualifying **buys** (all product lanes)
- Win chance ≈ $1 → 0.0004%; Chainlink VRF 2.5
- Pays ShareOFT from the triggering gauge reserve (default single-vault)
- Optional boosts via `ve4626BoostManager` / `ve4626GaugeVoting`

Boundary: gauge = jackpot **custodian**; LotteryManager = **payout authority** (+ win-chance calc).

### 6. Share CCA launch arm (Uniswap CCA)

- **Vault arm** (not a leg / not `addStrategy`): fair-launch primary market for ShareOFT via Uniswap **Continuous Clearing Auction**
- Onchain: `CCALaunchArm` (vault pointer: `ccaLaunchArm`)
- Post-graduation: `sweepCurrency()` → `migrate()` (V4 pool init + oracle only; **no LP mint**) → mesh arm (`OVaultLPManager`) via `seedLpManager` / `seedRebalance`
- Full launch completion still requires explicit hook config/alignment checks (separate operational step)

### 7. CreatorOracle / AgentOracle

- Tracks share / asset price (V4/V3 TWAP; agent adds V2 pair path)
- Both implement lane-neutral `IOracle4626`
- Used for vault accounting and lottery prize valuations

### 8. Registry4626

- Central registry for all mesh tokens (canonical type: `Registry4626`)
- Maps underlying token → (Vault, Wrapper, OFT, GaugeController, Oracle)
- `getVaultKind(token)` from lane meta set at deploy (`setAgentIntegrationMeta`; authorized factory or owner)
- Stores chain configurations (LayerZero endpoints, DEX infrastructure)

## Token Flow

```
Underlying (creator coin or AgentTokenV4)  [Base hub]
   ↓ Deposit (+ virtual offset ~×1000)
OVault (▢ or ◇ shares)
   ↓ Wrap (÷1000 normalization)
Wrapper → ShareOFT (■ or ◆)
   ↓ Bridge (LayerZero V2)
Remote chain ShareOFT (share token only — no local vault / no underlying redeem)
```

User `wrapper.deposit()` presents ~1 underlying → ~1 ShareOFT (offsets cancel). Details: [Token units](/reference/glossary#token-units).

## Trading Fee Flow

```
User buys ShareOFT (qualifying SwapOnly → non-SwapOnly)
   ↓
Two fee planes:
  - Native OFT plane: buy-side transfer trigger
  - Hook plane: sell-side/additional policy if hook configured
   ↓
tradeFeeCollector (typically lane GaugeController)
   ↓ Split in ShareOFT (immutable BPS):
     - 69% → jackpotReserve (gauge custodian)
     - 21.39% → voter branch (ve4626VoterRewardsDistributor)
     - 9.61% → unwrap → vault shares burned (PPS ↑)
LotteryManager4626 (payout authority)
   ↓ Calculates win chance ($1 = 0.0004%); instant Chainlink VRF roll
   ↓ Winner (if lucky) receives rewardPercentage of that gauge’s jackpotReserve in ShareOFT
```

## Deployment Flow

**User-facing goal**: One flow from `/deploy` (wallet/bundler may execute multiple transactions). `vaultKind` selects creator vs agent bytecode / salts / core module.

```
User clicks "Deploy" → wallet/bundler executes a phased sequence

Phase 1 — Deterministic deploy (deployment batcher):
- Deploy per-token contracts (vault, wrapper, share OFT, …) for the selected VaultKind
- Persist vaultKind in phase1 state

Phase 2 — Configuration (deployment batcher):
- Wire roles + addresses; set gauge asset via setCreatorCoin or setAgentToken
- Register bindings in Registry4626 when applicable; setAgentIntegrationMeta(vaultKind)
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

- **ve4626**: Vote-escrow token that represents locked power ([ve naming](../contracts/governance/ve-naming.md))
- **ve4626BoostManager**: Exposes personal boost signals used by `LotteryManager4626`
- **ve4626GaugeVoting**: Weekly voting that allocates a bounded probability budget across whitelisted vaults
- **ve4626VoterRewardsDistributor**: Receives the voter slice (**21.39%** ShareOFT) from each gauge and lets voters claim pro-rata per epoch/vault
- **BribesFactory4626 / BribeDepot4626**: Optional external bribes per vault (epoch-scoped)
