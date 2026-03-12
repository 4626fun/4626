// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {VaultGaugeVoting} from "../contracts/governance/VaultGaugeVoting.sol";

contract MockVe4626 {
    mapping(address => uint256) internal _votingPower;
    mapping(address => uint256) internal _remainingLockTime;
    uint256 internal _totalVotingPower;

    function setVotingPower(address user, uint256 power) external {
        _totalVotingPower = _totalVotingPower - _votingPower[user] + power;
        _votingPower[user] = power;
    }

    function setRemainingLockTime(address user, uint256 remaining) external {
        _remainingLockTime[user] = remaining;
    }

    function getVotingPower(address user) external view returns (uint256) {
        return _votingPower[user];
    }

    function getTotalVotingPower() external view returns (uint256) {
        return _totalVotingPower;
    }

    function hasActiveLock(address user) external view returns (bool) {
        return _votingPower[user] > 0;
    }

    function getRemainingLockTime(address user) external view returns (uint256) {
        return _remainingLockTime[user];
    }
}

contract MockRegistry {
    mapping(address => bool) internal _registered;

    function setRegistered(address vault, bool registered) external {
        _registered[vault] = registered;
    }

    function isRegisteredVault(address vault) external view returns (bool) {
        return _registered[vault];
    }
}

contract VaultGaugeVotingCheckpointAndWhitelistTest is Test {
    uint256 internal constant WEEK = 7 days;

    VaultGaugeVoting internal voting;
    MockVe4626 internal ve;

    address internal owner = address(this);
    address internal voter = address(0xBEEF);

    function setUp() public {
        ve = new MockVe4626();
        voting = new VaultGaugeVoting(address(ve), owner);

        ve.setVotingPower(voter, 100 ether);
        ve.setRemainingLockTime(voter, type(uint256).max);
    }

    function _warpToEpoch(uint256 epoch, uint256 offset) internal {
        uint256 genesis = voting.genesisEpochStart();
        vm.warp(genesis + epoch * WEEK + offset);
    }

    function _assertSingleEpochCheckpointedLog(Vm.Log[] memory logs, uint256 expectedEpoch, uint256 expectedTotalWeight)
        internal
        view
    {
        assertEq(logs.length, 1);
        assertEq(logs[0].emitter, address(voting));
        assertEq(logs[0].topics.length, 2);
        assertEq(logs[0].topics[0], keccak256("EpochCheckpointed(uint256,uint256)"));
        assertEq(uint256(logs[0].topics[1]), expectedEpoch);
        assertEq(abi.decode(logs[0].data, (uint256)), expectedTotalWeight);
    }

    function test_checkpoint_revertsDuringEpoch0() public {
        _warpToEpoch(0, 1);

        vm.expectRevert(VaultGaugeVoting.EpochNotEnded.selector);
        voting.checkpoint();
    }

    function test_checkpoint_finalizesPreviousEpoch_andEmitsOnlyOncePerEpoch() public {
        // Epoch 1 is ongoing, so epoch 0 is the most recently ended epoch.
        _warpToEpoch(1, 1);

        vm.recordLogs();
        voting.checkpoint();
        _assertSingleEpochCheckpointedLog(vm.getRecordedLogs(), 0, 0);

        // Calling again in the same epoch must be a no-op (no duplicate event).
        vm.recordLogs();
        voting.checkpoint();
        assertEq(vm.getRecordedLogs().length, 0);

        // Move forward: epoch 2 is ongoing, so epoch 1 is the most recently ended epoch.
        _warpToEpoch(2, 1);

        vm.recordLogs();
        voting.checkpoint();
        _assertSingleEpochCheckpointedLog(vm.getRecordedLogs(), 1, 0);
        assertEq(voting.lastCheckpointedEpoch(), 1);
    }

    function test_registryOnlyVault_isNotVoteEligible_orEnumerable_orBoosted() public {
        MockRegistry registry = new MockRegistry();
        voting.setRegistry(address(registry));
        voting.setUseRegistryWhitelist(true);

        address manualVault = makeAddr("manualVault");
        address registryOnlyVault = makeAddr("registryOnlyVault");

        registry.setRegistered(manualVault, true);
        registry.setRegistered(registryOnlyVault, true);

        // Make enumeration non-empty so a registry-only vault would otherwise receive
        // an equal-split boost under the current (vulnerable) logic.
        voting.setVaultWhitelist(manualVault, true);

        assertEq(voting.canReceiveVotes(registryOnlyVault), false);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(registryOnlyVault), 0);

        _warpToEpoch(0, 1);

        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = registryOnlyVault;
        weights[0] = 100;

        vm.prank(voter);
        vm.expectRevert(abi.encodeWithSelector(VaultGaugeVoting.VaultNotWhitelisted.selector, registryOnlyVault));
        voting.vote(vaults, weights);
    }

    function test_setVaultWhitelist_allowsUnregisteredButVaultRemainsIneligible_whenRegistryWhitelistEnabled() public {
        MockRegistry registry = new MockRegistry();
        voting.setRegistry(address(registry));
        voting.setUseRegistryWhitelist(true);

        address unregisteredVault = makeAddr("unregisteredVault");
        registry.setRegistered(unregisteredVault, false);

        voting.setVaultWhitelist(unregisteredVault, true);

        assertEq(voting.canReceiveVotes(unregisteredVault), false);
        assertEq(voting.getVaultGaugeProbabilityBoostPPM(unregisteredVault), 0);

        _warpToEpoch(0, 1);
        address[] memory vaults = new address[](1);
        uint256[] memory weights = new uint256[](1);
        vaults[0] = unregisteredVault;
        weights[0] = 100;

        vm.prank(voter);
        vm.expectRevert(abi.encodeWithSelector(VaultGaugeVoting.VaultNotWhitelisted.selector, unregisteredVault));
        voting.vote(vaults, weights);
    }
}

