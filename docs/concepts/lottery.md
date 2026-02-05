---
title: Lottery
sidebar_position: 3
---

# Instant Lottery

CreatorVault features an instant lottery powered by Chainlink VRF where every trade is a chance to win.

## How It Works

1. **Trade** any amount of ■TOKEN on a DEX
2. **Win chance calculated** based on trade size
3. **Chainlink VRF** generates random number instantly
4. **Winner (if lucky)** receives 69% of prize pool
5. **Prize paid** in vault shares from ALL active vaults

## Win Probability

**Formula**: For every **$1 traded** = **0.0004% instant win chance**

| Trade Size | Win Chance |
|------------|------------|
| $1 | 0.0004% |
| $10 | 0.004% |
| $100 | 0.04% |
| $1,000 | 0.4% |
| $10,000 | 4% |

Each trade is an **independent roll** - win or lose is determined immediately.

## Prize Pool

### How It Grows

69% of the 6.9% trading fee goes to the lottery prize pool:

| Daily Volume | Total Fees | To Lottery |
|--------------|------------|------------|
| $100K | $6,900 | ~$4,761 |
| $1M | $69,000 | ~$47,610 |
| $10M | $690,000 | ~$476,100 |

### What Winners Receive

Winners receive **69% of the accumulated jackpot** in **vault shares from ALL active creator vaults**.

This means a diversified portfolio:
- ■AKITA shares
- ■DRAGON shares (if active)
- ■BRET shares (if active)
- etc.

## Chainlink VRF

**Chainlink VRF 2.5** provides provably fair randomness:

- Cryptographically verifiable
- Cannot be manipulated
- Results auditable onchain
- Instant response per trade

## Transparency

| Data | Verification |
|------|--------------|
| Trade volume | Onchain (ShareOFT transfers) |
| Win probability | Math: (USD volume) × 0.0004% |
| VRF result | Chainlink VRF logs |
| Payout amount | Onchain (GaugeController) |

## Boosts (Optional)

The ve(3,3) system enables probability boosts:

| Boost Type | Source | Max Boost |
|------------|--------|-----------|
| **Personal boost** | ve4626BoostManager | Up to 2.5x |
| **Vote-directed boost** | VaultGaugeVoting | Weekly budget |

## Smart Wallet Support

The lottery supports ALL wallet types:

| Wallet | Status |
|--------|--------|
| EOA | ✅ Supported |
| Coinbase Smart Wallet | ✅ Supported |
| Safe (Gnosis) | ✅ Supported |
| Argent | ✅ Supported |
| ERC-4337 Accounts | ✅ Supported |

DEX aggregators (1inch, Paraswap, etc.) also work - the final recipient gets the lottery entry.
