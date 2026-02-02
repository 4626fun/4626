# ISwapRouterV3
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/helpers/routers/PayoutRouter.sol)


## Functions
### exactInput


```solidity
function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
```

## Structs
### ExactInputParams

```solidity
struct ExactInputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
}
```

