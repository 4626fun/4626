// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";

interface IRegistry4626ViewLibRegistry {
    function getRemoteOFTChains(address token) external view returns (uint32[] memory);
    function remoteOFTPeers(address token, uint32 chainEid) external view returns (address);
    function getRemoteOFTChainsBytes32(address token) external view returns (uint32[] memory);
    function getRemoteOFTPeerBytes32(address token, uint32 chainEid) external view returns (bytes32);
    function getTokenCount() external view returns (uint256);
    function getRegisteredTokenAt(uint256 index) external view returns (address);
    function isTokenActive(address token) external view returns (bool);
    function getOmnichainVaultMesh(address token) external view returns (IRegistry4626.OmnichainVaultMeshConfig memory);
    function getVaultForToken(address token) external view returns (address);
    function getWrapperForToken(address token) external view returns (address);
    function getShareOFTForToken(address token) external view returns (address);
}

/**
 * @title Registry4626ViewLib
 * @notice External view helper library for `Registry4626`.
 * @dev Uses external calls back into the registry to move loop-heavy read paths out of
 *      the main contract runtime and recover EIP-170 headroom.
 */
library Registry4626ViewLib {
    function getAllRemoteOFTPeers(address registry, address token)
        external
        view
        returns (uint32[] memory eids, address[] memory ofts)
    {
        IRegistry4626ViewLibRegistry registryViews = IRegistry4626ViewLibRegistry(registry);
        eids = registryViews.getRemoteOFTChains(token);
        ofts = new address[](eids.length);
        for (uint256 i; i < eids.length;) {
            ofts[i] = registryViews.remoteOFTPeers(token, eids[i]);
            unchecked {
                ++i;
            }
        }
    }

    function getAllRemoteOFTPeersBytes32(address registry, address token)
        external
        view
        returns (uint32[] memory eids, bytes32[] memory peers)
    {
        IRegistry4626ViewLibRegistry registryViews = IRegistry4626ViewLibRegistry(registry);
        eids = registryViews.getRemoteOFTChainsBytes32(token);
        peers = new bytes32[](eids.length);
        for (uint256 i; i < eids.length;) {
            peers[i] = registryViews.getRemoteOFTPeerBytes32(token, eids[i]);
            unchecked {
                ++i;
            }
        }
    }

    function getTokensPaginated(address registry, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory result)
    {
        IRegistry4626ViewLibRegistry registryViews = IRegistry4626ViewLibRegistry(registry);
        uint256 total = registryViews.getTokenCount();
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        result = new address[](end - offset);
        for (uint256 i = offset; i < end;) {
            result[i - offset] = registryViews.getRegisteredTokenAt(i);
            unchecked {
                ++i;
            }
        }
    }

    function isSolanaDepositEligible(address registry, address token) external view returns (bool) {
        IRegistry4626ViewLibRegistry registryViews = IRegistry4626ViewLibRegistry(registry);
        if (!registryViews.isTokenActive(token)) return false;

        IRegistry4626.OmnichainVaultMeshConfig memory cfg = registryViews.getOmnichainVaultMesh(token);
        if (!cfg.enabled) return false;
        if (
            cfg.solanaEid == 0 || cfg.hubComposer == address(0) || cfg.assetMeshToken == address(0)
                || cfg.shareMeshToken == address(0) || cfg.solanaAssetMint == bytes32(0)
        ) {
            return false;
        }

        return registryViews.getVaultForToken(token) != address(0) && registryViews.getWrapperForToken(token) != address(0)
            && registryViews.getShareOFTForToken(token) != address(0);
    }
}
