// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {CreatorGaugeController} from "@4626/creator/revenue/CreatorGaugeController.sol";

/// @notice ODA-508-3 creator-lane twin: the one-way lotteryManagerInitialized flag closes the
///         revoke-then-reset timelock bypass (identical fix to AgentGaugeController).
contract CreatorGaugeControllerOda508Test is Test {
    CreatorGaugeController internal gauge;

    address internal firstManager = makeAddr("firstManager");
    address internal secondManager = makeAddr("secondManager");

    function setUp() public {
        vm.chainId(8453);
        gauge = new CreatorGaugeController(makeAddr("shareOFT"), address(0), makeAddr("protocolTreasury"), address(this));
    }

    function test_f3_revokeThenResetRoutesThroughTimelock() public {
        gauge.setLotteryManager(firstManager);
        assertEq(address(gauge.lotteryManager()), firstManager, "first-ever set is immediate");
        assertTrue(gauge.lotteryManagerInitialized());

        gauge.setLotteryManager(address(0)); // immediate revoke
        assertEq(address(gauge.lotteryManager()), address(0));

        // Pre-fix this re-set applied instantly (the bypass); now it must queue.
        gauge.setLotteryManager(secondManager);
        assertEq(address(gauge.lotteryManager()), address(0), "re-set must not apply instantly");
        assertEq(address(gauge.pendingLotteryManager()), secondManager);
        uint256 executeAfter = gauge.pendingLotteryManagerAt();
        assertGt(executeAfter, block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorGaugeController.LotteryManagerUpdateTimelockActive.selector, executeAfter)
        );
        gauge.executeLotteryManagerUpdate();

        vm.warp(executeAfter);
        gauge.executeLotteryManagerUpdate();
        assertEq(address(gauge.lotteryManager()), secondManager);
    }

    function test_f3_revokeCancelsPendingButDoesNotRearmImmediate() public {
        gauge.setLotteryManager(firstManager);
        gauge.setLotteryManager(secondManager); // queues
        gauge.setLotteryManager(address(0)); // revokes + cancels pending
        assertEq(address(gauge.pendingLotteryManager()), address(0));
        assertEq(gauge.pendingLotteryManagerAt(), 0);

        // Re-set still routes through the timelock despite the cleared queue.
        gauge.setLotteryManager(secondManager);
        assertEq(address(gauge.lotteryManager()), address(0));
        assertEq(address(gauge.pendingLotteryManager()), secondManager);
        assertGt(gauge.pendingLotteryManagerAt(), block.timestamp);
    }

    // ---------------- Second-pass lows (L-4, L-5 gas half, L-8) ----------------

    function test_l4_oracleChangeTimelocked() public {
        address oracle1 = makeAddr("oracle1");
        address oracle2 = makeAddr("oracle2");
        address oracle3 = makeAddr("oracle3");

        gauge.setOracle(oracle1); // first-ever set: immediate
        assertEq(address(gauge.oracle()), oracle1);
        assertTrue(gauge.oracleInitialized());

        gauge.setOracle(oracle2);
        assertEq(address(gauge.oracle()), oracle1, "change not applied instantly");
        assertEq(gauge.pendingOracle(), oracle2);
        uint256 executeAfter = gauge.pendingOracleAt();
        assertGt(executeAfter, block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorGaugeController.OracleUpdateTooEarly.selector, executeAfter)
        );
        gauge.executeOracleUpdate();

        vm.warp(executeAfter);
        gauge.executeOracleUpdate();
        assertEq(address(gauge.oracle()), oracle2);
        assertEq(gauge.pendingOracle(), address(0));

        gauge.setOracle(oracle3);
        gauge.cancelOracleUpdate();
        assertEq(gauge.pendingOracle(), address(0));
        vm.expectRevert(CreatorGaugeController.NoPendingOracleUpdate.selector);
        gauge.executeOracleUpdate();
        assertEq(address(gauge.oracle()), oracle2, "cancel preserves current oracle");
    }

    function test_l4_routerAllowlistTimelockedRemovalInstant() public {
        address router = makeAddr("router");

        gauge.setAllowedSwapRouter(router, true);
        assertFalse(gauge.allowedSwapRouters(router), "addition not applied instantly");
        uint256 executeAfter = gauge.pendingRouterAllowlist(router);
        assertGt(executeAfter, block.timestamp);

        vm.expectRevert(
            abi.encodeWithSelector(CreatorGaugeController.RouterAllowlistTooEarly.selector, executeAfter)
        );
        gauge.executeRouterAllowlist(router);

        vm.warp(executeAfter);
        gauge.executeRouterAllowlist(router);
        assertTrue(gauge.allowedSwapRouters(router));

        // Removal immediate + clears a pending addition.
        gauge.setAllowedSwapRouter(router, false);
        assertFalse(gauge.allowedSwapRouters(router));
        gauge.setAllowedSwapRouter(router, true);
        gauge.setAllowedSwapRouter(router, false);
        vm.expectRevert(CreatorGaugeController.NoPendingRouterAllowlist.selector);
        gauge.executeRouterAllowlist(router);
    }

    function test_l5_stipendSendKeepsRawEthSweepable() public {
        StipendSender508c sender = new StipendSender508c();
        vm.deal(address(sender), 1 ether);

        // `.transfer` stipend (2,300 gas): pre-fix this reverted in receive(); now the ETH is
        // accepted raw and recoverable via the ported native sweep.
        sender.send(payable(address(gauge)), 1 ether);
        assertEq(address(gauge).balance, 1 ether, "raw ETH accepted");
        assertEq(gauge.pendingWETHFees(), 0, "stipend send not earmarked");

        address treasury = makeAddr("treasury");
        gauge.emergencyWithdraw(address(0), 1 ether, treasury);
        vm.warp(gauge.pendingEmergencyWithdrawAt());
        gauge.executeEmergencyWithdraw();
        assertEq(treasury.balance, 1 ether);
        assertEq(address(gauge).balance, 0);
    }

    function test_l8_twoStepOwnershipTransfer() public {
        address stranger = makeAddr("stranger");
        gauge.transferOwnership(stranger);
        assertEq(gauge.owner(), address(this), "mistyped/unaccepted target keeps current owner");
        assertEq(gauge.pendingOwner(), stranger);

        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", address(this)));
        gauge.acceptOwnership();

        vm.prank(stranger);
        gauge.acceptOwnership();
        assertEq(gauge.owner(), stranger);
        assertEq(gauge.pendingOwner(), address(0));

        vm.prank(stranger);
        vm.expectRevert(CreatorGaugeController.OwnershipRenounceDisabled.selector);
        gauge.renounceOwnership();
    }
}

/// @dev Sends ETH via `.transfer` (2,300-gas stipend) — L-5 gas-stipend repro.
contract StipendSender508c {
    function send(address payable to, uint256 amount) external {
        to.transfer(amount);
    }

    receive() external payable {}
}
