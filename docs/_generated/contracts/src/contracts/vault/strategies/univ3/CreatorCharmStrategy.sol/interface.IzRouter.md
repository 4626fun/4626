# IzRouter
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)

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

