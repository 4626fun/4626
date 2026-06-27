# IUniswapV4Router
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/bridge/SolanaBridgeAdapter.sol)

**Title:**
IUniswapV4Router

Interface for swapping on Uniswap V4


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
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}
```

