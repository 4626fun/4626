// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ive4626, ve4626} from "@4626/shared/governance/ve4626.sol";
import {ve4626BoostManager} from "@4626/shared/governance/ve4626BoostManager.sol";
import {ve4626GaugeVoting} from "@4626/shared/governance/ve4626GaugeVoting.sol";
import {ve4626Utility} from "@4626/shared/governance/ve4626Utility.sol";
import {ve4626UtilityToken} from "@4626/shared/governance/ve4626UtilityToken.sol";

contract MockWrappedShare is ERC20 {
    constructor() ERC20("Wrapped Share", "wSHR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Final stack: dual-decay ve■4626 + ve4626Utility (ve33 / veLottery).
contract ve4626RightsSplitAndDualDecayTest is Test {
    ve4626 internal veToken;
    MockWrappedShare internal wrapped;
    ve4626Utility internal utility;
    ve4626BoostManager internal boostMgr;
    ve4626GaugeVoting internal gauges;

    address internal user = makeAddr("locker");
    address internal user2 = makeAddr("locker2");
    uint256 internal constant LOCK_AMOUNT = 100e18;
    uint256 internal constant WEEK = 7 days;

    function setUp() public {
        wrapped = new MockWrappedShare();
        veToken = new ve4626("ve\u25A04626", "ve4626", address(wrapped), address(this));
        utility = new ve4626Utility(address(veToken), address(this));
        boostMgr = new ve4626BoostManager(address(veToken), address(this));
        gauges = new ve4626GaugeVoting(address(veToken), address(this));

        // P1: wire utility so consumers use sync + effective balances (decay-safe).
        boostMgr.setUtility(address(utility));
        gauges.setUtility(address(utility));
        utility.setGaugeVoting(address(gauges));
        veToken.setBoostManager(address(boostMgr));

        wrapped.mint(user, 1_000e18);
        wrapped.mint(user2, 1_000e18);

        // Put MAX_LOCK_DURATION on a week boundary so max-lock utility tests retain
        // their exact LOCK_AMOUNT capacity under week-aligned expiry.
        uint256 target = block.timestamp + 14 days;
        uint256 maxDuration = veToken.MAX_LOCK_DURATION();
        vm.warp(((target + maxDuration + WEEK - 1) / WEEK) * WEEK - maxDuration);
    }

    function _lockMax(address who, uint256 amount) internal {
        vm.startPrank(who);
        wrapped.approve(address(veToken), amount);
        veToken.lock(address(wrapped), amount, veToken.MAX_LOCK_DURATION());
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Dual-decay
    // -------------------------------------------------------------------------

    function test_dualDecay_totalMatchesUserPower_atLock() public {
        _lockMax(user, LOCK_AMOUNT);
        assertEq(veToken.getVotingPower(user), LOCK_AMOUNT);
        assertApproxEqAbs(veToken.getTotalVotingPower(), LOCK_AMOUNT, 1e15);
    }

    function test_dualDecay_totalDecaysWithTime() public {
        _lockMax(user, LOCK_AMOUNT);
        uint256 startTotal = veToken.getTotalVotingPower();
        vm.warp(block.timestamp + 365 days);
        assertApproxEqAbs(veToken.getVotingPower(user), veToken.getTotalVotingPower(), 1e15);
        assertLt(veToken.getTotalVotingPower(), startTotal);
        assertApproxEqRel(veToken.getTotalVotingPower(), (LOCK_AMOUNT * 3) / 4, 0.02e18);
    }

    function test_dualDecay_twoUsers_shareCoherent() public {
        _lockMax(user, LOCK_AMOUNT);
        _lockMax(user2, LOCK_AMOUNT);
        assertApproxEqAbs(veToken.getTotalVotingPower(), 2 * LOCK_AMOUNT, 2e15);
        vm.warp(block.timestamp + 180 days);
        assertApproxEqAbs(
            veToken.getVotingPower(user) + veToken.getVotingPower(user2),
            veToken.getTotalVotingPower(),
            2e15
        );
    }

    function test_dualDecay_midWeekRequest_isAligned_andGlobalMatchesUserAroundExpiry() public {
        uint256 amount = veToken.MAX_LOCK_DURATION(); // slope is exactly 1 wei/second
        uint256 requestedDuration = 30 days; // requested end is deliberately mid-week

        vm.startPrank(user);
        wrapped.approve(address(veToken), amount);
        veToken.lock(address(wrapped), amount, requestedDuration);
        vm.stopPrank();
        vm.startPrank(user2);
        wrapped.approve(address(veToken), amount);
        veToken.lock(address(wrapped), amount, 45 days);
        vm.stopPrank();

        uint256 acceptedEnd = veToken.getLock(user).end;
        assertEq(acceptedEnd % WEEK, 0, "accepted end must match slope schedule");
        assertLt(acceptedEnd, block.timestamp + requestedDuration, "must floor, not ceil");

        vm.warp(acceptedEnd - 1);
        assertEq(
            veToken.getTotalVotingPower(),
            veToken.getVotingPower(user) + veToken.getVotingPower(user2),
            "before expiry"
        );
        vm.warp(acceptedEnd);
        assertEq(
            veToken.getTotalVotingPower(),
            veToken.getVotingPower(user) + veToken.getVotingPower(user2),
            "at expiry"
        );
        vm.warp(acceptedEnd + 3 days);
        assertEq(
            veToken.getTotalVotingPower(),
            veToken.getVotingPower(user) + veToken.getVotingPower(user2),
            "after expiry"
        );
    }

    // -------------------------------------------------------------------------
    // Utility: ve33 / veLottery
    // -------------------------------------------------------------------------

    function test_utility_ve33_notVeLottery_byDefault() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimAllOutstanding();
        assertEq(utility.ve33Of(user), LOCK_AMOUNT);
        assertEq(utility.veLotteryOf(user), 0);
        assertEq(utility.freeCapacityOf(user), 0);
    }

    function test_utility_veLottery_optIn() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.startPrank(user);
        utility.claimVe33(LOCK_AMOUNT / 2);
        utility.claimVeLottery(LOCK_AMOUNT / 2);
        vm.stopPrank();
        assertEq(utility.ve33Of(user), LOCK_AMOUNT / 2);
        assertEq(utility.veLotteryOf(user), LOCK_AMOUNT / 2);
    }

    function test_utilityToken_usesVe33AndVeLotteryMetadata() public view {
        assertEq(utility.ve33().name(), "ve\u25A04626 33");
        assertEq(utility.ve33().symbol(), "ve33");
        assertEq(utility.veLottery().name(), "ve\u25A04626 Lottery");
        assertEq(utility.veLottery().symbol(), "veLottery");
    }

    function test_utility_cannotOverClaim() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(LOCK_AMOUNT);
        vm.prank(user);
        vm.expectRevert(ve4626Utility.InsufficientCapacity.selector);
        utility.claimVeLottery(1);
    }

    function test_utilityToken_nonTransferable() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(1e18);
        ve4626UtilityToken v = utility.ve33();
        vm.prank(user);
        vm.expectRevert(ve4626UtilityToken.TransfersDisabled.selector);
        v.transfer(user2, 1);
    }

    function test_utility_sync_burnsVeLotteryThenVe33_onDecay() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.startPrank(user);
        utility.claimVe33(LOCK_AMOUNT / 2);
        utility.claimVeLottery(LOCK_AMOUNT / 2);
        vm.stopPrank();

        // ~1y decay → capacity ≈ 75e18; claimed = 100e18 → excess comes from veLottery first
        vm.warp(block.timestamp + 365 days);
        uint256 cap = utility.capacityOf(user);
        assertLt(cap, LOCK_AMOUNT);

        (uint256 burnedVe33, uint256 burnedVeLottery) = utility.sync(user);
        assertEq(burnedVe33, 0, "veLottery absorbs excess first");
        assertGt(burnedVeLottery, 0);
        assertEq(utility.ve33Of(user) + utility.veLotteryOf(user), cap);
        assertEq(utility.freeCapacityOf(user), 0);
    }

    function test_utility_sync_burnsVe33_whenVeLotteryInsufficient() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(LOCK_AMOUNT); // all ve33, no veLottery

        vm.warp(block.timestamp + 2 * 365 days); // ~half power
        uint256 cap = utility.capacityOf(user);
        assertApproxEqRel(cap, LOCK_AMOUNT / 2, 0.02e18);

        (uint256 burnedVe33, uint256 burnedVeLottery) = utility.sync(user);
        assertEq(burnedVeLottery, 0);
        assertGt(burnedVe33, 0);
        assertEq(utility.ve33Of(user), cap);
    }

    /// @notice P1: preview/effective match post-sync balances without requiring a state write first.
    function test_utility_preview_effective_match_postSync() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.startPrank(user);
        utility.claimVe33(LOCK_AMOUNT / 2);
        utility.claimVeLottery(LOCK_AMOUNT / 2);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        (uint256 prevV, uint256 prevC) = utility.previewUtilities(user);
        assertEq(utility.effectiveVe33Of(user), prevV);
        assertEq(utility.effectiveVeLotteryOf(user), prevC);

        // Raw balances still stale before sync
        assertGt(utility.ve33Of(user) + utility.veLotteryOf(user), prevV + prevC);

        utility.sync(user);
        assertEq(utility.ve33Of(user), prevV);
        assertEq(utility.veLotteryOf(user), prevC);
        assertEq(utility.effectiveVe33Of(user), prevV);
        assertEq(utility.effectiveVeLotteryOf(user), prevC);
    }

    // -------------------------------------------------------------------------
    // Consumers
    // -------------------------------------------------------------------------

    function test_boostEligibilityCheckpoint_enrollsPreWiringLock() public {
        ve4626 preWiringVe = new ve4626("ve\u25A04626", "ve4626", address(wrapped), address(this));
        ve4626BoostManager preWiringBoost = new ve4626BoostManager(address(preWiringVe), address(this));
        preWiringBoost.setUtility(address(new ve4626Utility(address(preWiringVe), address(this))));

        wrapped.mint(user, LOCK_AMOUNT);
        vm.startPrank(user);
        wrapped.approve(address(preWiringVe), LOCK_AMOUNT);
        preWiringVe.lock(address(wrapped), LOCK_AMOUNT, preWiringVe.MAX_LOCK_DURATION());
        vm.expectRevert(Ive4626.BoostManagerNotConfigured.selector);
        preWiringVe.checkpointBoostEligibility();
        vm.stopPrank();

        preWiringVe.setBoostManager(address(preWiringBoost));
        vm.prank(user);
        preWiringVe.checkpointBoostEligibility();
        assertEq(preWiringBoost.lastBalanceUpdateBlock(user), block.number);
    }

    function test_boostEligibilityCheckpoint_rejectsMissingLock() public {
        vm.prank(user);
        vm.expectRevert(Ive4626.NoExistingLock.selector);
        veToken.checkpointBoostEligibility();
    }

    function test_boostManager_usesVeLottery() public {
        _lockMax(user, LOCK_AMOUNT);
        // Past flash-hold gate (lock updates lastBalanceUpdateBlock)
        vm.roll(block.number + 302_401);
        // No veLottery claimed → neutral 1×.
        assertEq(boostMgr.calculateBoost(user), 10_000);
        vm.prank(user);
        utility.claimVeLottery(LOCK_AMOUNT);
        // Eligible veLottery → full 2.5× attainable.
        assertEq(boostMgr.calculateBoost(user), 25_000);
    }

    /// @notice ForPosition: ve share vs LP share of creator pool; cap at 2.5×.
    function test_boostManager_curvePosition_matchesWorkingBalance() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVeLottery(LOCK_AMOUNT);
        vm.roll(block.number + 302_401);

        // Sole veLottery holder: ve/Ve = 1. l/L = 1% → full 2.5×.
        uint256 l = 1e18;
        uint256 L = 100e18;
        assertEq(boostMgr.calculateBoostForPosition(user, l, l, L), 25_000);

        // No veLottery → neutral 1×.
        assertEq(boostMgr.calculateBoostForPosition(user2, l, l, L), 10_000);
    }

    /// @notice P1: effective veLottery used inside ve term after dual-decay.
    function test_boostManager_usesEffectiveVeLottery_afterDecay() public {
        _lockMax(user, LOCK_AMOUNT);
        _lockMax(user2, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVeLottery(LOCK_AMOUNT);
        vm.prank(user2);
        utility.claimVeLottery(LOCK_AMOUNT);

        // After ~1y both decay; raw veLottery balances remain 100e18 each until sync.
        vm.warp(block.timestamp + 365 days);
        vm.roll(block.number + 302_401);

        uint256 eff = utility.effectiveVeLotteryOf(user);
        assertLt(eff, LOCK_AMOUNT);
        assertEq(utility.veLotteryOf(user), LOCK_AMOUNT, "raw still stale");

        uint256 l = 1e18;
        uint256 Lpool = 10e18; // l/L = 10%
        uint256 boost = boostMgr.calculateBoostForPosition(user, l, l, Lpool);
        assertGe(boost, 10_000);
        assertLe(boost, 25_000);
        assertGt(boost, 10_000, "ve term should lift above tokenless");
    }

    function test_boostManager_denominatorUsesLiveTotalVePower() public {
        _lockMax(user, LOCK_AMOUNT);
        _lockMax(user2, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVeLottery(LOCK_AMOUNT);
        vm.roll(block.number + 302_401);

        // user veLottery / total live ve = 50%. With l/L = 60%:
        // working = 0.4*60 + 0.6*100*0.5 = 54; boost = 54/24 = 2.25x.
        // A raw totalVeLottery denominator would incorrectly treat the user as 100%.
        assertEq(boostMgr.calculateBoostForPosition(user, 60e18, 60e18, 100e18), 22_500);
    }

    function test_boostManager_getTotalProbabilityBoost_alwaysZero() public view {
        assertEq(boostMgr.getTotalProbabilityBoost(user), 0);
    }

    function test_gaugeVoting_requiresVote_whenConfigured() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.warp(block.timestamp + 8 days);

        address vault = makeAddr("vault");
        gauges.setVaultWhitelist(vault, true);

        address[] memory vs = new address[](1);
        vs[0] = vault;
        uint256[] memory ws = new uint256[](1);
        ws[0] = 1;

        vm.prank(user);
        vm.expectRevert(ve4626GaugeVoting.NoVotingPower.selector);
        gauges.vote(vs, ws);

        uint256 free = utility.freeCapacityOf(user);
        vm.prank(user);
        utility.claimVe33(free);

        vm.prank(user);
        gauges.vote(vs, ws);
    }

    /// @notice P1: vote() syncs so gauge weight uses post-decay effective ve33, not stale token balance.
    function test_gaugeVoting_vote_syncs_beforeWeight() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(LOCK_AMOUNT);

        // Age past LockTooRecent (1 epoch)
        vm.warp(block.timestamp + 8 days);

        // Decay capacity below claimed vote
        vm.warp(block.timestamp + 2 * 365 days);
        uint256 cap = utility.capacityOf(user);
        assertLt(cap, LOCK_AMOUNT);
        assertEq(utility.ve33Of(user), LOCK_AMOUNT, "raw still stale");
        assertEq(utility.effectiveVe33Of(user), cap);

        address vault = makeAddr("vault");
        gauges.setVaultWhitelist(vault, true);

        address[] memory vs = new address[](1);
        vs[0] = vault;
        uint256[] memory ws = new uint256[](1);
        ws[0] = 1;

        vm.prank(user);
        gauges.vote(vs, ws);

        // Sync ran inside vote — storage now matches effective
        assertEq(utility.ve33Of(user), cap);
        assertEq(utility.ve33Of(user), utility.effectiveVe33Of(user));
    }

    function test_gaugeVoting_utilityWeight_cappedAtEpochEndPower() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(LOCK_AMOUNT);
        vm.warp(block.timestamp + 8 days);

        address vault = makeAddr("utility-cap-vault");
        gauges.setVaultWhitelist(vault, true);
        address[] memory vs = new address[](1);
        vs[0] = vault;
        uint256[] memory ws = new uint256[](1);
        ws[0] = 1;

        uint256 epoch = gauges.currentEpoch();
        uint256 projected = veToken.votingPowerAt(user, gauges.epochEndTime(epoch));
        assertGt(utility.effectiveVe33Of(user), projected);
        vm.prank(user);
        gauges.vote(vs, ws);
        assertEq(gauges.getUserVoteWeightAtEpoch(epoch, user, vault), projected);
    }

    function test_gaugeVoting_claimedUtilityBelowEpochCap_remainsClaimLimited() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(LOCK_AMOUNT / 2);
        vm.warp(block.timestamp + 8 days);

        address vault = makeAddr("claimed-cap-vault");
        gauges.setVaultWhitelist(vault, true);
        address[] memory vs = new address[](1);
        vs[0] = vault;
        uint256[] memory ws = new uint256[](1);
        ws[0] = 1;

        uint256 epoch = gauges.currentEpoch();
        assertGt(veToken.votingPowerAt(user, gauges.epochEndTime(epoch)), LOCK_AMOUNT / 2);
        vm.prank(user);
        gauges.vote(vs, ws);
        assertEq(gauges.getUserVoteWeightAtEpoch(epoch, user, vault), LOCK_AMOUNT / 2);
    }

    function test_gaugeVoting_withoutUtility_revertsInsteadOfUsingRawVe33() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.prank(user);
        utility.claimVe33(LOCK_AMOUNT);
        gauges.setUtility(address(0));
        vm.warp(block.timestamp + 8 days);

        address vault = makeAddr("raw-token-cap-vault");
        gauges.setVaultWhitelist(vault, true);
        address[] memory vs = new address[](1);
        vs[0] = vault;
        uint256[] memory ws = new uint256[](1);
        ws[0] = 1;

        vm.prank(user);
        vm.expectRevert(ve4626GaugeVoting.UtilityNotConfigured.selector);
        gauges.vote(vs, ws);
    }

    function test_gaugeVoting_freezeWindow() public {
        _lockMax(user, LOCK_AMOUNT);
        vm.warp(block.timestamp + 8 days);
        uint256 free = utility.freeCapacityOf(user);
        vm.prank(user);
        utility.claimVe33(free);

        address vault = makeAddr("vault");
        gauges.setVaultWhitelist(vault, true);

        uint256 epochEnd = gauges.epochEndTime(gauges.currentEpoch());
        vm.warp(epochEnd - 30 minutes);

        address[] memory vs = new address[](1);
        vs[0] = vault;
        uint256[] memory ws = new uint256[](1);
        ws[0] = 1;

        vm.prank(user);
        vm.expectRevert(ve4626GaugeVoting.VoteFreezeWindow.selector);
        gauges.vote(vs, ws);
    }
}
