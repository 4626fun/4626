# StrategyType
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/vault/strategies/univ4/FullRangeStrategy.sol)

**Title:**
FullRangeStrategy

**Author:**
0xakita.eth (CreatorVault)

Provides full-range liquidity on Uniswap V4

STRATEGY:
- Deposits liquidity across the entire price range (MIN_TICK to MAX_TICK)
- Never goes out of range - always earning fees
- Lower capital efficiency but zero maintenance
- Ideal for long-term, passive liquidity provision

TICK RANGE:
- Uses tickLower = -887272 and tickUpper = 887272 (max range)
- This covers all possible prices

INTEGRATION:
- Plugs into CreatorLPManager
- Implements ILPStrategy interface


```solidity
enum StrategyType {
FullRange,
LimitOrder,
Concentrated
}
```

