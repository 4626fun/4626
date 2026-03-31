// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICreatorCoinAdmin {
    function setPayoutRecipient(address recipient) external;
    function transferOwnership(address newOwner) external;
}

/**
 * @title CreatorCoinPolicyController
 * @author 0xakita.eth
 * @notice Protocol-owned policy controller for CreatorCoin admin actions.
 *
 * @dev This contract is intended to hold CreatorCoin ownership after deployment.
 *      It only permits setting payoutRecipient to the configured router and
 *      supports an explicit ownership handoff for controlled upgrades/migrations.
 */
contract CreatorCoinPolicyController is Ownable {
    address public immutable creatorCoin;
    address public immutable payoutRouter;

    event PayoutRecipientEnforced(address indexed creatorCoin, address indexed payoutRouter);
    event CreatorCoinOwnershipTransferred(address indexed creatorCoin, address indexed newOwner);

    error ZeroAddress();

    constructor(address _creatorCoin, address _payoutRouter, address _owner) Ownable(_owner) {
        if (_creatorCoin == address(0) || _payoutRouter == address(0) || _owner == address(0)) revert ZeroAddress();
        creatorCoin = _creatorCoin;
        payoutRouter = _payoutRouter;
    }

    /**
     * @notice Enforce payout recipient to the configured payout router.
     */
    function enforcePayoutRouter() external onlyOwner {
        ICreatorCoinAdmin(creatorCoin).setPayoutRecipient(payoutRouter);
        emit PayoutRecipientEnforced(creatorCoin, payoutRouter);
    }

    /**
     * @notice Transfer CreatorCoin ownership to a new admin contract/address.
     * @dev Intended for controlled migrations/upgrades.
     */
    function transferCreatorCoinOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        ICreatorCoinAdmin(creatorCoin).transferOwnership(newOwner);
        emit CreatorCoinOwnershipTransferred(creatorCoin, newOwner);
    }
}
