---
title: Tokenomics
sidebar_position: 4
---

# Tokenomics

6.9% trade fees fund lottery growth and holder PPS accretion. Lane behavior depends on native ShareOFT + optional hook config.

[Token units](/reference/glossary#token-units) · [LotteryManager4626](/contracts/utilities/lottery-manager)

## Fee structure

| Action | Fee | Recipient | Notes |
|--------|-----|-----------|-------|
| **DEX buy** | **6.9%** (conditional) | `tradeFeeCollector` | Native when `SwapOnly → non-SwapOnly` |
| **DEX sell** | **6.9%** (conditional) | `tradeFeeCollector` | Hook-dependent |
| **Deposit / withdraw** (creator coin ↔ ■) | **0%** | — | Wrap fees default 0 |
| **Bridge** (LayerZero) | gas only | Relayers | No ShareOFT trade fee |

## Fee distribution (immutable BPS)

Split in ShareOFT ■ first:

| Allocation | % | Destination |
|------------|---|-------------|
| Lottery | 69% | ■ → `jackpotReserve` |
| Voter / protocol | 21.39% | ■ → voter path (or fallback) |
| Burn | 9.61% | ■ slice → unwrap → ▢ burned (PPS ↑) |

Example at $1M daily volume → $69k fees → ~$47.6k lottery · ~$14.8k voters · ~$6.6k burned.

## Lottery

Qualifying **buys** (and AMOE) roll instantly. Base chance: **$1 ≈ 0.0004%** (`swapValueUSD / 250_000` PPM).

| Trade | Win chance |
|-------|------------|
| $1 | 0.0004% |
| $100 | 0.04% |
| $1,000 | 0.4% |
| $10,000 | 4% |

On a win, LotteryManager pays `rewardPercentage` (default 69%) of **that vault’s** gauge `jackpotReserve` in **ShareOFT ■**. Default is **single-vault** (`singleVaultJackpotOnly = true`). Gauge custodies; LotteryManager calculates chance and pays.

## Incentive alignment

| Stakeholder | Incentive |
|-------------|-----------|
| Creators | Volume → liquidity → fees → larger jackpots |
| Traders | Qualifying buys = lottery tickets (size scales chance) |
| Holders | Burn slice raises PPS; jackpot grows with volume |
| Platform | Immutable split: 69% / 21.39% / 9.61% / 0% creator |
