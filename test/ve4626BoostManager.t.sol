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

/// @notice Curve working = min(l, 0.4l+0.6L·ve/Ve); returns quotedBoost = working/(0.4l) BPS ∈ [10k, 25k]
contract Ve4626BoostManagerMathTest is Test {
    MockVe4626BoostMath internal ve;
    ve4626BoostManager internal manager;

    address internal owner = address(0xA11CE);
    address internal user = address(0xB0B);

    uint256 internal constant L = 1_000e18; // pool USD

    function setUp() public {
        vm.roll(302_401);
        ve = new MockVe4626BoostMath();
        manager = new ve4626BoostManager(address(ve), owner);
        vm.prank(owner);
        manager.setMinVotingPower(0);
    }

    function testCurve_Tokenless_IsNeutralOneX() public {
        ve.setVotingPower(user, 0);
        ve.setTotalVotingPower(100 ether);

        // Covered, no ve → quoted boost 1.0× (not 0.4×)
        uint256 boost = manager.calculateBoostForPosition(user, 10e18, 10e18, L);
        assertEq(boost, 10_000);
    }

    function testCurve_ZeroPosition_ReturnsNeutral() public {
        ve.setVotingPower(user, 100 ether);
        ve.setTotalVotingPower(100 ether);
        assertEq(manager.calculateBoostForPosition(user, 0, 10e18, L), 10_000);
        assertEq(manager.calculateBoostForPosition(user, 10e18, 0, L), 10_000);
    }

    function testCurve_FullBoost_WhenVeMatchesLpShare() public {
        // ve/Ve >= l/L ⇒ working = l ⇒ quoted = 2.5×
        ve.setVotingPower(user, 10 ether);
        ve.setTotalVotingPower(1_000 ether);

        uint256 l = 10e18;
        uint256 boost = manager.calculateBoostForPosition(user, l, l, L);
        assertEq(boost, 25_000);
        assertEq(boost, manager.maxBoost());
    }

    function testCurve_OnePercentLp_WithHalfPercentVe_IsPartial() public {
        // working/l = 0.7 ⇒ quoted = 0.7/0.4 = 1.75 ⇒ 17_500
        ve.setVotingPower(user, 5 ether);
        ve.setTotalVotingPower(1_000 ether);

        uint256 l = 10e18;
        uint256 boost = manager.calculateBoostForPosition(user, l, l, L);
        assertEq(boost, 17_500);
        assertGt(boost, 10_000);
        assertLt(boost, 25_000);
    }

    function testCurve_SmallLp_LargeVe_CapsAtTwoPointFive() public {
        ve.setVotingPower(user, 50 ether);
        ve.setTotalVotingPower(100 ether);

        uint256 l = 1e18;
        uint256 boost = manager.calculateBoostForPosition(user, l, l, L);
        assertEq(boost, 25_000);
    }

    function testCurve_CoverageCaps_LAtSwap_TokenlessNeutral() public {
        ve.setVotingPower(user, 0);
        ve.setTotalVotingPower(1);
        uint256 boost = manager.calculateBoostForPosition(user, 1_000e18, 10e18, L);
        assertEq(boost, 10_000);
    }

    function testCoverage_UsesCreatorShareUsdOnly() public view {
        uint256 coverage =
            manager.getCoverageBps(user, address(0), address(0), address(0), 250_000_000, 1_000_000_000);
        assertEq(coverage, 2_500);
    }

    function testCoverage_CapsAtFullCoverage() public view {
        uint256 coverage =
            manager.getCoverageBps(user, address(0), address(0), address(0), 2_000_000_000, 1_000_000_000);
        assertEq(coverage, 10_000);
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
}
