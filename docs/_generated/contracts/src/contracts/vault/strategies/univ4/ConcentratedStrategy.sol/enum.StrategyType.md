# StrategyType
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/univ4/ConcentratedStrategy.sol)

**Title:**
ConcentratedStrategy

**Author:**
0xakita.eth (4626)

Concentrated liquidity around current price for maximum capital efficiency

STRATEGY (inspired by Charm Finance Alpha Vaults):
- Provides liquidity in a tight range around current price
- Higher capital efficiency = more fees per dollar of liquidity
- Requires active management to stay in range
- Auto-rebalances when price moves out of range

REBALANCE GUARDS (from Charm):
1. Time-based: Must wait `period` seconds between rebalances
2. Price movement: Must move at least `minTickMove` ticks
3. TWAP deviation: Current price must be within `maxTwapDeviation` of TWAP
4. Boundary check: Price can't be too close to MIN/MAX tick

TWAP PROTECTION:
Prevents flash loan attacks by comparing spot price to time-weighted average

INTEGRATION:
- Plugs into CreatorLPManager
- Most capital efficient but highest maintenance


```solidity
enum StrategyType {
FullRange,
LimitOrder,
Concentrated
}
```

