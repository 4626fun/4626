# IUniversalCreate2DeployerFromStore
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

