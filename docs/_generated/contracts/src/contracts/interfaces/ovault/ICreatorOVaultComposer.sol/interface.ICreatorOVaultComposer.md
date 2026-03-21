# ICreatorOVaultComposer
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/interfaces/ovault/ICreatorOVaultComposer.sol)


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

