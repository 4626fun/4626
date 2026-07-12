// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ve4626BoostManager} from "@4626/shared/governance/ve4626BoostManager.sol";

contract MockVe4626BoostMath {
    mapping(address => uint256) public votingPower;
    uint256 public totalVotingPower;
    mapping(address => bool) public activeLock;
    mapping(address => uint256) public remainingLockTime;

    function setVotingPower(address user, uint256 power) external {
        votingPower[user] = power;
    }

    function setTotalVotingPower(uint256 totalPower) external {
        totalVotingPower = totalPower;
    }

    function setActiveLock(address user, bool hasLock) external {
        activeLock[user] = hasLock;
    }

    function setRemainingLockTime(address user, uint256 timeRemaining) external {
        remainingLockTime[user] = timeRemaining;
    }

    function getVotingPower(address user) external view returns (uint256) {
        return votingPower[user];
    }

    function getTotalVotingPower() external view returns (uint256) {
        return totalVotingPower;
    }

    function hasActiveLock(address user) external view returns (bool) {
        return activeLock[user];
    }

    function getRemainingLockTime(address user) external view returns (uint256) {
        return remainingLockTime[user];
    }
}

contract MockVe4626UtilityBoostMath {
    MockVe4626BoostMath internal immutable ve;

    constructor(MockVe4626BoostMath ve_) {
        ve = ve_;
    }

    function effectiveVeLotteryOf(address user) external view returns (uint256) {
        return ve.votingPower(user);
    }

    function veLottery() external pure returns (address) {
        return address(1);
    }
}

