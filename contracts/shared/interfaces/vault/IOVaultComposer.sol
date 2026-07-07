// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IOVaultComposer {
    function configureTokenMesh(
        address token,
        address vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer
    ) external;

    function pauseTokenMesh(address token, bool paused) external;

    function tokenMesh(address token)
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
}
