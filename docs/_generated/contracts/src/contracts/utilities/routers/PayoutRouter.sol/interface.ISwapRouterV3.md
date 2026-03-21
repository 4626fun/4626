# ISwapRouterV3
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/utilities/routers/PayoutRouter.sol)


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

