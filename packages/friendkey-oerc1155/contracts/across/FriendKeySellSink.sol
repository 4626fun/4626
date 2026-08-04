// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

interface IFriendKeySellExecutorSink {
    function friendKey() external view returns (address);
    function wrap() external view returns (address);
    function sellFromSink(uint256 tokenId, uint256 keyAmount) external;
}

interface IFriendKeyAllowlist {
    function tokenAllowed(uint256 tokenId) external view returns (bool);
}

/**
 * @title FriendKeySellSink
 * @notice Per-user CREATE2 receiver: wrap unlocks FriendKey here → auto sell+Across to USDG.
 * @dev One RH `wrap.send(Base, sinkOf(user), tokenId, amount)` is the full sell flow.
 */
contract FriendKeySellSink is ERC1155Holder {
    address public immutable user;
    IFriendKeySellExecutorSink public immutable executor;

    error OnlyFriendKey();
    error TokenNotAllowed();

    constructor(address user_, address executor_) {
        user = user_;
        executor = IFriendKeySellExecutorSink(executor_);
        address fk = IFriendKeySellExecutorSink(executor_).friendKey();
        IERC1155(fk).setApprovalForAll(executor_, true);
    }

    function onERC1155Received(address, address, uint256 id, uint256 amount, bytes memory)
        public
        override
        returns (bytes4)
    {
        if (msg.sender != executor.friendKey()) revert OnlyFriendKey();
        if (!IFriendKeyAllowlist(executor.wrap()).tokenAllowed(id)) revert TokenNotAllowed();
        if (amount > 0) {
            executor.sellFromSink(id, amount);
        }
        return IERC1155Receiver.onERC1155Received.selector;
    }
}
