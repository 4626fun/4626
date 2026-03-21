# IAjnaERC4626StrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/StrategyDeploymentFactories.sol)


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

