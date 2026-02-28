# StrategyType
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)

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

