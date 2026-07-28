// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorCoinPolicyController} from "@4626/creator/revenue/CreatorCoinPolicyController.sol";

contract MockCreatorCoinAdmin {
    address public owner;
    address public payoutRecipient;

    constructor(address owner_) {
        owner = owner_;
    }

    function setPayoutRecipient(address recipient) external {
        require(msg.sender == owner, "not owner");
        payoutRecipient = recipient;
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "not owner");
        owner = newOwner;
    }
}

contract MockPayoutRouterPlaceholder {}

contract CreatorCoinPolicyControllerODA520Test is Test {
    MockCreatorCoinAdmin internal creatorCoin;
    MockPayoutRouterPlaceholder internal payoutRouter;
    CreatorCoinPolicyController internal controller;

    address internal protocolOwner;
    address internal nominee;

    function setUp() public {
        protocolOwner = makeAddr("protocolOwner");
        nominee = makeAddr("nominee");
        creatorCoin = new MockCreatorCoinAdmin(address(this));
        payoutRouter = new MockPayoutRouterPlaceholder();
        controller = new CreatorCoinPolicyController(address(creatorCoin), address(payoutRouter), protocolOwner);

        // Hand CreatorCoin ownership to the controller (deployment sequence).
        creatorCoin.transferOwnership(address(controller));
    }

    function test_ODA520_L6_acceptRequiresTimelock() public {
        vm.prank(protocolOwner);
        controller.proposeCreatorCoinOwnershipTransfer(nominee);

        uint256 executeAfter = block.timestamp + controller.OWNERSHIP_TRANSFER_DELAY();
        vm.expectRevert(
            abi.encodeWithSelector(CreatorCoinPolicyController.OwnershipTransferTooEarly.selector, executeAfter)
        );
        vm.prank(nominee);
        controller.acceptCreatorCoinOwnership();

        vm.warp(executeAfter);
        vm.prank(nominee);
        controller.acceptCreatorCoinOwnership();

        assertEq(creatorCoin.owner(), nominee);
        assertEq(controller.pendingCreatorCoinOwner(), address(0));
        assertEq(controller.pendingCreatorCoinOwnerProposedAt(), 0);
    }

    function test_ODA520_L6_cancelClearsProposalTimestamp() public {
        vm.prank(protocolOwner);
        controller.proposeCreatorCoinOwnershipTransfer(nominee);
        assertGt(controller.pendingCreatorCoinOwnerProposedAt(), 0);

        vm.prank(protocolOwner);
        controller.cancelCreatorCoinOwnershipTransfer();
        assertEq(controller.pendingCreatorCoinOwner(), address(0));
        assertEq(controller.pendingCreatorCoinOwnerProposedAt(), 0);
    }

    function test_ODA520_constructorRequiresCode() public {
        address eoa = makeAddr("eoa");
        vm.expectRevert(abi.encodeWithSelector(CreatorCoinPolicyController.CreatorCoinHasNoCode.selector, eoa));
        new CreatorCoinPolicyController(eoa, address(payoutRouter), protocolOwner);

        vm.expectRevert(abi.encodeWithSelector(CreatorCoinPolicyController.PayoutRouterHasNoCode.selector, eoa));
        new CreatorCoinPolicyController(address(creatorCoin), eoa, protocolOwner);
    }
}
