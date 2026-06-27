# IUniversalCreate2DeployerFromStore
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

