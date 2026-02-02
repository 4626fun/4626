# IUniversalCreate2DeployerFromStore
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/helpers/batchers/CreatorVaultDeployer.sol)


## Functions
### deploy


```solidity
function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
```

### computeAddress


```solidity
function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
```

