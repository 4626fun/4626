# CreatorCharmStrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

**Inherits:**
[ICreatorCharmStrategyFactory](/contracts/helpers/batchers/StrategyDeploymentFactories.sol/interface.ICreatorCharmStrategyFactory.md)


## Functions
### deployAndInitialize


```solidity
function deployAndInitialize(
    address creatorVault,
    address underlyingToken,
    address quoteToken,
    address uniswapRouter,
    address charmVault,
    address v3Pool,
    address owner
) external returns (address strategy);
```

