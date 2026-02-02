# IUniswapV4Router
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/services/bridge/SolanaBridgeAdapter.sol)

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

