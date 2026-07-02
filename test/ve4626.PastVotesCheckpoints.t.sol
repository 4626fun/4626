// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ve4626} from "../contracts/governance/ve4626.sol";

contract MockWrappedShareOFT is ERC20 {
    constructor() ERC20("Wrapped Share", "wSHR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract Ve4626PastVotesCheckpointsTest is Test {
    ve4626 internal veToken;
    MockWrappedShareOFT internal wrapped;

    address internal user = makeAddr("locker");
    uint256 internal constant LOCK_AMOUNT = 100e18;

    function setUp() public {
        wrapped = new MockWrappedShareOFT();
        veToken = new ve4626("Vote Escrowed 4626", "ve4626", address(wrapped), address(this));
        wrapped.mint(user, 1_000e18);
    }

    function test_getPastVotes_usesHistoricalLockBeforeExtend() public {
        uint256 maxDuration = veToken.MAX_LOCK_DURATION();

        vm.startPrank(user);
        wrapped.approve(address(veToken), LOCK_AMOUNT);
        veToken.lock(address(wrapped), LOCK_AMOUNT, maxDuration);

        uint256 lockStart = block.timestamp;
        uint256 originalEnd = lockStart + maxDuration;
        uint256 snapshot = lockStart + 45 days;

        vm.warp(lockStart + 90 days);
        veToken.extendLock(block.timestamp + maxDuration);
        vm.stopPrank();

        uint256 expectedAtSnapshot = (LOCK_AMOUNT * (originalEnd - snapshot)) / maxDuration;
        uint256 extendedEnd = block.timestamp + maxDuration;
        uint256 powerIfExtendedEndWereUsedAtSnapshot = (LOCK_AMOUNT * (extendedEnd - snapshot)) / maxDuration;

        assertEq(veToken.getPastVotes(user, snapshot), expectedAtSnapshot);
        assertEq(veToken.votingPowerAt(user, snapshot), expectedAtSnapshot);
        assertGt(powerIfExtendedEndWereUsedAtSnapshot, expectedAtSnapshot);
        assertEq(veToken.votingPower(user), LOCK_AMOUNT);
    }

    function test_getPastVotes_retainsHistoryBeforeUnlock() public {
        uint256 maxDuration = veToken.MAX_LOCK_DURATION();

        vm.startPrank(user);
        wrapped.approve(address(veToken), LOCK_AMOUNT);
        veToken.lock(address(wrapped), LOCK_AMOUNT, maxDuration);

        uint256 lockStart = block.timestamp;
        uint256 snapshot = lockStart + 30 days;
        uint256 originalEnd = lockStart + maxDuration;

        vm.warp(lockStart + maxDuration);
        veToken.unlock();
        vm.stopPrank();

        uint256 expectedAtSnapshot = (LOCK_AMOUNT * (originalEnd - snapshot)) / maxDuration;
        assertEq(veToken.getPastVotes(user, snapshot), expectedAtSnapshot);
        assertEq(veToken.votingPower(user), 0);
    }

    function test_getPastVotes_revertsForFutureTimepoint() public {
        uint256 maxDuration = veToken.MAX_LOCK_DURATION();

        vm.startPrank(user);
        wrapped.approve(address(veToken), LOCK_AMOUNT);
        veToken.lock(address(wrapped), LOCK_AMOUNT, maxDuration);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(ve4626.FutureVotesLookup.selector, block.timestamp + 1, block.timestamp));
        veToken.getPastVotes(user, block.timestamp + 1);
    }
}
