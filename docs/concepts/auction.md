---
title: Auction
sidebar_position: 2
---

# Continuous Clearing Auction (CCA)

CreatorVault uses Uniswap's Continuous Clearing Auction for fair launch price discovery.

## What is CCA?

The Continuous Clearing Auction is a Uniswap V4 mechanism that:
- Provides transparent, DeFi-native price discovery
- Prevents front-running
- Enables fair participation for all bidders
- Automatically migrates to AMM liquidity after completion

## How It Works

### Auction Phase

1. **Creator deposits** initial tokens into CCA strategy
2. **Bidders submit** bids during auction period
3. **Clearing price** determined when auction ends
4. **All successful bids** filled at same price

### Migration Phase

After auction completes:
1. **Liquidity migrated** to Uniswap V4 pool
2. **Trading begins** with established price
3. **6.9% fee** applies to all trades

## Benefits

| Benefit | Description |
|---------|-------------|
| **No front-running** | All bids cleared at same price |
| **Fair price discovery** | Market determines price |
| **Automatic liquidity** | Migrates to AMM seamlessly |
| **Transparent** | All bids visible onchain |

## CCA Strategy

The `CreatorCCAStrategy` contract:
- Allocates vault assets to CCA
- Manages bid acceptance
- Handles liquidity migration
- Returns proceeds to vault

## Auction Parameters

| Parameter | Typical Value |
|-----------|---------------|
| **Auction duration** | 24-72 hours |
| **Minimum bid** | Configurable |
| **Reserve price** | Optional |
| **Fee tier** | 3% (Uniswap V4) |

## Post-Auction

After the auction:
- **DEX pair created** - akita/ZORA on Uniswap V4
- **Lottery active** - 6.9% fee applies
- **Trading live** - Buy/sell anytime
