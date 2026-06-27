# IDeploymentBatcherSolanaConfig
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### getOVaultRuntimeConfig


```solidity
function getOVaultRuntimeConfig() external view returns (OVaultRuntimeConfig memory);
```

### solanaDestination


```solidity
function solanaDestination() external view returns (bytes32);
```

### solanaShareOftPeer


```solidity
function solanaShareOftPeer() external view returns (bytes32);
```

## Structs
### OVaultRuntimeConfig

```solidity
struct OVaultRuntimeConfig {
    address hubComposer;
    uint32 solanaEid;
    bool enabled;
}
```

