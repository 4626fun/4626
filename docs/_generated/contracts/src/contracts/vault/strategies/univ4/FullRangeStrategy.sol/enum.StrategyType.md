# StrategyType
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/vault/strategies/univ4/FullRangeStrategy.sol)

**Title:**
FullRangeStrategy

**Author:**
0xakita.eth (4626)

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

