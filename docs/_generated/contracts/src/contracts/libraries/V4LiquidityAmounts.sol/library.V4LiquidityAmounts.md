# V4LiquidityAmounts
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/libraries/V4LiquidityAmounts.sol)

**Title:**
V4LiquidityAmounts

**Author:**
0xakita.eth

Liquidity math helpers for Uniswap v4-style ranges.

Converts liquidity to token0/token1 amounts for a price range.


## Functions
### getAmount0ForLiquidity

Computes token0 amount for liquidity between price bounds.


```solidity
function getAmount0ForLiquidity(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint128 liquidity)
    internal
    pure
    returns (uint256 amount0);
```

### getAmount1ForLiquidity

Computes token1 amount for liquidity between price bounds.


```solidity
function getAmount1ForLiquidity(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96, uint128 liquidity)
    internal
    pure
    returns (uint256 amount1);
```

### getAmountsForLiquidity

Computes (amount0, amount1) for liquidity at current price and range bounds.


```solidity
function getAmountsForLiquidity(
    uint160 sqrtPriceX96,
    uint160 sqrtPriceAX96,
    uint160 sqrtPriceBX96,
    uint128 liquidity
) internal pure returns (uint256 amount0, uint256 amount1);
```

