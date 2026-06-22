# AjnaERC4626StrategyFactory
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/StrategyDeploymentFactories.sol)

**Inherits:**
[IAjnaERC4626StrategyFactory](/contracts/helpers/batchers/StrategyDeploymentFactories.sol/interface.IAjnaERC4626StrategyFactory.md)


## Constants
### authDeployer

```solidity
AjnaVaultAuthDeployer public immutable authDeployer
```


### vaultDeployer

```solidity
AjnaInnerVaultDeployer public immutable vaultDeployer
```


### adapterDeployer

```solidity
AjnaAdapterDeployer public immutable adapterDeployer
```


## Functions
### constructor


```solidity
constructor() ;
```

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

