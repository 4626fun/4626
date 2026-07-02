// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {CreatorLotteryManager} from "../contracts/utilities/lottery/CreatorLotteryManager.sol";

// =====================================================================
// Mocks (namespaced -BSTL to avoid collision with other test files)
// =====================================================================

contract MockCreatorOracleBSTL {
    int256 public price = 1e18;
    uint256 public updatedAt;

    constructor() {
        updatedAt = block.timestamp;
    }

    function getCreatorPrice() external view returns (int256, uint256) {
        return (price, updatedAt);
    }
}

contract MockLotteryRegistryBSTL {
    address public immutable endpoint;
    address public immutable creatorCoin;
    address public immutable shareOFT;
    address public immutable oracle;
    address public vault;
    bool public active = true;

    constructor(address _endpoint, address _creatorCoin, address _shareOFT, address _oracle) {
        endpoint = _endpoint;
        creatorCoin = _creatorCoin;
        shareOFT = _shareOFT;
        oracle = _oracle;
    }

    function setVault(address _vault) external { vault = _vault; }

    function getVaultForToken(address) external view returns (address) { return vault; }
    function getShareOFTForToken(address token) external view returns (address) {
        if (token == creatorCoin) return shareOFT;
        return address(0);
    }
    function getTokenForShareOFT(address _shareOFT) external view returns (address) {
        if (_shareOFT == shareOFT) return creatorCoin;
        return address(0);
    }
    function getOracleForToken(address token) external view returns (address) {
        if (token == creatorCoin) return oracle;
        return address(0);
    }
    function getGaugeControllerForToken(address) external pure returns (address) { return address(0); }
    function isCreatorCoinActive(address token) external view returns (bool) {
        return active && token == creatorCoin;
    }
    function getLayerZeroEndpoint(uint256) external view returns (address) { return endpoint; }
    function getAllCreatorCoins() external view returns (address[] memory coins) {
        coins = new address[](1);
        coins[0] = creatorCoin;
    }
}

contract MockBoostManagerBSTL {
    function calculateBoost(address) external pure returns (uint256) { return 10_000; }
    function getCoverageBps(address, address, address, address, uint256, uint256) external pure returns (uint256) { return 0; }
    function getTotalProbabilityBoost(address) external pure returns (uint256) { return 0; }
}

contract MockVaultGaugeBSTL {
    function getVaultGaugeProbabilityBoostPPM(address) external pure returns (uint256) { return 0; }
}

// =====================================================================
// Test contract
// =====================================================================

