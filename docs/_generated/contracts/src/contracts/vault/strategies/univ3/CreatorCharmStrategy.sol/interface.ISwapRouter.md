# ISwapRouter
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)


## Functions
### exactInputSingle


```solidity
function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
```

## Structs
### ExactInputSingleParams

```solidity
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}
```

