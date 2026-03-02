# ISwapRouterV3
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/utilities/routers/PayoutRouter.sol)


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

