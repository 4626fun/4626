# IUniversalCreate2DeployerFromStore
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

