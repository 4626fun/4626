// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICreatorOVaultComposer {
    function configureCreatorMesh(
        address creatorToken,
        address vault,
        address assetMeshToken,
        address shareMeshToken,
        uint32 solanaEid,
        bytes32 solanaAssetPeer,
        bytes32 solanaSharePeer
    ) external;

    function pauseCreatorMesh(address creatorToken, bool paused) external;

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
}
