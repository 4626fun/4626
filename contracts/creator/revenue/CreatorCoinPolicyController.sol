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
 *      It only permits setting the creatorCoinPayoutRecipient (external earnings lane)
 *      to the configured PayoutRouter and supports an explicit ownership handoff for
 *      controlled upgrades/migrations.
 *
 *      Per AGENTS.md "Canonical Lane Terminology":
 *      - creatorCoinPayoutRecipient = CreatorCoin external earnings lane (routes to
 *        PayoutRouter → VaultShareBurnStream in router mode, or direct treasury).
 *      - This is distinct from tradeFeeCollector (ShareOFT/hook trade-fee lane).
 *      See docs/audits/creatorvault-business-logic-core-structure-audit.md.
 */
contract CreatorCoinPolicyController is Ownable {
    address public immutable creatorCoin;
    address public immutable payoutRouter;

    // FIX: CPC-01 — two-step ownership transfer to prevent accidental irreversible transfer
    address public pendingCreatorCoinOwner;

    event PayoutRecipientEnforced(address indexed creatorCoin, address indexed payoutRouter);
    event CreatorCoinOwnershipTransferred(address indexed creatorCoin, address indexed newOwner);
    event CreatorCoinOwnershipTransferProposed(address indexed creatorCoin, address indexed proposedOwner);

    error ZeroAddress();
    error NoPendingTransfer();
    error NotPendingOwner();

    constructor(address _creatorCoin, address _payoutRouter, address _owner) Ownable(_owner) {
        if (_creatorCoin == address(0) || _payoutRouter == address(0) || _owner == address(0)) revert ZeroAddress();
        creatorCoin = _creatorCoin;
        payoutRouter = _payoutRouter;
    }

    /**
     * @notice Enforce creatorCoinPayoutRecipient (external earnings lane) to the configured PayoutRouter.
     *
     *         The on-chain CreatorCoin function is still named setPayoutRecipient (ABI compatibility).
     *         All prose, docs, and higher-level comments use the canonical AGENTS.md term.
     */
    function enforcePayoutRouter() external onlyOwner {
        ICreatorCoinAdmin(creatorCoin).setPayoutRecipient(payoutRouter);
        emit PayoutRecipientEnforced(creatorCoin, payoutRouter);
    }

    // FIX: CPC-01 — propose transfer (step 1 of two-step pattern)
    function proposeCreatorCoinOwnershipTransfer(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingCreatorCoinOwner = newOwner;
        emit CreatorCoinOwnershipTransferProposed(creatorCoin, newOwner);
    }

    // FIX: CPC-01 — execute transfer (step 2 — must be called by proposed owner)
    function acceptCreatorCoinOwnership() external {
        if (pendingCreatorCoinOwner == address(0)) revert NoPendingTransfer();
        if (msg.sender != pendingCreatorCoinOwner) revert NotPendingOwner();
        address newOwner = pendingCreatorCoinOwner;
        pendingCreatorCoinOwner = address(0);
        ICreatorCoinAdmin(creatorCoin).transferOwnership(newOwner);
        emit CreatorCoinOwnershipTransferred(creatorCoin, newOwner);
    }

    // FIX: CPC-01 — cancel pending transfer
    function cancelCreatorCoinOwnershipTransfer() external onlyOwner {
        pendingCreatorCoinOwner = address(0);
    }
}
