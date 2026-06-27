# ISwapRouterV3
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/routers/PayoutRouter.sol)


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

