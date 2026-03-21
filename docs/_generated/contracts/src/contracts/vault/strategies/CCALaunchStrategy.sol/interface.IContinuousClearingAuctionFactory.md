# IContinuousClearingAuctionFactory
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/vault/strategies/CCALaunchStrategy.sol)

**Title:**
IContinuousClearingAuctionFactory

Interface for Uniswap's CCA Factory


## Functions
### initializeDistribution


```solidity
function initializeDistribution(address token, uint256 amount, bytes calldata configData, bytes32 salt)
    external
    returns (address);
```

