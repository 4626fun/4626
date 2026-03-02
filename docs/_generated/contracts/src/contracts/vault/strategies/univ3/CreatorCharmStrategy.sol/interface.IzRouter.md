# IzRouter
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)

zRouter - gas-efficient multi-AMM DEX aggregator

Base: 0x... (will be deployed)


## Functions
### swapV3


```solidity
function swapV3(
    address tokenIn,
    address tokenOut,
    uint24 fee,
    uint256 amountIn,
    uint256 amountOutMin,
    uint256 deadline
) external payable returns (uint256 amountOut);
```

