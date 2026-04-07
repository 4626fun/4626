# DeploymentBatcherUniV4Helper
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)


## State Variables
### create2Deployer

```solidity
IUniversalCreate2DeployerFromStore public immutable create2Deployer
```


### poolManager

```solidity
address public immutable poolManager
```


### permit2

```solidity
address public immutable permit2
```


### batcher

```solidity
address public immutable batcher
```


## Functions
### constructor


```solidity
constructor(address _create2Deployer, address _poolManager, address _permit2) ;
```

### deployUniV4Strategies


```solidity
function deployUniV4Strategies(
    DeploymentBatcher.UniV4DeployParams calldata params,
    DeploymentBatcher.UniV4CodeIds calldata codeIds,
    bytes32 baseSalt
) external returns (DeploymentBatcher.UniV4DeploymentResult memory out);
```

### _saltFor


```solidity
function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32);
```

## Errors
### NotBatcher

```solidity
error NotBatcher();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidTickSpacing

```solidity
error InvalidTickSpacing();
```

### InvalidPoolCurrencies

```solidity
error InvalidPoolCurrencies();
```

