// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {
    RebalanceTestHarness,
    ScenarioVaultCtx,
    DepositorLedger,
    DepositorSnapshot,
    VaultTimelineSnapshot,
    SynergyCharmMockStrategy
} from "./RebalanceTestHarness.sol";

/// @notice End-to-end vault participant journeys with explicit depositor ROI accounting.
contract CreatorOVaultDepositorE2ETest is RebalanceTestHarness {
    uint256 internal constant PRINCIPAL = 50_000_000e18;
    uint256 internal constant MC_10K = 10_000_000_000;
    uint16 internal constant BAND = 500;

    address internal alice = ALICE;
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function test_e2e_bullHold_launchDepositorVsLateDepositor() external {
        ScenarioVaultCtx memory ctx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        DepositorLedger memory aliceLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);
        DepositorLedger memory bobLedger = _freshLedger(bob);
        VaultTimelineSnapshot memory vaultStart = _snapshotTimeline(ctx);

        // Month 1: +50% MC marks, keeper, Bob joins with 2M.
        _applyRelativeNav(ctx, 13_000, 10_200);
        _keeperRebalance(ctx, BAND, 2);
        bobLedger = _depositTracked(ctx, bobLedger, 2_000_000e18);

        // Month 2: MC ~$25k.
        _applyRelativeNav(ctx, 14_500, 10_500);
        _keeperRebalance(ctx, BAND, 2);

        // Month 3: MC ~$40k.
        _applyRelativeNav(ctx, 16_000, 10_800);
        _keeperRebalance(ctx, BAND, 3);

        VaultTimelineSnapshot memory vaultEnd = _snapshotTimeline(ctx);
        DepositorSnapshot memory aliceSnap = _depositorSnapshot(ctx, aliceLedger);
        DepositorSnapshot memory bobSnap = _depositorSnapshot(ctx, bobLedger);

        _logDepositorE2ESummary("E2E bull: Alice launch holder", vaultStart, vaultEnd, aliceLedger, aliceSnap);
        _logDepositorE2ESummary("E2E bull: Bob late entry", vaultStart, vaultEnd, bobLedger, bobSnap);

        assertGt(vaultEnd.assetsPerShare, vaultStart.assetsPerShare, "vault share price up");
        assertGt(aliceSnap.roiBps, 9000, "Alice: ~2x economic return");
        assertGt(bobSnap.roiBps, 5000, "Bob: strong but late entry");
        assertGt(aliceSnap.roiBps, bobSnap.roiBps, "launch holder beats late depositor");
        assertGt(aliceSnap.totalEconomic, bobSnap.totalEconomic, "Alice total economic > Bob");
    }

    function test_e2e_bearGradualExit_depositorRealizesLoss() external {
        ScenarioVaultCtx memory ctx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        DepositorLedger memory aliceLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);
        VaultTimelineSnapshot memory vaultStart = _snapshotTimeline(ctx);

        // Month 1: MC $7.5k, 5% redeem.
        _applyRelativeNav(ctx, 7_500, 9_500);
        _keeperRebalance(ctx, BAND, 1);
        (aliceLedger,) = _redeemShareBpsTracked(ctx, aliceLedger, 500);
        _keeperRebalance(ctx, BAND, 2);

        // Month 2: MC $5k, 10% redeem.
        _applyRelativeNav(ctx, 5_500, 8_500);
        _keeperRebalance(ctx, BAND, 2);
        (aliceLedger,) = _redeemShareBpsTracked(ctx, aliceLedger, 1_000);
        _keeperRebalance(ctx, BAND, 2);

        // Month 3: MC $2.5k, 15% redeem.
        _applyRelativeNav(ctx, 4_000, 7_500);
        _keeperRebalance(ctx, BAND, 2);
        (aliceLedger,) = _redeemShareBpsTracked(ctx, aliceLedger, 1_500);
        _keeperRebalance(ctx, BAND, 3);

        VaultTimelineSnapshot memory vaultEnd = _snapshotTimeline(ctx);
        DepositorSnapshot memory aliceSnap = _depositorSnapshot(ctx, aliceLedger);

        _logDepositorE2ESummary("E2E bear: Alice gradual exit", vaultStart, vaultEnd, aliceLedger, aliceSnap);

        assertLt(vaultEnd.assetsPerShare, vaultStart.assetsPerShare, "vault share price down");
        assertLt(aliceSnap.roiBps, -6000, "Alice: large loss after exiting into crash");
        assertGt(aliceLedger.totalRedeemed, 7_000_000e18, "Alice: meaningful cash taken out");
        assertGt(aliceSnap.markToMarket, 0, "Alice: still has residual vault claim");
        assertApproxEqAbs(
            aliceSnap.totalEconomic,
            16_000_000e18,
            4_000_000e18,
            "Alice: total economic ~16-20M on 50M deposit after gradual exit"
        );
    }

    function test_e2e_bearHold_noExit_marksToMarketLoss() external {
        ScenarioVaultCtx memory ctx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        DepositorLedger memory aliceLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);

        _applyRelativeNav(ctx, 7_500, 9_500);
        _applyRelativeNav(ctx, 5_500, 8_500);
        _applyRelativeNav(ctx, 4_000, 7_500);

        DepositorSnapshot memory aliceSnap = _depositorSnapshot(ctx, aliceLedger);

        assertLt(aliceSnap.roiBps, -6000, "hold through bear: ~-66% MTM");
        assertEq(aliceLedger.totalRedeemed, 0, "no exits");
        assertApproxEqAbs(aliceSnap.markToMarket, 17_000_000e18, 1_000_000e18, "MTM ~17M on 50M");
    }

    function test_e2e_synergyBackstop_largeExitFills() external {
        (ScenarioVaultCtx memory ctx, SynergyCharmMockStrategy synergyCharm) =
            _deployBackstopScenarioVaultWithDeposit(PRINCIPAL, true);
        synergyCharm.setMaxWithdrawCap(500_000e18);

        DepositorLedger memory aliceLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);

        _applyRelativeNav(ctx, 10_000, 10_000);
        uint256 redeemed;
        (aliceLedger, redeemed) = _redeemShareBpsTracked(ctx, aliceLedger, 2_500);

        DepositorSnapshot memory aliceSnap = _depositorSnapshot(ctx, aliceLedger);

        assertGt(redeemed, 12_000_000e18, "large exit fills");
        assertGt(synergyCharm.backstopVolume(), 0, "Ajna backstop supplied liquidity");
        assertGt(aliceLedger.totalRedeemed, 0, "cash returned to depositor");
        assertLt(aliceSnap.roiBps, 100, "25% exit at flat marks: near flat ROI");
    }

    function test_e2e_fullLifecycle_depositMarkRebalancePartialExit() external {
        ScenarioVaultCtx memory ctx = _deployScenarioVaultWithDeposit(0, 4_500, 4_500, 0);
        DepositorLedger memory aliceLedger = _freshLedger(alice);
        DepositorLedger memory bobLedger = _freshLedger(bob);
        VaultTimelineSnapshot memory vaultStart = _snapshotTimeline(ctx);

        // Launch deposit.
        aliceLedger = _depositTracked(ctx, aliceLedger, PRINCIPAL);
        ctx.vault.forceDeployToStrategies();
        uint256 economicAfterDeploy = _depositorSnapshot(ctx, aliceLedger).totalEconomic;
        assertApproxEqAbs(economicAfterDeploy, PRINCIPAL, 1e18, "deposit 1:1 economic value");

        // Rally + keeper rebalance.
        _applyRelativeNav(ctx, 14_000, 11_000);
        _keeperRebalance(ctx, BAND, 3);
        DepositorSnapshot memory aliceMid = _depositorSnapshot(ctx, aliceLedger);
        assertGt(aliceMid.roiBps, 2000, "mid-rally: positive MTM");

        // Alice takes 10% profit off the table; Bob enters mid-cycle.
        (aliceLedger,) = _redeemShareBpsTracked(ctx, aliceLedger, 1_000);
        bobLedger = _depositTracked(ctx, bobLedger, 5_000_000e18);

        // Pullback marks.
        _applyRelativeNav(ctx, 9_000, 9_500);
        _keeperRebalance(ctx, BAND, 2);

        // Carol tries a small exit (new depositor with no shares — should be no-op).
        DepositorLedger memory carolLedger = _freshLedger(carol);
        uint256 carolOut;
        (carolLedger, carolOut) = _redeemShareBpsTracked(ctx, carolLedger, 5_000);
        assertEq(carolOut, 0, "non-depositor redeem is zero");

        VaultTimelineSnapshot memory vaultEnd = _snapshotTimeline(ctx);
        DepositorSnapshot memory aliceEnd = _depositorSnapshot(ctx, aliceLedger);
        DepositorSnapshot memory bobEnd = _depositorSnapshot(ctx, bobLedger);

        _logDepositorE2ESummary("E2E lifecycle: Alice", vaultStart, vaultEnd, aliceLedger, aliceEnd);
        _logDepositorE2ESummary("E2E lifecycle: Bob", vaultStart, vaultEnd, bobLedger, bobEnd);

        assertGt(aliceLedger.totalRedeemed, 0, "Alice realized some gains");
        assertGt(aliceEnd.totalEconomic, PRINCIPAL, "Alice still net positive after pullback");
        assertLt(bobEnd.roiBps, aliceEnd.roiBps, "Bob entered higher; lower ROI than Alice");
        assertGt(bobLedger.totalDeposited, 0, "Bob deposited");
        assertEq(carolLedger.totalRedeemed, 0, "Carol no exit");
    }

    function test_e2e_whaleDeposit_doesNotInstantlyProfitExistingHolder() external {
        ScenarioVaultCtx memory ctx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        DepositorLedger memory aliceLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);

        DepositorSnapshot memory beforeWhale = _depositorSnapshot(ctx, aliceLedger);
        // Second depositor joins after baseline deploy (same timing as growth sim month-1 inflow).
        _applyRelativeNav(ctx, 10_000, 10_000);
        _depositTracked(ctx, _freshLedger(carol), 5_000_000e18);
        DepositorSnapshot memory afterWhale = _depositorSnapshot(ctx, aliceLedger);

        assertApproxEqAbs(afterWhale.roiBps, beforeWhale.roiBps, 100, "whale deposit: no free ROI for incumbents");
        assertGt(_snapshotTimeline(ctx).totalAssets, PRINCIPAL + 4_000_000e18, "TVL includes whale");
    }

    function test_e2e_charmOnlyBackstopVsDualQueue_bothFillLargeExit() external {
        (ScenarioVaultCtx memory directCtx, SynergyCharmMockStrategy directCharm) =
            _deployCharmOnlyBackstopVaultWithDeposit(PRINCIPAL, true, 5_000);
        directCharm.setMaxWithdrawCap(500_000e18);
        DepositorLedger memory directLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);
        _applyRelativeNav(directCtx, 10_000, 10_000);
        uint256 directOut;
        (directLedger, directOut) = _redeemShareBpsTracked(directCtx, directLedger, 2_500);

        ScenarioVaultCtx memory queueCtx = _deployScenarioVaultWithDeposit(0, 4_500, 4_500, 0);
        queueCtx.charm.setMaxWithdrawCap(500_000e18);
        DepositorLedger memory queueLedger = _depositTracked(queueCtx, _freshLedger(bob), PRINCIPAL);
        _applyRelativeNav(queueCtx, 10_000, 10_000);
        uint256 queueOut;
        (queueLedger, queueOut) = _redeemShareBpsTracked(queueCtx, queueLedger, 2_500);

        assertGt(directCharm.backstopVolume(), 0, "direct path uses backstop");
        assertGt(directOut, 0, "direct: exit fills");
        assertGt(queueOut, 0, "queue: exit fills");
        assertGe(queueOut, directOut, "dual sleeve queue path fills at least as much as charm-only");
    }

    function test_e2e_invariant_depositorEconomicNeverExceedsVault() external {
        ScenarioVaultCtx memory ctx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        DepositorLedger memory aliceLedger = _ledgerFromPrefundedDeposit(alice, PRINCIPAL);
        DepositorLedger memory bobLedger = _freshLedger(bob);

        _applyRelativeNav(ctx, 12_000, 10_500);
        _keeperRebalance(ctx, BAND, 2);
        bobLedger = _depositTracked(ctx, bobLedger, 3_000_000e18);
        (aliceLedger,) = _redeemShareBpsTracked(ctx, aliceLedger, 800);
        _applyRelativeNav(ctx, 8_000, 9_000);
        _keeperRebalance(ctx, BAND, 2);
        (bobLedger,) = _redeemShareBpsTracked(ctx, bobLedger, 500);

        DepositorSnapshot memory aliceSnap = _depositorSnapshot(ctx, aliceLedger);
        DepositorSnapshot memory bobSnap = _depositorSnapshot(ctx, bobLedger);
        uint256 vaultAssets = ctx.vault.totalAssets();

        assertLe(aliceSnap.totalEconomic, PRINCIPAL + 3_000_000e18, "Alice economic bounded by net inflows");
        assertLe(bobSnap.totalEconomic, 3_000_000e18 + 1e18, "Bob economic bounded by deposit");
        assertLe(
            aliceSnap.markToMarket + bobSnap.markToMarket + aliceLedger.totalRedeemed + bobLedger.totalRedeemed,
            vaultAssets + aliceLedger.totalRedeemed + bobLedger.totalRedeemed,
            "participants cannot exceed vault + prior withdrawals"
        );
    }
}