/// @notice working = min(0.4*l + 0.6*L*(ve/Ve), l); boost = working/(0.4*l) ∈ [1, 2.5]
contract Ve4626BoostManagerMathTest is Test {
    MockVe4626BoostMath internal ve;
    MockVe4626UtilityBoostMath internal utility;
    ve4626BoostManager internal manager;

    address internal owner = address(0xA11CE);
    address internal user = address(0xB0B);

    uint256 internal constant L = 1_000e18; // pool USD

    function setUp() public {
        ve = new MockVe4626BoostMath();
        utility = new MockVe4626UtilityBoostMath(ve);
        manager = new ve4626BoostManager(address(ve), owner);
        vm.startPrank(owner);
        manager.setUtility(address(utility));
        manager.setMinVotingPower(0);
        vm.stopPrank();
        vm.prank(address(ve));
        manager.updateBalanceTracking(user);
        vm.roll(block.number + manager.MIN_HOLDING_BLOCKS());
    }

    function testCurve_Tokenless_IsOneX() public {
        ve.setVotingPower(user, 0);
        ve.setTotalVotingPower(100 ether);

        uint256 boost = manager.calculateBoostForPosition(user, 10e18, 10e18, L);
        assertEq(boost, 10_000);
    }

    function testCurve_ZeroPosition_ReturnsNeutral() public {
        ve.setVotingPower(user, 100 ether);
        ve.setTotalVotingPower(100 ether);
        // l = 0 → personal layer inactive (baseBoost 1.0, leaves LM base odds alone)
        assertEq(manager.calculateBoostForPosition(user, 0, 10e18, L), 10_000);
        assertEq(manager.calculateBoostForPosition(user, 10e18, 0, L), 10_000);
    }

    function testCurve_TinyPositionWithZeroTokenlessWorkingIsNeutral() public {
        ve.setVotingPower(user, 100 ether);
        ve.setTotalVotingPower(100 ether);
        assertEq(manager.calculateBoostForPosition(user, 1, 1, L), 10_000);
    }

    function testCurve_ZeroTotalVeIsNeutral() public {
        ve.setVotingPower(user, 100 ether);
        ve.setTotalVotingPower(0);
        assertEq(manager.calculateBoostForPosition(user, 10e18, 10e18, L), 10_000);
    }

    function testCurve_FullBoost_WhenVeMatchesLpShare() public {
        // ve/Ve >= l/L ⇒ working = l ⇒ boost = l/(0.4*l) = 2.5
        // l/L = 1% ⇒ need ve/Ve >= 1%
        ve.setVotingPower(user, 10 ether);
        ve.setTotalVotingPower(1_000 ether);

        uint256 l = 10e18;
        uint256 boost = manager.calculateBoostForPosition(user, l, l, L);
        assertEq(boost, 25_000);
        assertEq(boost, manager.maxBoost());
    }

    function testCurve_OnePercentLp_WithHalfPercentVe_IsPartial() public {
        // l/L = 1%, ve/Ve = 0.5%
        // working/l = 0.7; normalized boost = 0.7/0.4 = 1.75
        ve.setVotingPower(user, 5 ether);
        ve.setTotalVotingPower(1_000 ether);

        uint256 l = 10e18;
        uint256 boost = manager.calculateBoostForPosition(user, l, l, L);
        assertEq(boost, 17_500);
        assertGt(boost, 10_000);
        assertLt(boost, 25_000);
    }

    function testCurve_SmallLp_LargeVe_CapsAtTwoPointFive() public {
        // Working balance caps at l; normalized boost caps at 2.5×.
        ve.setVotingPower(user, 50 ether);
        ve.setTotalVotingPower(100 ether);

        uint256 l = 1e18;
        uint256 boost = manager.calculateBoostForPosition(user, l, l, L);
        assertEq(boost, 25_000);
    }

    function testCurve_CoverageCaps_LAtSwap() public {
        ve.setVotingPower(user, 0);
        ve.setTotalVotingPower(1);
        uint256 boost = manager.calculateBoostForPosition(user, 1_000e18, 10e18, L);
        assertEq(boost, 10_000);
    }

    function testCoverage_UsesCreatorShareUsdOnly() public view {
        uint256 coverage =
            manager.getCoverageBps(user, address(0), address(0), address(0), 250_000_000, 1_000_000_000);
        assertEq(coverage, 2_500); // 25%
    }

    function testCoverage_CapsAtFullCoverage() public view {
        uint256 coverage =
            manager.getCoverageBps(user, address(0), address(0), address(0), 2_000_000_000, 1_000_000_000);
        assertEq(coverage, 10_000); // 100%
    }

    function testCoverage_ZeroWhenMissingInputs() public view {
        assertEq(manager.getCoverageBps(user, address(0), address(0), address(0), 0, 1_000_000), 0);
        assertEq(manager.getCoverageBps(user, address(0), address(0), address(0), 1_000_000, 0), 0);
    }

    function testLegacy_CalculateBoost_FullIfEligibleVe() public {
        ve.setVotingPower(user, 1 ether);
        ve.setTotalVotingPower(100 ether);
        assertEq(manager.calculateBoost(user), 25_000);

        ve.setVotingPower(user, 0);
        assertEq(manager.calculateBoost(user), 10_000);
    }

    function testHoldingPeriod_UninitializedUserIsNeutral() public {
        address untracked = makeAddr("untracked");
        ve.setVotingPower(untracked, 100 ether);
        ve.setTotalVotingPower(100 ether);
        assertEq(manager.calculateBoostForPosition(untracked, 10e18, 10e18, L), 10_000);
        assertFalse(manager.hasBoost(untracked));
    }

    function testHoldingPeriod_ExactBoundaryIsEligible() public {
        ve.setVotingPower(user, 10 ether);
        ve.setTotalVotingPower(1_000 ether);
        assertEq(manager.calculateBoostForPosition(user, 10e18, 10e18, L), 25_000);
    }

    function testHoldingPeriod_BlockBeforeBoundaryIsNeutral() public {
        vm.prank(address(ve));
        manager.updateBalanceTracking(user);
        vm.roll(block.number + manager.MIN_HOLDING_BLOCKS() - 1);
        ve.setVotingPower(user, 10 ether);
        ve.setTotalVotingPower(1_000 ether);
        assertEq(manager.calculateBoostForPosition(user, 10e18, 10e18, L), 10_000);
    }

    function testUtility_MissingConfigurationRevertsAfterHoldingPeriod() public {
        ve4626BoostManager unconfigured = new ve4626BoostManager(address(ve), owner);
        vm.prank(address(ve));
        unconfigured.updateBalanceTracking(user);
        vm.roll(block.number + unconfigured.MIN_HOLDING_BLOCKS());

        vm.expectRevert(ve4626BoostManager.UtilityNotConfigured.selector);
        unconfigured.calculateBoostForPosition(user, 10e18, 10e18, L);
    }

    function testBoostParameters_AcceptsCurveMaximumAfterTimelock() public {
        vm.prank(owner);
        manager.setBoostParameters(10_000, 25_000);
        vm.warp(block.timestamp + manager.BOOST_TIMELOCK_DURATION());
        vm.prank(owner);
        manager.executeBoostParameterUpdate();

        assertEq(manager.baseBoost(), 10_000);
        assertEq(manager.maxBoost(), 25_000);
    }

    function testBoostParameters_RejectsNonNeutralBase() public {
        vm.prank(owner);
        vm.expectRevert(ve4626BoostManager.InvalidBoostParameters.selector);
        manager.setBoostParameters(4_000, 25_000);
    }

    function testFuzz_CurveBoostStaysBoundedAndMonotone(uint96 userPowerA, uint96 userPowerB) public {
        uint256 low = uint256(userPowerA < userPowerB ? userPowerA : userPowerB);
        uint256 high = uint256(userPowerA < userPowerB ? userPowerB : userPowerA);
        uint256 total = high + 1;
        ve.setTotalVotingPower(total);

        uint256 l = 10e18;
        ve.setVotingPower(user, low);
        uint256 lowBoost = manager.calculateBoostForPosition(user, l, l, L);
        ve.setVotingPower(user, high);
        uint256 highBoost = manager.calculateBoostForPosition(user, l, l, L);

        assertGe(lowBoost, 10_000);
        assertLe(highBoost, 25_000);
        assertGe(highBoost, lowBoost);
    }
}
