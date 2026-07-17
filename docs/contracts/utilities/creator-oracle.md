---
title: CreatorOracle
sidebar_position: 2
---

# CreatorOracle

**Product role:** **TWAP price feed** for creator and share tokens — sizes lottery trade value in USD and supports vault and gauge slippage guardrails.

Uniswap V4 TWAP oracle for creator and share tokens. Tracks share token price, provides manipulation-resistant TWAP, and feeds vault accounting and lottery prize valuations.

## Key Functions

```solidity
function getAssetPrice() external view returns (int256 price, uint256 timestamp);
function getEthPrice() external view returns (int256 price, uint256 timestamp);
function getAssetEthTWAP(uint32 duration) external view returns (uint256 price);
function isPriceFresh() external view returns (bool);
```

## TWAP Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Duration** | 30 minutes | TWAP observation period |
| **Staleness threshold** | 2 hours | Max age before price is stale |

## Usage

- **LotteryManager4626** — calculates USD value of trades via `_calculateTokenUSD(creatorCoin, tokenIn, amountIn)`.
- **GaugeController** — slippage protection on WETH swaps via `_calculateMinOutput(wethAmount)`.

## Price Sources

Uniswap V4 pool TWAP and Chainlink price feeds (ETH/USD).

Prev: [LotteryManager4626](/contracts/utilities/lottery-manager) · Next: [Smart contracts](/contracts)
