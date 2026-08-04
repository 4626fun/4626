// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

/**
 * @notice Omnichain AlfaClub FriendKey wrap — hub lockbox on Base, representation on spokes.
 * @dev One collection, many allowlisted token ids (mirrored from underlying FriendKey).
 */
interface IFriendKeyOERC1155 {
    function registry() external view returns (address);
    function underlying() external view returns (address);
    function isHub() external view returns (bool);
    function tokenAllowed(uint256 tokenId) external view returns (bool);
    function uriFrozen() external view returns (bool);
    function contractURI() external view returns (string memory);

    function setHub() external;
    function setTokenAllowed(uint256 tokenId, bool allowed) external;
    function setURI(string calldata newuri) external;
    function setContractURI(string calldata newContractURI) external;
    function freezeURI() external;

    /// @dev `payInLzToken` must be false — LZ-token fee mode is unsupported.
    function quoteSend(
        uint32 dstEid,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata options,
        bool payInLzToken
    ) external view returns (MessagingFee memory fee);

    function send(
        uint32 dstEid,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata options,
        address refundAddress
    ) external payable returns (MessagingReceipt memory receipt);
}
