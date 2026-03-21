# CreatorCharmStrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

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

