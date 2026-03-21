# StrategyType
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/vault/strategies/univ4/FullRangeStrategy.sol)

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

