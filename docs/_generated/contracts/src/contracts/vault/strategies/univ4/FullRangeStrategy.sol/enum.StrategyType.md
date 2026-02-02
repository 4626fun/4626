# StrategyType
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/vault/strategies/univ4/FullRangeStrategy.sol)

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

