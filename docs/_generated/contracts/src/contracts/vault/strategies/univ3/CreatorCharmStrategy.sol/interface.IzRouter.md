# IzRouter
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)

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

