---
title: CreatorOracle
sidebar_position: 2
---

# CreatorOracle

**Product role:** **TWAP price feed** for creator and share tokens — sizes lottery trade value in USD and supports vault/gauge slippage guardrails.

Price oracle for creator tokens using Uniswap V4 TWAP.

## Purpose

The CreatorOracle:
- Tracks real-time share token price
- Provides TWAP for manipulation resistance
- Used for vault accounting and lottery prize valuations

## Key Functions

### Price Queries

```solidity
// Get creator token price in USD
function getCreatorPrice() external view returns (int256 price, uint256 timestamp);

// Get ETH price in USD
function getEthPrice() external view returns (int256 price, uint256 timestamp);

// Get creator token price in ETH (TWAP)
function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);

// Check if price is fresh
function isPriceFresh() external view returns (bool);
```

## TWAP Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Duration** | 30 minutes | TWAP observation period |
| **Staleness threshold** | 2 hours | Max age before price is stale |

## Usage in System

### Lottery Manager

Uses oracle to calculate USD value of trades:

```solidity
uint256 swapValueUSD = _calculateTokenUSD(creatorCoin, tokenIn, amountIn);
```

### GaugeController

Uses oracle for slippage protection on WETH swaps:

```solidity
uint256 minAmountOut = _calculateMinOutput(wethAmount);
```

## Price Sources

The oracle aggregates from:
- Uniswap V4 pool TWAP
- Chainlink price feeds (ETH/USD)
