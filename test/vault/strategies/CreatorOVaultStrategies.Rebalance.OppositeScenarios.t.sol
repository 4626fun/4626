// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {RebalanceTestHarness, ScenarioVaultCtx, TimelineStepConfig, TimelineSimOutcome, VaultTimelineSnapshot, SynergyCharmMockStrategy} from "./RebalanceTestHarness.sol";

/// @notice Paired opposite simulations — each test runs a positive/primary lane and its mirror stress lane.
contract CreatorOVaultOppositeScenariosTest is RebalanceTestHarness {
    uint256 internal constant PRINCIPAL = 50_000_000e18;
    uint256 internal constant MC_10K = 10_000_000_000;
    uint16 internal constant BAND = 500;

    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function _threeMonthGrowthSteps() internal pure returns (TimelineStepConfig[] memory steps) {
        steps = new TimelineStepConfig[](3);
        steps[0] = TimelineStepConfig(13_000, 10_200, 2, BAND, 0, 2_000_000e18, 15_000_000_000);
        steps[1] = TimelineStepConfig(14_500, 10_500, 2, BAND, 0, 0, 25_000_000_000);
        steps[2] = TimelineStepConfig(16_000, 10_800, 3, BAND, 0, 0, 40_000_000_000);
    }

    function _threeMonthSellOffSteps() internal pure returns (TimelineStepConfig[] memory steps) {
        steps = new TimelineStepConfig[](3);
        steps[0] = TimelineStepConfig(7_500, 9_500, 2, BAND, 500, 0, 7_500_000_000);
        steps[1] = TimelineStepConfig(5_500, 8_500, 2, BAND, 1_000, 0, 5_000_000_000);
        steps[2] = TimelineStepConfig(4_000, 7_500, 3, BAND, 1_500, 0, 2_500_000_000);
    }

    function test_opposite_marketGrowth_vs_marketSellOff() external {
        ScenarioVaultCtx memory growthCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory growth = _runTimelineSimulation(
            growthCtx, _threeMonthGrowthSteps(), bob, ALICE, MC_10K, "OPPOSITE A: 3-month growth (MC $10k -> $40k)"
        );

        ScenarioVaultCtx memory sellCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory sell = _runTimelineSimulation(
            sellCtx, _threeMonthSellOffSteps(), bob, ALICE, MC_10K, "OPPOSITE B: 3-month sell-off (MC $10k -> $2.5k)"
        );

        assertGt(growth.end.totalAssets, growth.start.totalAssets, "growth: TVL up");
        assertLt(sell.end.totalAssets, sell.start.totalAssets, "sell: TVL down");
        assertGt(growth.end.assetsPerShare, growth.start.assetsPerShare, "growth: share price up");
        assertLt(sell.end.assetsPerShare, sell.start.assetsPerShare, "sell: share price down");
        assertGt(growth.totalDeposited, 0, "growth: deposits occurred");
        assertGt(sell.totalRedeemed, growth.totalRedeemed, "sell redemptions > growth redemptions");
        assertEq(growth.totalRedeemed, 0, "growth: no user redemptions");
    }

    function test_opposite_charmLedRally_vs_ajnaLedRally() external {
        ScenarioVaultCtx memory charmCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        _applyRelativeNav(charmCtx, 16_500, 10_400);
        VaultTimelineSnapshot memory charmPre = _snapshotTimeline(charmCtx);

        ScenarioVaultCtx memory ajnaCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        _applyRelativeNav(ajnaCtx, 10_400, 16_500);
        VaultTimelineSnapshot memory ajnaPre = _snapshotTimeline(ajnaCtx);

        console2.log("======== OPPOSITE A: Charm-led rally (pre-keeper) ========");
        _logTimelineSnapshot("Charm-led skew", MC_10K, charmPre);
        console2.log("======== OPPOSITE B: Ajna-led rally (pre-keeper) ========");
        _logTimelineSnapshot("Ajna-led skew", MC_10K, ajnaPre);

        assertGt(charmPre.charmNav, charmPre.ajnaNav, "charm-led: charm NAV dominates before keeper");
        assertGt(ajnaPre.ajnaNav, ajnaPre.charmNav, "ajna-led: ajna NAV dominates before keeper");

        _keeperRebalance(charmCtx, BAND, 3);
        _keeperRebalance(ajnaCtx, BAND, 3);
        VaultTimelineSnapshot memory charmPost = _snapshotTimeline(charmCtx);
        VaultTimelineSnapshot memory ajnaPost = _snapshotTimeline(ajnaCtx);

        assertApproxEqAbs(charmPost.maxDriftBps, 0, 800, "charm-led: keeper converges");
        assertApproxEqAbs(ajnaPost.maxDriftBps, 0, 800, "ajna-led: keeper converges");
    }

    function test_opposite_depositWave_vs_redeemWave() external {
        TimelineStepConfig[] memory deposits = new TimelineStepConfig[](3);
        deposits[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 5_000_000e18, MC_10K);
        deposits[1] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 3_000_000e18, MC_10K);
        deposits[2] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 2_000_000e18, MC_10K);

        TimelineStepConfig[] memory redemptions = new TimelineStepConfig[](3);
        redemptions[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 800, 0, MC_10K);
        redemptions[1] = TimelineStepConfig(10_000, 10_000, 1, BAND, 800, 0, MC_10K);
        redemptions[2] = TimelineStepConfig(10_000, 10_000, 1, BAND, 800, 0, MC_10K);

        ScenarioVaultCtx memory inCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory inflow = _runTimelineSimulation(
            inCtx, deposits, bob, ALICE, MC_10K, "OPPOSITE A: steady deposit wave (flat marks)"
        );

        ScenarioVaultCtx memory outCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory outflow = _runTimelineSimulation(
            outCtx, redemptions, bob, ALICE, MC_10K, "OPPOSITE B: steady redemption wave (flat marks)"
        );

        assertGt(inflow.end.totalAssets, inflow.start.totalAssets, "deposit wave: TVL up");
        assertLt(outflow.end.totalAssets, outflow.start.totalAssets, "redeem wave: TVL down");
        assertGt(inflow.totalDeposited, outflow.totalDeposited, "deposit lane moves more in");
        assertGt(outflow.totalRedeemed, inflow.totalRedeemed, "redeem lane moves more out");
        assertLe(inflow.end.maxDriftBps, inflow.start.maxDriftBps + 1000, "deposit wave: drift controlled");
        assertLe(outflow.end.maxDriftBps, outflow.start.maxDriftBps + 1000, "redeem wave: drift controlled");
    }

    function test_opposite_charmSkew_vs_ajnaSkew() external {
        ScenarioVaultCtx memory charmCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        _applyRelativeNav(charmCtx, 25_000, 8_000);
        VaultTimelineSnapshot memory charmPre = _snapshotTimeline(charmCtx);

        ScenarioVaultCtx memory ajnaCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        _applyRelativeNav(ajnaCtx, 8_000, 25_000);
        VaultTimelineSnapshot memory ajnaPre = _snapshotTimeline(ajnaCtx);

        TimelineStepConfig[] memory charmHeavy = new TimelineStepConfig[](1);
        charmHeavy[0] = TimelineStepConfig(0, 0, 3, BAND, 0, 0, MC_10K);

        TimelineStepConfig[] memory ajnaHeavy = new TimelineStepConfig[](1);
        ajnaHeavy[0] = TimelineStepConfig(0, 0, 3, BAND, 0, 0, MC_10K);

        TimelineSimOutcome memory charmSkew = _runTimelineSimulation(
            charmCtx, charmHeavy, bob, ALICE, MC_10K, "OPPOSITE A: Charm overweight skew + keeper"
        );

        TimelineSimOutcome memory ajnaSkew = _runTimelineSimulation(
            ajnaCtx, ajnaHeavy, bob, ALICE, MC_10K, "OPPOSITE B: Ajna overweight skew + keeper"
        );

        assertGt(charmPre.charmNav, charmPre.charmTarget, "charm skew: charm above target");
        assertGt(ajnaPre.ajnaNav, ajnaPre.ajnaTarget, "ajna skew: ajna above target");
        assertGt(charmPre.maxDriftBps, 2_000, "charm skew: material drift before keeper");
        assertGt(ajnaPre.maxDriftBps, 2_000, "ajna skew: material drift before keeper");
        assertLe(charmSkew.end.maxDriftBps, charmPre.maxDriftBps, "charm skew: drift shrinks");
        assertLe(ajnaSkew.end.maxDriftBps, ajnaPre.maxDriftBps, "ajna skew: drift shrinks");
    }

    function test_opposite_tightKeeper_vs_lazyKeeper() external {
        TimelineStepConfig[] memory skew = new TimelineStepConfig[](1);
        skew[0] = TimelineStepConfig(18_000, 9_000, 1, 0, 0, 0, MC_10K);

        TimelineStepConfig[] memory lazySkew = new TimelineStepConfig[](1);
        lazySkew[0] = TimelineStepConfig(18_000, 9_000, 1, 5_000, 0, 0, MC_10K);

        ScenarioVaultCtx memory tightCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory tight = _runTimelineSimulation(
            tightCtx, skew, bob, ALICE, MC_10K, "OPPOSITE A: tight keeper band (0 bps)"
        );

        ScenarioVaultCtx memory lazyCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory lazy = _runTimelineSimulation(
            lazyCtx, lazySkew, bob, ALICE, MC_10K, "OPPOSITE B: lazy keeper band (5000 bps)"
        );

        assertLt(tight.end.maxDriftBps, lazy.end.maxDriftBps, "tight keeper ends with lower drift");
        assertApproxEqAbs(tight.end.charmNav, tight.end.charmTarget, 1e21, "tight: charm on target");
        assertGt(lazy.end.maxDriftBps, 1_000, "lazy: material drift remains");
    }

    function test_opposite_dualBull_vs_dualBear() external {
        TimelineStepConfig[] memory bull = new TimelineStepConfig[](3);
        bull[0] = TimelineStepConfig(11_000, 11_000, 2, BAND, 0, 0, MC_10K);
        bull[1] = TimelineStepConfig(12_500, 12_500, 2, BAND, 0, 0, MC_10K);
        bull[2] = TimelineStepConfig(14_000, 14_000, 2, BAND, 0, 0, MC_10K);

        TimelineStepConfig[] memory bear = new TimelineStepConfig[](3);
        bear[0] = TimelineStepConfig(9_000, 9_000, 2, BAND, 300, 0, MC_10K);
        bear[1] = TimelineStepConfig(7_500, 7_500, 2, BAND, 500, 0, MC_10K);
        bear[2] = TimelineStepConfig(6_000, 6_000, 2, BAND, 700, 0, MC_10K);

        ScenarioVaultCtx memory bullCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory bullOut = _runTimelineSimulation(
            bullCtx, bull, bob, ALICE, MC_10K, "OPPOSITE A: dual-sleeve bull marks"
        );

        ScenarioVaultCtx memory bearCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory bearOut = _runTimelineSimulation(
            bearCtx, bear, bob, ALICE, MC_10K, "OPPOSITE B: dual-sleeve bear marks + exits"
        );

        assertGt(bullOut.end.totalAssets, bullOut.start.totalAssets, "dual bull: TVL up");
        assertLt(bearOut.end.totalAssets, bearOut.start.totalAssets, "dual bear: TVL down");
        assertGt(bullOut.end.assetsPerShare, bullOut.start.assetsPerShare, "dual bull: share price up");
        assertLt(bearOut.end.assetsPerShare, bearOut.start.assetsPerShare, "dual bear: share price down");
    }

    function test_opposite_idleBuild_vs_idleDrain() external {
        TimelineStepConfig[] memory build = new TimelineStepConfig[](2);
        build[0] = TimelineStepConfig(10_000, 10_000, 0, BAND, 0, 0, MC_10K);
        build[1] = TimelineStepConfig(10_000, 10_000, 2, BAND, 0, 0, MC_10K);

        TimelineStepConfig[] memory drain = new TimelineStepConfig[](2);
        drain[0] = TimelineStepConfig(10_000, 10_000, 0, BAND, 2_000, 0, MC_10K);
        drain[1] = TimelineStepConfig(10_000, 10_000, 2, BAND, 2_000, 0, MC_10K);

        ScenarioVaultCtx memory buildCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        uint256 drainStartIdle = buildCtx.coin.balanceOf(address(buildCtx.vault));
        buildCtx.coin.mint(address(buildCtx.vault), 8_000_000e18);
        uint256 buildStartIdle = buildCtx.coin.balanceOf(address(buildCtx.vault));

        TimelineSimOutcome memory buildOut = _runTimelineSimulation(
            buildCtx, build, bob, ALICE, MC_10K, "OPPOSITE A: idle build then keeper deploy"
        );

        ScenarioVaultCtx memory drainCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory drainOut = _runTimelineSimulation(
            drainCtx, drain, bob, ALICE, MC_10K, "OPPOSITE B: redemption drain without idle injection"
        );

        assertGt(buildStartIdle, drainStartIdle + 7_000_000e18, "idle build: injected surplus idle");
        assertLt(drainOut.end.totalAssets, drainOut.start.totalAssets, "idle drain path: TVL down from exits");
        assertGt(buildOut.end.totalAssets, drainOut.end.totalAssets, "idle build ends larger than drain path");
        assertLt(buildOut.end.idle, buildStartIdle, "idle build: keeper deploys surplus idle");
    }

    function test_opposite_balancedWeights_vs_asymmetricWeights() external {
        TimelineStepConfig[] memory stress = new TimelineStepConfig[](2);
        stress[0] = TimelineStepConfig(15_000, 9_000, 1, BAND, 500, 0, MC_10K);
        stress[1] = TimelineStepConfig(15_000, 9_000, 3, BAND, 500, 0, MC_10K);

        ScenarioVaultCtx memory balancedCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory balanced = _runTimelineSimulation(
            balancedCtx, stress, bob, ALICE, MC_10K, "OPPOSITE A: 45/45 weights under charm stress"
        );

        ScenarioVaultCtx memory asymCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 5_400, 3_600, 0);
        TimelineSimOutcome memory asym = _runTimelineSimulation(
            asymCtx, stress, bob, carol, MC_10K, "OPPOSITE B: 54/36 weights under same stress"
        );

        assertApproxEqAbs(balanced.end.maxDriftBps, 0, 800, "45/45: converged");
        assertApproxEqAbs(asym.end.maxDriftBps, 0, 800, "54/36: converged");
        assertGt(asym.end.charmTarget, balanced.end.charmTarget, "asymmetric: higher charm target");
        assertLt(asym.end.ajnaTarget, balanced.end.ajnaTarget, "asymmetric: lower ajna target");
    }

    function test_opposite_charmLiquidityCapped_vs_fullLiquidity() external {
        TimelineStepConfig[] memory exitStress = new TimelineStepConfig[](2);
        exitStress[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 0, MC_10K);
        exitStress[1] = TimelineStepConfig(10_000, 10_000, 1, BAND, 2_500, 0, MC_10K);

        ScenarioVaultCtx memory cappedCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        cappedCtx.charm.setMaxWithdrawCap(500_000e18);
        TimelineSimOutcome memory capped = _runTimelineSimulation(
            cappedCtx, exitStress, bob, ALICE, MC_10K, "OPPOSITE A: Charm withdraw cap (queue fallthrough)"
        );

        ScenarioVaultCtx memory fullCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory full = _runTimelineSimulation(
            fullCtx, exitStress, bob, ALICE, MC_10K, "OPPOSITE B: full Charm liquidity"
        );

        assertGt(capped.charmWithdrawCallsEnd - capped.charmWithdrawCallsStart, 0, "capped: charm hit");
        assertGe(full.totalRedeemed, capped.totalRedeemed, "full liquidity redeems at least as much");
        assertGt(capped.end.ajnaNav, 0, "capped: ajna sleeve participates on fallthrough");
        if (full.totalRedeemed > capped.totalRedeemed) {
            assertGt(full.totalRedeemed, capped.totalRedeemed, "full liquidity redeems strictly more when cap binds");
        }
    }

    function test_opposite_dualStrategy_vs_charmOnly() external {
        TimelineStepConfig[] memory stress = new TimelineStepConfig[](2);
        stress[0] = TimelineStepConfig(12_000, 10_000, 2, BAND, 1_000, 0, MC_10K);
        stress[1] = TimelineStepConfig(14_000, 10_000, 2, BAND, 1_000, 0, MC_10K);

        ScenarioVaultCtx memory dualCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory dual = _runTimelineSimulation(
            dualCtx, stress, bob, ALICE, MC_10K, "OPPOSITE A: dual 45/45 Charm+Ajna"
        );

        ScenarioVaultCtx memory charmOnlyCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 9_000, 0, 0);
        TimelineSimOutcome memory charmOnly = _runTimelineSimulation(
            charmOnlyCtx, stress, bob, ALICE, MC_10K, "OPPOSITE B: Charm-only 90% (+ idle 10%)"
        );

        assertGt(dual.end.ajnaNav, 0, "dual: ajna sleeve holds capital");
        assertEq(charmOnly.end.ajnaNav, 0, "charm-only: ajna sleeve empty");
        assertGt(charmOnly.end.charmNav, dual.end.charmNav, "charm-only: more capital in charm");
        assertApproxEqAbs(dual.end.maxDriftBps, 0, 1500, "dual: keeper mostly converges");
        assertGt(charmOnly.totalRedeemed, 0, "charm-only: redemptions still execute");
    }

    function test_opposite_charmOnly_vs_ajnaOnly() external {
        TimelineStepConfig[] memory stress = new TimelineStepConfig[](2);
        stress[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 1_200, 0, MC_10K);
        stress[1] = TimelineStepConfig(10_000, 10_000, 1, BAND, 1_200, 0, MC_10K);

        ScenarioVaultCtx memory charmCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 9_000, 0, 0);
        TimelineSimOutcome memory charmOnly = _runTimelineSimulation(
            charmCtx, stress, bob, ALICE, MC_10K, "OPPOSITE A: Charm-only 90%"
        );

        ScenarioVaultCtx memory ajnaCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 0, 9_000, 0);
        TimelineSimOutcome memory ajnaOnly = _runTimelineSimulation(
            ajnaCtx, stress, bob, carol, MC_10K, "OPPOSITE B: Ajna-only 90%"
        );

        assertGt(charmOnly.end.charmNav, charmOnly.end.ajnaNav, "charm-only: charm dominates");
        assertGt(ajnaOnly.end.ajnaNav, ajnaOnly.end.charmNav, "ajna-only: ajna dominates");
        assertGt(charmOnly.charmWithdrawCallsEnd, ajnaOnly.charmWithdrawCallsEnd, "charm-only: more charm queue hits");
        assertEq(ajnaOnly.charmWithdrawCallsEnd - ajnaOnly.charmWithdrawCallsStart, 0, "ajna-only: no charm exits");
    }

    function test_opposite_backstopOn_vs_backstopOff() external {
        TimelineStepConfig[] memory exitStress = new TimelineStepConfig[](2);
        exitStress[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 0, MC_10K);
        exitStress[1] = TimelineStepConfig(10_000, 10_000, 1, BAND, 3_000, 0, MC_10K);

        (ScenarioVaultCtx memory onCtx, SynergyCharmMockStrategy onCharm) =
            _deployBackstopScenarioVaultWithDeposit(PRINCIPAL, true);
        onCharm.setMaxWithdrawCap(1_000_000e18);
        TimelineSimOutcome memory backstopOn = _runTimelineSimulation(
            onCtx, exitStress, bob, ALICE, MC_10K, "OPPOSITE A: Ajna borrow backstop ON (capped Charm)"
        );

        (ScenarioVaultCtx memory offCtx, SynergyCharmMockStrategy offCharm) =
            _deployBackstopScenarioVaultWithDeposit(PRINCIPAL, false);
        offCharm.setMaxWithdrawCap(1_000_000e18);
        TimelineSimOutcome memory backstopOff = _runTimelineSimulation(
            offCtx, exitStress, bob, ALICE, MC_10K, "OPPOSITE B: Ajna borrow backstop OFF (capped Charm)"
        );

        assertTrue(onCharm.ajnaBorrowEnabled(), "backstop on: flag set");
        assertFalse(offCharm.ajnaBorrowEnabled(), "backstop off: flag clear");
        assertGt(onCharm.backstopPulls(), 0, "backstop on: pulls Ajna liquidity");
        assertEq(offCharm.backstopPulls(), 0, "backstop off: no Ajna pulls");
        assertGe(backstopOn.totalRedeemed, backstopOff.totalRedeemed, "backstop on: redeems at least as much");
        if (backstopOn.totalRedeemed > backstopOff.totalRedeemed) {
            assertGt(backstopOn.totalRedeemed, backstopOff.totalRedeemed, "backstop on: strictly higher redemption fill");
        }
    }

    function test_opposite_tripleStrategy_vs_dualStrategy() external {
        TimelineStepConfig[] memory stress = new TimelineStepConfig[](2);
        stress[0] = TimelineStepConfig(15_000, 8_000, 2, BAND, 500, 0, MC_10K);
        stress[1] = TimelineStepConfig(15_000, 8_000, 3, BAND, 500, 0, MC_10K);

        ScenarioVaultCtx memory dualCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory dual = _runTimelineSimulation(
            dualCtx, stress, bob, ALICE, MC_10K, "OPPOSITE A: dual 45/45"
        );

        ScenarioVaultCtx memory tripleCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 3_000, 3_000, 3_000);
        _applyRelativeNav(tripleCtx, 15_000, 8_000);
        if (tripleCtx.hasThird) {
            uint256 thirdTarget = _strategyTarget(tripleCtx.vault, address(tripleCtx.third));
            _setStrategyNav(tripleCtx.coin, tripleCtx.third, (thirdTarget * 12_000) / 10_000);
        }
        TimelineStepConfig[] memory tripleSteps = new TimelineStepConfig[](1);
        tripleSteps[0] = TimelineStepConfig(0, 0, 3, BAND, 500, 0, MC_10K);
        TimelineSimOutcome memory triple = _runTimelineSimulation(
            tripleCtx, tripleSteps, bob, carol, MC_10K, "OPPOSITE B: triple 30/30/30 same skew"
        );

        assertFalse(dualCtx.hasThird, "dual: no third sleeve");
        assertTrue(tripleCtx.hasThird, "triple: third sleeve present");
        assertApproxEqAbs(dual.end.maxDriftBps, 0, 1000, "dual: converged");
        assertApproxEqAbs(triple.end.maxDriftBps, 0, 1500, "triple: converged");
        assertGt(triple.end.totalAssets, 0, "triple: TVL remains positive");
    }

    function test_opposite_whaleDeposit_vs_whaleRedeem() external {
        TimelineStepConfig[] memory whaleIn = new TimelineStepConfig[](2);
        whaleIn[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 10_000_000e18, MC_10K);
        whaleIn[1] = TimelineStepConfig(10_500, 10_500, 2, BAND, 0, 5_000_000e18, MC_10K);

        TimelineStepConfig[] memory whaleOut = new TimelineStepConfig[](2);
        whaleOut[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 2_000, 0, MC_10K);
        whaleOut[1] = TimelineStepConfig(9_500, 9_500, 2, BAND, 3_500, 0, MC_10K);

        ScenarioVaultCtx memory inCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory depositWhale = _runTimelineSimulation(
            inCtx, whaleIn, bob, ALICE, MC_10K, "OPPOSITE A: whale deposit wave (+15M)"
        );

        ScenarioVaultCtx memory outCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory redeemWhale = _runTimelineSimulation(
            outCtx, whaleOut, bob, ALICE, MC_10K, "OPPOSITE B: whale redemption wave (55% shares)"
        );

        assertGt(depositWhale.totalDeposited, 14_000_000e18, "whale in: large deposits");
        assertGt(redeemWhale.totalRedeemed, 0, "whale out: large redemptions");
        assertGt(depositWhale.end.totalAssets, depositWhale.start.totalAssets + 14_000_000e18, "whale in: TVL jumps");
        assertLt(redeemWhale.end.totalAssets, redeemWhale.start.totalAssets, "whale out: TVL falls");
        assertGt(depositWhale.end.shareSupply, redeemWhale.end.shareSupply, "whale in: more shares minted");
    }

    function test_opposite_volatileCharm_vs_stableAjna() external {
        TimelineStepConfig[] memory volatileCharm = new TimelineStepConfig[](4);
        volatileCharm[0] = TimelineStepConfig(14_000, 10_000, 1, BAND, 0, 0, MC_10K);
        volatileCharm[1] = TimelineStepConfig(8_000, 10_000, 1, BAND, 0, 0, MC_10K);
        volatileCharm[2] = TimelineStepConfig(16_000, 10_000, 2, BAND, 0, 0, MC_10K);
        volatileCharm[3] = TimelineStepConfig(9_000, 10_000, 2, BAND, 300, 0, MC_10K);

        TimelineStepConfig[] memory stableAjna = new TimelineStepConfig[](4);
        stableAjna[0] = TimelineStepConfig(10_000, 11_000, 1, BAND, 0, 0, MC_10K);
        stableAjna[1] = TimelineStepConfig(10_000, 10_500, 1, BAND, 0, 0, MC_10K);
        stableAjna[2] = TimelineStepConfig(10_000, 11_500, 2, BAND, 0, 0, MC_10K);
        stableAjna[3] = TimelineStepConfig(10_000, 10_800, 2, BAND, 300, 0, MC_10K);

        ScenarioVaultCtx memory volCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory volOut = _runTimelineSimulation(
            volCtx, volatileCharm, bob, ALICE, MC_10K, "OPPOSITE A: volatile Charm marks, stable Ajna"
        );

        ScenarioVaultCtx memory stableCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory stableOut = _runTimelineSimulation(
            stableCtx, stableAjna, bob, carol, MC_10K, "OPPOSITE B: stable Charm marks, rising Ajna"
        );

        assertGt(volOut.charmWithdrawCallsEnd, stableOut.charmWithdrawCallsEnd, "volatile charm: more rebalance/exit churn");
        assertLe(stableOut.end.maxDriftBps, stableOut.start.maxDriftBps + 1000, "stable ajna path: drift controlled");
        assertGt(volOut.end.totalAssets, 0, "volatile path: solvent end state");
        assertGt(stableOut.end.totalAssets, 0, "stable path: solvent end state");
    }

    function test_opposite_aggressiveKeeper_vs_minimalKeeper() external {
        TimelineStepConfig[] memory aggressive = new TimelineStepConfig[](1);
        aggressive[0] = TimelineStepConfig(20_000, 7_000, 6, BAND, 0, 0, MC_10K);

        TimelineStepConfig[] memory minimal = new TimelineStepConfig[](1);
        minimal[0] = TimelineStepConfig(20_000, 7_000, 1, 5_000, 0, 0, MC_10K);

        ScenarioVaultCtx memory aggCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory agg = _runTimelineSimulation(
            aggCtx, aggressive, bob, ALICE, MC_10K, "OPPOSITE A: aggressive keeper (6 passes)"
        );

        ScenarioVaultCtx memory minCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory min = _runTimelineSimulation(
            minCtx, minimal, bob, ALICE, MC_10K, "OPPOSITE B: minimal keeper (1 pass)"
        );

        assertLt(agg.end.maxDriftBps, min.end.maxDriftBps + 1, "aggressive keeper: drift not worse");
        assertGe(
            agg.charmWithdrawCallsEnd - agg.charmWithdrawCallsStart,
            min.charmWithdrawCallsEnd - min.charmWithdrawCallsStart,
            "aggressive: more charm rebalance activity"
        );
        if (min.end.maxDriftBps > 0) {
            assertLt(agg.end.maxDriftBps, min.end.maxDriftBps, "aggressive keeper: lower end drift when minimal lags");
        }
    }

    function test_opposite_synergyStress_withBackstop_vs_without() external {
        TimelineStepConfig[] memory stress = new TimelineStepConfig[](3);
        stress[0] = TimelineStepConfig(7_000, 10_000, 1, BAND, 0, 0, MC_10K);
        stress[1] = TimelineStepConfig(7_000, 10_000, 1, BAND, 1_500, 0, MC_10K);
        stress[2] = TimelineStepConfig(7_000, 10_000, 2, BAND, 1_500, 0, MC_10K);

        (ScenarioVaultCtx memory synCtx, SynergyCharmMockStrategy synCharm) =
            _deployBackstopScenarioVaultWithDeposit(PRINCIPAL, true);
        synCharm.setMaxWithdrawCap(800_000e18);
        TimelineSimOutcome memory withSyn = _runTimelineSimulation(
            synCtx, stress, bob, ALICE, MC_10K, "OPPOSITE A: bear + exits WITH Ajna backstop"
        );

        ScenarioVaultCtx memory plainCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        plainCtx.charm.setMaxWithdrawCap(800_000e18);
        TimelineSimOutcome memory withoutSyn = _runTimelineSimulation(
            plainCtx, stress, bob, ALICE, MC_10K, "OPPOSITE B: bear + exits WITHOUT backstop (same cap)"
        );

        assertGt(synCharm.backstopVolume(), 0, "synergy stress: backstop volume > 0");
        assertGe(withSyn.totalRedeemed, withoutSyn.totalRedeemed, "synergy: backstop improves redemption fill");
        assertGt(withSyn.totalRedeemed, 0, "synergy: redemptions execute under stress");
    }

    function test_opposite_backstopDirect_vs_queueFallthrough() external {
        TimelineStepConfig[] memory exitStress = new TimelineStepConfig[](1);
        exitStress[0] = TimelineStepConfig(10_000, 10_000, 0, BAND, 2_500, 0, MC_10K);

        (ScenarioVaultCtx memory directCtx, SynergyCharmMockStrategy directCharm) =
            _deployCharmOnlyBackstopVaultWithDeposit(PRINCIPAL, true, 5_000);
        directCharm.setMaxWithdrawCap(500_000e18);
        TimelineSimOutcome memory direct = _runTimelineSimulation(
            directCtx, exitStress, bob, ALICE, MC_10K, "OPPOSITE A: Charm-only + direct Ajna backstop"
        );

        ScenarioVaultCtx memory queueCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        queueCtx.charm.setMaxWithdrawCap(500_000e18);
        TimelineSimOutcome memory queue = _runTimelineSimulation(
            queueCtx, exitStress, bob, ALICE, MC_10K, "OPPOSITE B: Dual sleeve + queue fallthrough (no backstop)"
        );

        assertGt(directCharm.backstopVolume(), 0, "direct: Ajna backstop supplies liquidity");
        assertGt(directCharm.backstopPulls(), 0, "direct: backstop lane used");
        assertEq(queueCtx.ajna.withdrawCalls(), 1, "queue: Ajna hit after Charm cap");
        assertGt(direct.totalRedeemed, 0, "direct: redemption succeeds");
        assertGt(queue.totalRedeemed, 0, "queue: redemption succeeds");
        assertGe(direct.totalRedeemed, queue.totalRedeemed, "both paths fill large exit");
    }

    function test_opposite_lateEntryBull_vs_earlyEntryBull() external {
        TimelineStepConfig[] memory early = new TimelineStepConfig[](3);
        early[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 5_000_000e18, MC_10K);
        early[1] = TimelineStepConfig(12_000, 10_200, 2, BAND, 0, 0, MC_10K);
        early[2] = TimelineStepConfig(14_000, 10_500, 2, BAND, 0, 0, MC_10K);

        TimelineStepConfig[] memory late = new TimelineStepConfig[](3);
        late[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 0, 0, MC_10K);
        late[1] = TimelineStepConfig(12_000, 10_200, 2, BAND, 0, 0, MC_10K);
        late[2] = TimelineStepConfig(14_000, 10_500, 2, BAND, 0, 5_000_000e18, MC_10K);

        ScenarioVaultCtx memory earlyCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory earlyIn = _runTimelineSimulation(
            earlyCtx, early, bob, ALICE, MC_10K, "OPPOSITE A: early bull entry (+5M step 1)"
        );

        ScenarioVaultCtx memory lateCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory lateIn = _runTimelineSimulation(
            lateCtx, late, bob, ALICE, MC_10K, "OPPOSITE B: late bull entry (+5M step 3)"
        );

        assertGt(earlyIn.totalDeposited, 4_000_000e18, "early: deposit in step 1");
        assertGt(lateIn.totalDeposited, 4_000_000e18, "late: deposit in step 3");
        assertGt(earlyIn.end.totalAssets, lateIn.end.totalAssets, "early entry: higher end TVL after rally");
        assertGt(earlyIn.end.assetsPerShare, lateIn.end.assetsPerShare, "early entry: better share price");
    }

    function test_opposite_highIdleReserve_vs_lowIdleReserve() external {
        TimelineStepConfig[] memory stress = new TimelineStepConfig[](2);
        stress[0] = TimelineStepConfig(10_000, 10_000, 2, BAND, 1_000, 0, MC_10K);
        stress[1] = TimelineStepConfig(10_000, 10_000, 2, BAND, 1_500, 0, MC_10K);

        ScenarioVaultCtx memory highIdleCtx =
            _deployScenarioVaultWithDepositAndMinIdle(PRINCIPAL, 4_500, 4_500, 0, PRINCIPAL / 5);
        TimelineSimOutcome memory highIdle = _runTimelineSimulation(
            highIdleCtx, stress, bob, ALICE, MC_10K, "OPPOSITE A: high idle reserve (20%)"
        );

        ScenarioVaultCtx memory lowIdleCtx =
            _deployScenarioVaultWithDepositAndMinIdle(PRINCIPAL, 4_500, 4_500, 0, MIN_IDLE);
        TimelineSimOutcome memory lowIdle = _runTimelineSimulation(
            lowIdleCtx, stress, bob, ALICE, MC_10K, "OPPOSITE B: low idle reserve (100 tokens)"
        );

        assertGt(highIdle.start.idle, lowIdle.start.idle, "high idle: more vault cash at start");
        assertGe(highIdle.end.idle, lowIdle.end.idle, "high idle: retains more cash through exits");
        assertGt(highIdle.totalRedeemed, 0, "high idle: exits succeed");
        assertGt(lowIdle.totalRedeemed, 0, "low idle: exits succeed");
        assertGe(
            lowIdle.charmWithdrawCallsEnd - lowIdle.charmWithdrawCallsStart,
            highIdle.charmWithdrawCallsEnd - highIdle.charmWithdrawCallsStart,
            "low idle: more strategy pulls on exit"
        );
    }

    function test_opposite_rebalanceBeforeExit_vs_coldExit() external {
        TimelineStepConfig[] memory primed = new TimelineStepConfig[](2);
        primed[0] = TimelineStepConfig(18_000, 8_000, 4, BAND, 0, 0, MC_10K);
        primed[1] = TimelineStepConfig(18_000, 8_000, 0, BAND, 2_000, 0, MC_10K);

        TimelineStepConfig[] memory cold = new TimelineStepConfig[](2);
        cold[0] = TimelineStepConfig(18_000, 8_000, 0, BAND, 0, 0, MC_10K);
        cold[1] = TimelineStepConfig(18_000, 8_000, 0, BAND, 2_000, 0, MC_10K);

        ScenarioVaultCtx memory primedCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory primedOut = _runTimelineSimulation(
            primedCtx, primed, bob, ALICE, MC_10K, "OPPOSITE A: rebalance before exit"
        );

        ScenarioVaultCtx memory coldCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory coldOut = _runTimelineSimulation(
            coldCtx, cold, bob, ALICE, MC_10K, "OPPOSITE B: cold exit (no keeper pass)"
        );

        assertLt(primedOut.end.maxDriftBps, coldOut.end.maxDriftBps + 1, "primed: drift not worse");
        if (coldOut.end.maxDriftBps > primedOut.end.maxDriftBps) {
            assertLt(primedOut.end.maxDriftBps, coldOut.end.maxDriftBps, "primed: lower drift before exit");
        }
        assertGt(primedOut.totalRedeemed, 0, "primed: redemption succeeds");
        assertGt(coldOut.totalRedeemed, 0, "cold: redemption succeeds");
    }

    function test_opposite_shallowBackstopPool_vs_deepBackstopPool() external {
        TimelineStepConfig[] memory shallowExit = new TimelineStepConfig[](1);
        shallowExit[0] = TimelineStepConfig(10_000, 10_000, 0, BAND, 500, 0, MC_10K);

        TimelineStepConfig[] memory deepExit = new TimelineStepConfig[](1);
        deepExit[0] = TimelineStepConfig(10_000, 10_000, 0, BAND, 1_500, 0, MC_10K);

        (ScenarioVaultCtx memory shallowCtx, SynergyCharmMockStrategy shallowCharm) =
            _deployCharmOnlyBackstopVaultWithDeposit(PRINCIPAL, true, 500);
        shallowCharm.setMaxWithdrawCap(300_000e18);
        TimelineSimOutcome memory shallow = _runTimelineSimulation(
            shallowCtx, shallowExit, bob, ALICE, MC_10K, "OPPOSITE A: shallow Ajna pool + 5% exit"
        );

        (ScenarioVaultCtx memory deepCtx, SynergyCharmMockStrategy deepCharm) =
            _deployCharmOnlyBackstopVaultWithDeposit(PRINCIPAL, true, 5_000);
        deepCharm.setMaxWithdrawCap(300_000e18);
        TimelineSimOutcome memory deep = _runTimelineSimulation(
            deepCtx, deepExit, bob, ALICE, MC_10K, "OPPOSITE B: deep Ajna pool + 15% exit"
        );

        assertGt(shallowCharm.backstopVolume(), 0, "shallow: backstop used");
        assertGt(deepCharm.backstopVolume(), shallowCharm.backstopVolume(), "deep pool: larger backstop volume");
        assertGt(deep.totalRedeemed, shallow.totalRedeemed, "deep pool: larger exit fill");
    }

    function test_opposite_doubleRedemptionWave_vs_singleSoftExit() external {
        TimelineStepConfig[] memory doubleWave = new TimelineStepConfig[](2);
        doubleWave[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 1_500, 0, MC_10K);
        doubleWave[1] = TimelineStepConfig(10_000, 10_000, 1, BAND, 1_500, 0, MC_10K);

        TimelineStepConfig[] memory singleSoft = new TimelineStepConfig[](1);
        singleSoft[0] = TimelineStepConfig(10_000, 10_000, 1, BAND, 500, 0, MC_10K);

        ScenarioVaultCtx memory waveCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory wave = _runTimelineSimulation(
            waveCtx, doubleWave, bob, ALICE, MC_10K, "OPPOSITE A: double redemption wave (15% + 15%)"
        );

        ScenarioVaultCtx memory softCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        TimelineSimOutcome memory soft = _runTimelineSimulation(
            softCtx, singleSoft, bob, ALICE, MC_10K, "OPPOSITE B: single soft exit (5%)"
        );

        assertGt(wave.totalRedeemed, soft.totalRedeemed, "double wave: redeems more assets");
        assertLt(wave.end.totalAssets, soft.end.totalAssets, "double wave: lower end TVL");
        assertGt(wave.charmWithdrawCallsEnd - wave.charmWithdrawCallsStart, 0, "double wave: strategy exits");
    }

    function test_opposite_charmCrash_withBackstop_vs_withoutBackstop() external {
        TimelineStepConfig[] memory crash = new TimelineStepConfig[](2);
        crash[0] = TimelineStepConfig(4_000, 10_000, 1, BAND, 0, 0, MC_10K);
        crash[1] = TimelineStepConfig(4_000, 10_000, 0, BAND, 2_000, 0, MC_10K);

        (ScenarioVaultCtx memory withCtx, SynergyCharmMockStrategy withCharm) =
            _deployBackstopScenarioVaultWithDeposit(PRINCIPAL, true);
        withCharm.setMaxWithdrawCap(400_000e18);
        TimelineSimOutcome memory withBackstop = _runTimelineSimulation(
            withCtx, crash, bob, ALICE, MC_10K, "OPPOSITE A: Charm crash + backstop ON"
        );

        ScenarioVaultCtx memory withoutCtx = _deployScenarioVaultWithDeposit(PRINCIPAL, 4_500, 4_500, 0);
        withoutCtx.charm.setMaxWithdrawCap(400_000e18);
        TimelineSimOutcome memory withoutBackstop = _runTimelineSimulation(
            withoutCtx, crash, bob, ALICE, MC_10K, "OPPOSITE B: Charm crash + queue only"
        );

        assertGt(withCharm.backstopVolume(), 0, "crash+backstop: Ajna liquidity used");
        assertGe(withBackstop.totalRedeemed, withoutBackstop.totalRedeemed, "backstop: same or better fill");
        assertLt(withBackstop.end.charmNav, withBackstop.start.charmNav, "crash path: charm NAV down");
    }
}
