---
title: Fee Flow
sidebar_position: 4
---

# Fee Flow

Understanding how fees flow through the CreatorVault system.

## Trading Fee Collection

The 6.9% trading fee is collected on all DEX trades (buys AND sells):

```
User trades ■AKITA on Uniswap V4 (buy or sell)
   ↓ 6.9% fee deducted
CreatorShareOFT.transfer hook
   ↓ Send fee
CreatorGaugeController
   ↓ Route by configured split
```

## Fee Distribution

| Allocation | Percentage | Destination | Purpose |
|------------|------------|-------------|---------|
| **Lottery** | 69% | CreatorLotteryManager | Prize pool for instant lottery |
| **Burn** | 21.39% | Vault (PPS increase) | Value accrual for all holders |
| **Voter Rewards** | 9.61% | VoterRewardsDistributor | Incentivize governance participation |

## Example: $1M Daily Volume

For $1M daily trading volume:

| Step | Amount |
|------|--------|
| Total fees (6.9%) | $69,000 |
| → Lottery (69%) | ~$47,610 |
| → Burned (21.39%) | ~$14,770 |
| → Voter rewards (9.61%) | ~$6,620 |

## Fee-Free Actions

These actions do NOT incur the 6.9% fee:

| Action | Fee |
|--------|-----|
| Vault deposit (akita → ▢AKITA) | 0% |
| Vault withdrawal (▢AKITA → akita) | 0% |
| Wrapping (▢AKITA → ■AKITA) | 0% |
| Unwrapping (■AKITA → ▢AKITA) | 0% |
| Cross-chain bridge (via LayerZero) | 0% + gas only |

## Gauge Controller Flow

The GaugeController processes fees as follows:

1. **Receive fees** from ShareOFT transfers
2. **Unwrap** OFT to vault shares
3. **Split** according to configured percentages
4. **Distribute**:
   - Lottery portion → add to jackpot reserve
   - Burn portion → burn shares (increases PPS)
   - Voter portion → send to VoterRewardsDistributor

## Lottery Payout Flow

When a trader wins:

1. **VRF confirms** winning roll
2. **Calculate** 69% of accumulated jackpot
3. **Transfer** vault shares from ALL active creator vaults
4. **Winner receives** diversified portfolio of shares
