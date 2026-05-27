// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {RebalanceTestHarness, ScenarioVaultCtx, VaultTimelineSnapshot} from "./RebalanceTestHarness.sol";

/// @notice Runs the user-facing 3-month growth / sell-off narratives as executable simulations.
/// @dev MC $10k on 1B supply => marketCapUsd6 = 10_000_000_000 (micro-dollars).
contract CreatorOVaultTimelineSimTest is RebalanceTestHarness {
    uint256 internal constant PRINCIPAL_DEPOSIT = 50_000_000e18;
    uint256 internal constant INITIAL_MC_USD6 = 10_000_000_000; // $10,000.000000
    uint16 internal constant KEEPER_BAND_BPS = 500;

    address internal bob = makeAddr("bob");

    function test_simulation_threeMonthPositiveGrowth() external {
        ScenarioVaultCtx memory ctx =
            _deployScenarioVaultWithDeposit(PRINCIPAL_DEPOSIT, 4_500, 4_500, 0);

        console2.log("=== POSITIVE GROWTH SIM (50M deposit, MC $10k -> $40k) ===");

        VaultTimelineSnapshot memory snap0 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("T0 launch+deploy (year 1 complete)", INITIAL_MC_USD6, snap0);

        // Month 1: MC ~$15k (+50%). Charm LP marks up faster than Ajna lending sleeve.
        uint256 mc1 = 15_000_000_000;
        _applyRelativeNav(ctx, 13_000, 10_200);
        VaultTimelineSnapshot memory pre1 = _snapshotTimeline(ctx);
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 2);
        _depositTokens(ctx, bob, 2_000_000e18);
        VaultTimelineSnapshot memory snap1 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("Month 1 after +50% MC, keeper x2, +2M deposit", mc1, snap1);

        assertGt(snap1.totalAssets, snap0.totalAssets, "growth: TVL should rise with marks");
        assertLe(snap1.maxDriftBps, pre1.maxDriftBps, "growth M1: keeper should not increase drift");

        // Month 2: MC ~$25k. Continued bid; Charm still leads.
        uint256 mc2 = 25_000_000_000;
        _applyRelativeNav(ctx, 14_500, 10_500);
        VaultTimelineSnapshot memory pre2 = _snapshotTimeline(ctx);
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 2);
        VaultTimelineSnapshot memory snap2 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("Month 2 after MC ~$25k, keeper x2", mc2, snap2);

        assertGt(snap2.totalAssets, snap1.totalAssets, "growth: TVL continues up");
        assertLe(snap2.maxDriftBps, pre2.maxDriftBps, "growth M2: drift shrinks on rebalance");

        // Month 3: MC ~$40k (4x from start). Final convergence pass.
        uint256 mc3 = 40_000_000_000;
        _applyRelativeNav(ctx, 16_000, 10_800);
        VaultTimelineSnapshot memory pre3 = _snapshotTimeline(ctx);
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 3);
        VaultTimelineSnapshot memory snap3 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("Month 3 after MC ~$40k, keeper x3", mc3, snap3);

        assertGt(snap3.totalAssets, snap2.totalAssets, "growth: TVL peaks into month 3");
        assertLe(snap3.maxDriftBps, pre3.maxDriftBps, "growth M3: drift shrinks");
        assertApproxEqAbs(snap3.charmNav, snap3.charmTarget, 1e21, "growth end: charm near target");
        assertApproxEqAbs(snap3.ajnaNav, snap3.ajnaTarget, 1e21, "growth end: ajna near target");
        assertGt(snap3.assetsPerShare, snap0.assetsPerShare, "growth: share price up");

        console2.log("");
        console2.log("Growth summary: TVL %s -> %s tokens", snap0.totalAssets / 1e18, snap3.totalAssets / 1e18);
        console2.log(
            "Growth summary: USD est $%s -> $%s",
            _usdFromMc(INITIAL_MC_USD6, snap0.totalAssets) / 1e6,
            _usdFromMc(mc3, snap3.totalAssets) / 1e6
        );
    }

    function test_simulation_threeMonthHeavySelling() external {
        ScenarioVaultCtx memory ctx =
            _deployScenarioVaultWithDeposit(PRINCIPAL_DEPOSIT, 4_500, 4_500, 0);

        console2.log("=== HEAVY SELL-OFF SIM (50M deposit, MC $10k -> $2.5k) ===");

        VaultTimelineSnapshot memory snap0 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("T0 launch+deploy (year 1 complete)", INITIAL_MC_USD6, snap0);

        uint256 charmWithdrawBefore = ctx.charm.withdrawCalls();

        // Month 1: MC ~$7.5k (-25%). Early redemptions.
        uint256 mc1 = 7_500_000_000;
        _applyRelativeNav(ctx, 7_500, 9_500);
        VaultTimelineSnapshot memory pre1 = _snapshotTimeline(ctx);
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 1);
        uint256 redeemed1 = _redeemShareBps(ctx, ALICE, 500); // 5% of Alice shares
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 2);
        VaultTimelineSnapshot memory snap1 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("Month 1 MC ~$7.5k, 5% redeem, keeper x3", mc1, snap1);

        assertLt(snap1.totalAssets, snap0.totalAssets, "sell M1: TVL down vs marks+redeem");
        assertGt(redeemed1, 0, "sell M1: redemption executed");
        assertLe(snap1.maxDriftBps, pre1.maxDriftBps + 500, "sell M1: drift controlled after keeper");

        // Month 2: MC ~$5k (-50% from start). Deeper Charm impairment.
        uint256 mc2 = 5_000_000_000;
        _applyRelativeNav(ctx, 5_500, 8_500);
        VaultTimelineSnapshot memory pre2 = _snapshotTimeline(ctx);
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 2);
        uint256 redeemed2 = _redeemShareBps(ctx, ALICE, 1_000); // 10%
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 2);
        VaultTimelineSnapshot memory snap2 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("Month 2 MC ~$5k, 10% redeem, keeper x4", mc2, snap2);

        assertLt(snap2.totalAssets, snap1.totalAssets, "sell M2: TVL continues down");
        assertGt(redeemed2, 0, "sell M2: redemption executed");

        // Month 3: MC ~$2.5k (-75%). Capitulation redemptions.
        uint256 mc3 = 2_500_000_000;
        _applyRelativeNav(ctx, 4_000, 7_500);
        VaultTimelineSnapshot memory pre3 = _snapshotTimeline(ctx);
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 2);
        uint256 redeemed3 = _redeemShareBps(ctx, ALICE, 1_500); // 15%
        _keeperRebalance(ctx, KEEPER_BAND_BPS, 3);
        VaultTimelineSnapshot memory snap3 = _snapshotTimeline(ctx);
        _logTimelineSnapshot("Month 3 MC ~$2.5k, 15% redeem, keeper x5", mc3, snap3);

        assertLt(snap3.totalAssets, snap2.totalAssets, "sell M3: TVL lowest");
        assertGt(redeemed3, 0, "sell M3: redemption executed");
        assertLt(snap3.assetsPerShare, snap0.assetsPerShare, "sell: share price down");
        assertGt(ctx.charm.withdrawCalls(), charmWithdrawBefore, "sell: charm hit first on exits");

        console2.log("");
        console2.log("Sell-off summary: TVL %s -> %s tokens", snap0.totalAssets / 1e18, snap3.totalAssets / 1e18);
        console2.log(
            "Sell-off summary: USD est $%s -> $%s",
            _usdFromMc(INITIAL_MC_USD6, snap0.totalAssets) / 1e6,
            _usdFromMc(mc3, snap3.totalAssets) / 1e6
        );
        console2.log(
            "Redeemed to users (tokens): M1=%s M2=%s M3=%s",
            redeemed1 / 1e18,
            redeemed2 / 1e18,
            redeemed3 / 1e18
        );
        console2.log("Charm withdraw calls (queue order proxy): %s", ctx.charm.withdrawCalls());
    }
}
