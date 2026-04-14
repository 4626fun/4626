// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ve4626BoostManager} from "../contracts/governance/ve4626BoostManager.sol";

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

contract Ve4626BoostManagerMathTest is Test {
    MockVe4626BoostMath internal ve;
    ve4626BoostManager internal manager;

    address internal owner = address(0xA11CE);
    address internal user = address(0xB0B);

    function setUp() public {
        vm.roll(302_401); // Past MIN_HOLDING_BLOCKS (302400) so boost calculation proceeds
        ve = new MockVe4626BoostMath();
        manager = new ve4626BoostManager(address(ve), owner);
    }

    function testBoost_NoLongerSaturatesAtOnePercentShare() public {
        // 1% share should only grant 1% of the boost range (not max boost).
        ve.setVotingPower(user, 1 ether);
        ve.setTotalVotingPower(100 ether);

        uint256 boost = manager.calculateBoost(user);
        assertEq(boost, 10_150);
        assertLt(boost, manager.maxBoost());
    }

    function testBoost_ReachesMaxAtFullShare() public {
        ve.setVotingPower(user, 100 ether);
        ve.setTotalVotingPower(100 ether);

        uint256 boost = manager.calculateBoost(user);
        assertEq(boost, manager.maxBoost());
        assertEq(boost, 25_000);
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
}
