// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice FriendKey surface used by the #1659 cross-chain buy/sell path.
 * @dev Live Base collection: 0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F
 */
interface IAlfaFriendKey {
    function bondingToken() external view returns (address);
    function getBuyPriceAfterFee(uint256 id, uint256 amount) external view returns (uint256);
    function getSellPriceAfterFee(uint256 id, uint256 amount) external view returns (uint256);
    function buyShares(uint256 tokenId, uint256 amount, uint256 maxSpend) external;
    function sellShares(uint256 tokenId, uint256 amount, uint256 minProceeds) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}
