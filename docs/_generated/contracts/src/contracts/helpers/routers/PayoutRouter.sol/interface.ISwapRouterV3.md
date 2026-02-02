# ISwapRouterV3
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/helpers/routers/PayoutRouter.sol)


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

