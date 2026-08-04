// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice LZ payload for AlfaClub FriendKey omnichain wrap.
 * @dev Layout: abi.encode(address to, uint256 tokenId, uint256 amount)
 */
library FriendKeyMsgCodec {
    function encode(address to, uint256 tokenId, uint256 amount) internal pure returns (bytes memory) {
        return abi.encode(to, tokenId, amount);
    }

    function decode(bytes calldata message)
        internal
        pure
        returns (address to, uint256 tokenId, uint256 amount)
    {
        (to, tokenId, amount) = abi.decode(message, (address, uint256, uint256));
    }
}
