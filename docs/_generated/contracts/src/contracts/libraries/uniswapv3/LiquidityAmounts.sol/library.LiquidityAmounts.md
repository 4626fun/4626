# LiquidityAmounts
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/libraries/uniswapv3/LiquidityAmounts.sol)

**Title:**
LiquidityAmounts

**Author:**
0xakita.eth

Liquidity math helpers for Uniswap v3-style sqrtPriceX96 values.

Local implementation mirroring Uniswap's LiquidityAmounts formulas.


## State Variables
### RESOLUTION

```solidity
uint8 internal constant RESOLUTION = 96
```


### Q96

```solidity
uint256 internal constant Q96 = 0x1000000000000000000000000
```


## Functions
### toUint128


```solidity
function toUint128(uint256 x) private pure returns (uint128 y);
```

### getLiquidityForAmount0


```solidity
function getLiquidityForAmount0(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint256 amount0)
    internal
    pure
    returns (uint128 liquidity);
```

### getLiquidityForAmount1


```solidity
function getLiquidityForAmount1(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint256 amount1)
    internal
    pure
    returns (uint128 liquidity);
```

### getLiquidityForAmounts


```solidity
function getLiquidityForAmounts(
    uint160 sqrtRatioX96,
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint256 amount0,
    uint256 amount1
) internal pure returns (uint128 liquidity);
```

### getAmount0ForLiquidity


```solidity
function getAmount0ForLiquidity(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity)
    internal
    pure
    returns (uint256 amount0);
```

### getAmount1ForLiquidity


```solidity
function getAmount1ForLiquidity(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity)
    internal
    pure
    returns (uint256 amount1);
```

### getAmountsForLiquidity


```solidity
function getAmountsForLiquidity(
    uint160 sqrtRatioX96,
    uint160 sqrtRatioAX96,
    uint160 sqrtRatioBX96,
    uint128 liquidity
) internal pure returns (uint256 amount0, uint256 amount1);
```

