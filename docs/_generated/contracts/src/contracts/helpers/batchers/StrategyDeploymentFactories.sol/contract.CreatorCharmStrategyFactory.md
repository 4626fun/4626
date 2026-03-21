# CreatorCharmStrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

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

