# DeploymentBatcherPhase1Module
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)

Phase-1 CREATE2 orchestration lives in a delegatecall module to keep batcher initcode under EIP-3860.


## Constants
### create2Deployer

```solidity
IUniversalCreate2DeployerFromStore public immutable create2Deployer
```


### bytecodeStore

```solidity
IUniversalBytecodeStore public immutable bytecodeStore
```


### registry

```solidity
address public immutable registry
```


### vaultCoreModule

```solidity
address public immutable vaultCoreModule
```


### vaultStrategiesModule

```solidity
address public immutable vaultStrategiesModule
```


### vaultAdminModule

```solidity
address public immutable vaultAdminModule
```


### vaultActivationBatcher

```solidity
address public immutable vaultActivationBatcher
```


### utilsHelper

```solidity
DeploymentBatcherUtilsHelper public immutable utilsHelper
```


### batcher

```solidity
address public immutable batcher
```


## Functions
### constructor


```solidity
constructor(
    address _create2Deployer,
    address _bytecodeStore,
    address _registry,
    address _vaultCoreModule,
    address _vaultStrategiesModule,
    address _vaultAdminModule,
    address _vaultActivationBatcher,
    address _utilsHelper,
    address _batcher
) ;
```

### deployPhase1Core


```solidity
function deployPhase1Core(
    DeploymentBatcher.Phase1Params calldata params,
    DeploymentBatcher.CodeIds calldata codeIds,
    DeploymentBatcher.Phase1SplitState calldata existing,
    bytes32 shareOftSaltOverride
) external returns (DeploymentBatcher.Phase1Result memory out, DeploymentBatcher.Phase1SplitState memory state);
```

### finalizePhase1Split


```solidity
function finalizePhase1Split(
    DeploymentBatcher.Phase1Params calldata params,
    DeploymentBatcher.CodeIds calldata codeIds,
    DeploymentBatcher.Phase1SplitState calldata existing,
    bytes32 shareOftSaltOverride
) external returns (DeploymentBatcher.Phase1Result memory out, DeploymentBatcher.Phase1SplitState memory state);
```

### _phase1Identity


```solidity
function _phase1Identity(
    DeploymentBatcher.Phase1Params calldata params,
    DeploymentBatcher.CodeIds calldata codeIds,
    bytes32 shareOftSaltOverride
) internal returns (bytes32 shareOftSalt, bytes32 paramsHash, bytes32 codeIdsHash, bytes32 baseSalt);
```

### _requirePhase1CodeIds


```solidity
function _requirePhase1CodeIds(DeploymentBatcher.CodeIds calldata codeIds) internal pure;
```

### _deriveInitCodeHash


```solidity
function _deriveInitCodeHash(bytes32 codeId, bytes memory constructorArgs) internal view returns (bytes32);
```

## Errors
### NotBatcherContext

```solidity
error NotBatcherContext();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidCodeId

```solidity
error InvalidCodeId();
```

### SymbolTooLong

```solidity
error SymbolTooLong();
```

### Phase1StateMismatch

```solidity
error Phase1StateMismatch();
```

### Phase1CoreMissing

```solidity
error Phase1CoreMissing();
```

### Phase1ShareOFTMissing

```solidity
error Phase1ShareOFTMissing();
```

### Phase1Missing

```solidity
error Phase1Missing();
```

