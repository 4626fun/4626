# ICreatorOVaultComposer
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/interfaces/ovault/ICreatorOVaultComposer.sol)


## Functions
### configureCreatorMesh


```solidity
function configureCreatorMesh(
    address creatorToken,
    address vault,
    address assetMeshToken,
    address shareMeshToken,
    uint32 solanaEid,
    bytes32 solanaAssetPeer,
    bytes32 solanaSharePeer
) external;
```

### pauseCreatorMesh


```solidity
function pauseCreatorMesh(address creatorToken, bool paused) external;
```

### creatorMesh


```solidity
function creatorMesh(address creatorToken)
    external
    view
    returns (
        address vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer,
        bool paused
    );
```

