---
title: Tokenomics
sidebar_position: 4
---

# Tokenomics

The 6.9% fee policy is the core incentive mechanism powering lottery growth and holder PPS accretion, with lane behavior determined by native + hook configuration.

## Fee Structure

| Action | Fee | Recipient | Notes |
|--------|-----|-----------|-------|
| **DEX Buy** | **6.9%** (conditional) | tradeFeeCollector domain | Native `CreatorShareOFT` trigger when transfer matches `SwapOnly -> non-SwapOnly` |
| **DEX Sell** | **6.9%** (conditional) | tradeFeeCollector domain | Hook-dependent; requires explicit hook activation/config |
| **Vault Deposit** (akita → ▢AKITA) | **0%** | N/A | Direct deposits are free |
| **Vault Withdrawal** (▢AKITA → akita) | **0%** | N/A | Withdrawals are free |
| **Cross-Chain Bridge** (via LayerZero) | **0%** + gas | LayerZero relayers | Only pay LayerZero messaging fees (~$1-5 depending on chain) |

## Fee Distribution

The 6.9% trading fee is distributed as follows:

| Allocation | Percentage | Description |
|------------|------------|-------------|
| **Lottery Prize Pool** | 69% | Funds the instant lottery jackpot |
| **Burn (PPS Increase)** | 21.39% | Shares burned to increase Price Per Share for all holders |
| **Voter/Protocol Branch** | 9.61% | Distributed to voter rewards path when configured, protocol fallback otherwise |

### Example Distribution

For $1M daily trading volume:
- Total fees collected: **$69,000** (6.9%)
- To lottery: **~$47,610** (69%)
- Burned: **~$14,770** (21.39%)
- Voter rewards: **~$6,620** (9.61%)

## Key Details

- **Buy/sell taxation is conditional** → Native and hook fee planes must both be configured and verified before claiming both sides are active
- **Fee only on configured trade paths** → Deposits, withdrawals, and cross-chain transfers are NOT taxed
- **6.9% choice** → Playful nod to meme culture while maintaining sustainability (lower than typical 10-15% meme coin fees)

## Lottery Mechanics

### Instant Win Chance (Percentage-Based)

Every eligible fee-triggering trade has an instant chance to win proportional to USD trade value.

**Win Formula**: For every **$1 traded** = **0.0004% instant win chance**

| Trade Size | Win Chance |
|------------|------------|
| $1 | 0.0004% |
| $10 | 0.004% |
| $100 | 0.04% |
| $1,000 | 0.4% |
| $10,000 | 4% |

Each trade is an independent roll - win or lose is determined immediately.

### Instant Drawing Process

1. Every trade triggers an instant lottery roll - no waiting for weekly/monthly draws
2. **Chainlink VRF 2.5** requests random number onchain for each qualifying trade
3. Random number determines if trader wins based on their trade-size percentage chance
4. Winner receives **69% of the accumulated prize pool** immediately in **vault shares from ALL active creator vaults**

### Transparency

- All trades, win probabilities, VRF rolls, and payouts are onchain and auditable
- VRF randomness is cryptographically verifiable
- Anyone can verify the math: (Trader's USD volume) × 0.0004% = Win chance

## Incentive Alignment

| Stakeholder | Incentive |
|-------------|-----------|
| **Creators** | Lottery drives trading volume → more liquidity → higher token price → more fees collected → larger prize pools |
| **Traders** | Every trade triggers instant lottery roll (larger trades = higher win probability) → FOMO + gamification |
| **Whales** | $10,000 trade = 4% chance to win → Incentivizes large trades while keeping small traders competitive |
| **Holders** | Prize pool grows with trading volume → incentive to participate in ecosystem → every trade is a new chance to win |
| **Platform** | Sustainable incentives via configurable gauge splits (default 69% lottery, 21.39% burn, 9.61% voter/protocol branch, 0% creator) |

## Prize Payout

Winners receive a **diversified portfolio** from ALL active creator vaults:

- 69% of each vault's jackpot reserve
- Paid in vault shares (not ETH)
- Multi-token prize from ALL active creators

**Example**: If you win when there are 5 active vaults (■AKITA, ■DRAGON, ■BRET, etc.), you receive vault shares from ALL 5 vaults.
