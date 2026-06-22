# IAuxiliaryCreate2Deployer
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/VaultAuxiliaryDeployBatcher.sol)


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

