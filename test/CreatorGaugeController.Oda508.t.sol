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
}
