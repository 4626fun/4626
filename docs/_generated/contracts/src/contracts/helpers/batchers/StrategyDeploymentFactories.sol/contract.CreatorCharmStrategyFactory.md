# CreatorCharmStrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

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

