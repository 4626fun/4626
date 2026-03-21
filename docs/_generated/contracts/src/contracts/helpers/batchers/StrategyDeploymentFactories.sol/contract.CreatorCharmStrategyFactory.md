# CreatorCharmStrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

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

