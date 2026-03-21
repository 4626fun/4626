# StrategyType
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)

**Title:**
LimitOrderStrategy

**Author:**
0xakita.eth (4626)

Single-tick liquidity positions that act as limit orders

STRATEGY:
- Places liquidity in a single tick (or very narrow range)
- Acts as a limit order: gets filled when price crosses the tick
- Used for price support (buy walls) or resistance (sell walls)
- Higher capital efficiency within the specific tick

USE CASES:
1. BUY SUPPORT: Place below current price - buys creator coin when price drops
2. SELL RESISTANCE: Place above current price - sells creator coin when price rises

INTEGRATION:
- Plugs into CreatorLPManager
- Multiple limit order positions can be active simultaneously


```solidity
enum StrategyType {
FullRange,
LimitOrder,
Concentrated
}
```

