// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal Registry4626 surface needed by FriendKeyOERC1155 CREATE2 parity.
 * @dev Live registry: 0x777968CB7F302f3d02C094b119a67DCA9E0b4626 (Base + Robinhood).
 */
interface IRegistry4626 {
    function getLayerZeroEndpoint(uint256 _chainId) external view returns (address);
}
