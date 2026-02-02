# IUniversalCreate2DeployerFromStore
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/helpers/batchers/CreatorVaultDeployer.sol)


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

