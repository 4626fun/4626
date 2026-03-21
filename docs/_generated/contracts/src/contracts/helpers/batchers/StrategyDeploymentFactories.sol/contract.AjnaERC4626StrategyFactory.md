# AjnaERC4626StrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

**Inherits:**
[IAjnaERC4626StrategyFactory](/contracts/helpers/batchers/StrategyDeploymentFactories.sol/interface.IAjnaERC4626StrategyFactory.md)


## Functions
### deploy


```solidity
function deploy(
    address creatorVault,
    address underlyingToken,
    address ajnaPoolFactory,
    address quoteToken,
    address owner,
    string calldata vaultName,
    string calldata vaultSymbol,
    uint256 bufferRatioBps,
    uint256 minBucketIndex,
    address keeper
) external returns (address strategy, address innerVault, address auth);
```