/// @notice PR 3 — Boost-source timelock coverage.
/// Verifies the propose/commit/cancel lifecycle for `boostManager` and
/// `vaultGaugeVoting`, the one-way `armBoostSourceTimelock` switch, the
/// emergency `disableBoostSources` circuit breaker, and the gating of legacy
/// setters once the timelock is armed.
contract CreatorLotteryManagerBoostSourceTimelockTest is Test {
    CreatorLotteryManager internal manager;
    MockLotteryRegistryBSTL internal registry;
    MockCreatorOracleBSTL internal oracle;
    MockBoostManagerBSTL internal boostA;
    MockBoostManagerBSTL internal boostB;
    MockVaultGaugeBSTL internal gaugeA;
    MockVaultGaugeBSTL internal gaugeB;

    address internal owner = address(0xA11CE);
    address internal nonOwner = address(0xBEEF);

    address internal creatorCoin = address(0x1001);
    address internal shareOFT = address(0x1002);
    address internal vault = address(0x1003);

    address internal constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;

    // Storage slot indices (verified via `forge inspect storageLayout`).
    uint256 internal constant SLOT_BOOST_MANAGER = 9;
    uint256 internal constant SLOT_VAULT_GAUGE = 10;
    uint256 internal constant SLOT_PENDING_BOOST_MGR = 60;
    uint256 internal constant SLOT_PENDING_BOOST_MGR_EFFECTIVE_AT = 61;
    uint256 internal constant SLOT_PENDING_GAUGE = 62;
    uint256 internal constant SLOT_PENDING_GAUGE_EFFECTIVE_AT = 63;
    uint256 internal constant SLOT_TIMELOCK_ARMED = 64;

    uint256 internal constant TIMELOCK_DELAY = 24 hours;

    // Re-declared events for vm.expectEmit checks.
    event BoostManagerProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
    event BoostManagerProposalCancelled(address indexed cancelled);
    event BoostManagerUpdated(address indexed previous, address indexed newManager);
    event VaultGaugeVotingProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
    event VaultGaugeVotingProposalCancelled(address indexed cancelled);
    event VaultGaugeVotingUpdated(address indexed previous, address indexed newGauge);
    event BoostSourceTimelockArmed();
    event BoostSourcesDisabled(address indexed previousBoostManager, address indexed previousVaultGaugeVoting);

    function setUp() public {
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("setDelegate(address)"), abi.encode());
        vm.mockCall(LZ_ENDPOINT, abi.encodeWithSignature("delegate()"), abi.encode(owner));

        oracle = new MockCreatorOracleBSTL();
        registry = new MockLotteryRegistryBSTL(LZ_ENDPOINT, creatorCoin, shareOFT, address(oracle));
        registry.setVault(vault);
        boostA = new MockBoostManagerBSTL();
        boostB = new MockBoostManagerBSTL();
        gaugeA = new MockVaultGaugeBSTL();
        gaugeB = new MockVaultGaugeBSTL();

        vm.prank(owner);
        manager = new CreatorLotteryManager(address(registry), owner);

        // Bootstrap initial sources via legacy setters before arming.
        vm.startPrank(owner);
        manager.setBoostManager(address(boostA));
        manager.setVaultGaugeVoting(address(gaugeA));
        vm.stopPrank();
    }

    // ---- helpers ----

    function _readPendingBoostMgr() internal view returns (address) {
        return address(uint160(uint256(vm.load(address(manager), bytes32(SLOT_PENDING_BOOST_MGR)))));
    }

    function _readPendingBoostMgrEffectiveAt() internal view returns (uint256) {
        return uint256(vm.load(address(manager), bytes32(SLOT_PENDING_BOOST_MGR_EFFECTIVE_AT)));
    }

    function _readPendingGauge() internal view returns (address) {
        return address(uint160(uint256(vm.load(address(manager), bytes32(SLOT_PENDING_GAUGE)))));
    }

    function _readPendingGaugeEffectiveAt() internal view returns (uint256) {
        return uint256(vm.load(address(manager), bytes32(SLOT_PENDING_GAUGE_EFFECTIVE_AT)));
    }

    function _readTimelockArmed() internal view returns (bool) {
        return uint256(vm.load(address(manager), bytes32(SLOT_TIMELOCK_ARMED))) != 0;
    }

    function _readBoostManager() internal view returns (address) {
        return address(uint160(uint256(vm.load(address(manager), bytes32(SLOT_BOOST_MANAGER)))));
    }

    function _readVaultGauge() internal view returns (address) {
        return address(uint160(uint256(vm.load(address(manager), bytes32(SLOT_VAULT_GAUGE)))));
    }

    // -------------------------------------------------------------
    // 1. Pre-arm: legacy setters work, propose/commit revert
    // -------------------------------------------------------------

    function test_PreArm_LegacySettersStillWork() public {
        // setUp already used the legacy setters; verify state.
        assertEq(_readBoostManager(), address(boostA), "boostManager set via legacy");
        assertEq(_readVaultGauge(), address(gaugeA), "vaultGaugeVoting set via legacy");
        assertFalse(_readTimelockArmed(), "timelock not armed yet");

        // Re-call legacy setter pre-arm — should still succeed.
        vm.prank(owner);
        manager.setBoostManager(address(boostB));
        assertEq(_readBoostManager(), address(boostB), "legacy setter still effective pre-arm");
    }

    function test_PreArm_ProposeBoostManager_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.TimelockNotArmed.selector);
        manager.proposeBoostManager(address(boostB));
    }

    function test_PreArm_ProposeVaultGaugeVoting_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.TimelockNotArmed.selector);
        manager.proposeVaultGaugeVoting(address(gaugeB));
    }

    // -------------------------------------------------------------
    // 2. Arming the timelock
    // -------------------------------------------------------------

    function test_Arm_FlipsArmedFlag_AndEmits() public {
        vm.expectEmit(false, false, false, true);
        emit BoostSourceTimelockArmed();
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        assertTrue(_readTimelockArmed(), "armed flag set");
    }

    function test_Arm_OnceOnly_RevertsOnSecondCall() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.TimelockAlreadyArmed.selector);
        manager.armBoostSourceTimelock();
    }

    function test_Arm_NonOwner_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        manager.armBoostSourceTimelock();
    }

    // -------------------------------------------------------------
    // 3. Post-arm: legacy setters disabled
    // -------------------------------------------------------------

    function test_PostArm_SetBoostManager_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.LegacySetterDisabled.selector);
        manager.setBoostManager(address(boostB));

        // State unchanged.
        assertEq(_readBoostManager(), address(boostA));
    }

    function test_PostArm_SetVaultGaugeVoting_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.LegacySetterDisabled.selector);
        manager.setVaultGaugeVoting(address(gaugeB));

        assertEq(_readVaultGauge(), address(gaugeA));
    }

    // -------------------------------------------------------------
    // 4. Propose → wait → commit happy path: boostManager
    // -------------------------------------------------------------

    function test_BoostManager_HappyPath_ProposeWaitCommit() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        uint256 proposeAt = block.timestamp;
        uint256 expectedEffective = proposeAt + TIMELOCK_DELAY;

        vm.expectEmit(true, true, false, true);
        emit BoostManagerProposed(address(boostA), address(boostB), expectedEffective);
        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));

        // Pending state recorded.
        assertEq(_readPendingBoostMgr(), address(boostB), "pending boost mgr stored");
        assertEq(_readPendingBoostMgrEffectiveAt(), expectedEffective, "effectiveAt stored");
        // Live source unchanged until commit.
        assertEq(_readBoostManager(), address(boostA), "live unchanged pre-commit");

        // Wait the full delay.
        vm.warp(expectedEffective);

        vm.expectEmit(true, true, false, true);
        emit BoostManagerUpdated(address(boostA), address(boostB));
        vm.prank(owner);
        manager.commitBoostManager();

        // Live source flipped, pending cleared.
        assertEq(_readBoostManager(), address(boostB), "boost mgr flipped on commit");
        assertEq(_readPendingBoostMgr(), address(0), "pending cleared");
        assertEq(_readPendingBoostMgrEffectiveAt(), 0, "effectiveAt cleared");
    }

    function test_BoostManager_TooEarlyCommit_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));

        // 1 second before the window expires.
        vm.warp(block.timestamp + TIMELOCK_DELAY - 1);

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.TimelockNotExpired.selector);
        manager.commitBoostManager();

        // State unchanged.
        assertEq(_readBoostManager(), address(boostA), "still old impl");
        assertEq(_readPendingBoostMgr(), address(boostB), "proposal still pending");
    }

    function test_BoostManager_CommitWithoutProposal_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.NoPendingProposal.selector);
        manager.commitBoostManager();
    }

    // -------------------------------------------------------------
    // 5. Cancel during the window
    // -------------------------------------------------------------

    function test_BoostManager_CancelDuringWindow_ClearsPending() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));

        // Mid-window.
        vm.warp(block.timestamp + (TIMELOCK_DELAY / 2));

        vm.expectEmit(true, false, false, true);
        emit BoostManagerProposalCancelled(address(boostB));
        vm.prank(owner);
        manager.cancelBoostManagerProposal();

        assertEq(_readPendingBoostMgr(), address(0), "pending cleared");
        assertEq(_readPendingBoostMgrEffectiveAt(), 0, "effectiveAt cleared");
        assertEq(_readBoostManager(), address(boostA), "live source untouched");
    }

    function test_BoostManager_CancelWithoutProposal_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        vm.expectRevert(CreatorLotteryManager.NoPendingProposal.selector);
        manager.cancelBoostManagerProposal();
    }

    // -------------------------------------------------------------
    // 6. Symmetric path for vaultGaugeVoting
    // -------------------------------------------------------------

    function test_VaultGaugeVoting_HappyPath_ProposeWaitCommit() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        uint256 expectedEffective = block.timestamp + TIMELOCK_DELAY;

        vm.expectEmit(true, true, false, true);
        emit VaultGaugeVotingProposed(address(gaugeA), address(gaugeB), expectedEffective);
        vm.prank(owner);
        manager.proposeVaultGaugeVoting(address(gaugeB));

        assertEq(_readPendingGauge(), address(gaugeB));
        assertEq(_readPendingGaugeEffectiveAt(), expectedEffective);

        vm.warp(expectedEffective);

        vm.expectEmit(true, true, false, true);
        emit VaultGaugeVotingUpdated(address(gaugeA), address(gaugeB));
        vm.prank(owner);
        manager.commitVaultGaugeVoting();

        assertEq(_readVaultGauge(), address(gaugeB));
        assertEq(_readPendingGauge(), address(0));
        assertEq(_readPendingGaugeEffectiveAt(), 0);
    }

    function test_VaultGaugeVoting_CancelDuringWindow() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        manager.proposeVaultGaugeVoting(address(gaugeB));

        vm.expectEmit(true, false, false, true);
        emit VaultGaugeVotingProposalCancelled(address(gaugeB));
        vm.prank(owner);
        manager.cancelVaultGaugeVotingProposal();

        assertEq(_readPendingGauge(), address(0));
        assertEq(_readVaultGauge(), address(gaugeA));
    }

    // -------------------------------------------------------------
    // 7. Re-proposal overwrites previous pending
    // -------------------------------------------------------------

    function test_Propose_OverwritesPreviousPending() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));
        assertEq(_readPendingBoostMgr(), address(boostB));

        // Move time, re-propose with a different address — effectiveAt should
        // reset to the new propose time + delay.
        vm.warp(block.timestamp + 1 hours);

        address third = address(0x9999);
        uint256 newEffective = block.timestamp + TIMELOCK_DELAY;

        vm.prank(owner);
        manager.proposeBoostManager(third);

        assertEq(_readPendingBoostMgr(), third, "pending overwritten");
        assertEq(_readPendingBoostMgrEffectiveAt(), newEffective, "effectiveAt reset");
    }

    // -------------------------------------------------------------
    // 8. Emergency disable circuit breaker
    // -------------------------------------------------------------

    function test_DisableBoostSources_ZerosBothAndClearsPending() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        // Queue a pending proposal.
        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));
        vm.prank(owner);
        manager.proposeVaultGaugeVoting(address(gaugeB));

        vm.expectEmit(true, true, false, true);
        emit BoostSourcesDisabled(address(boostA), address(gaugeA));
        vm.prank(owner);
        manager.disableBoostSources();

        assertEq(_readBoostManager(), address(0), "boost mgr zeroed");
        assertEq(_readVaultGauge(), address(0), "gauge zeroed");
        assertEq(_readPendingBoostMgr(), address(0), "pending boost mgr cleared");
        assertEq(_readPendingBoostMgrEffectiveAt(), 0, "effectiveAt cleared");
        assertEq(_readPendingGauge(), address(0), "pending gauge cleared");
        assertEq(_readPendingGaugeEffectiveAt(), 0, "gauge effectiveAt cleared");
    }

    function test_DisableBoostSources_NoTimelockRequired_PreArm() public {
        // Circuit breaker must work even before arming.
        assertFalse(_readTimelockArmed());

        vm.expectEmit(true, true, false, true);
        emit BoostSourcesDisabled(address(boostA), address(gaugeA));
        vm.prank(owner);
        manager.disableBoostSources();

        assertEq(_readBoostManager(), address(0));
        assertEq(_readVaultGauge(), address(0));
    }

    function test_DisableBoostSources_NonOwner_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        manager.disableBoostSources();
    }

    // -------------------------------------------------------------
    // 9. After commit, can immediately propose another change
    // -------------------------------------------------------------

    function test_AfterCommit_CanProposeAgain() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        // First proposal cycle.
        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        vm.prank(owner);
        manager.commitBoostManager();
        assertEq(_readBoostManager(), address(boostB));

        // Second cycle — propose flipping back to boostA.
        uint256 nowTs = block.timestamp;
        vm.prank(owner);
        manager.proposeBoostManager(address(boostA));
        assertEq(_readPendingBoostMgr(), address(boostA));
        // effectiveAt must be exactly TIMELOCK_DELAY in the future from this propose call.
        uint256 storedEffective = _readPendingBoostMgrEffectiveAt();
        assertEq(storedEffective - nowTs, TIMELOCK_DELAY, "effectiveAt = now + delay");
    }

    // -------------------------------------------------------------
    // 10. Non-owner gating on every PR 3 entry point
    // -------------------------------------------------------------

    function test_ProposeBoostManager_NonOwner_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(nonOwner);
        vm.expectRevert();
        manager.proposeBoostManager(address(boostB));
    }

    function test_CommitBoostManager_NonOwner_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();
        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));
        vm.warp(block.timestamp + TIMELOCK_DELAY);

        vm.prank(nonOwner);
        vm.expectRevert();
        manager.commitBoostManager();
    }

    function test_CancelBoostManagerProposal_NonOwner_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();
        vm.prank(owner);
        manager.proposeBoostManager(address(boostB));

        vm.prank(nonOwner);
        vm.expectRevert();
        manager.cancelBoostManagerProposal();
    }

    function test_ProposeVaultGaugeVoting_NonOwner_Reverts() public {
        vm.prank(owner);
        manager.armBoostSourceTimelock();

        vm.prank(nonOwner);
        vm.expectRevert();
        manager.proposeVaultGaugeVoting(address(gaugeB));
    }
}
