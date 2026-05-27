// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CreatorOVault} from "../../../contracts/vault/CreatorOVault.sol";
import {
    RebalanceTestHarness,
    ScenarioVaultCtx,
    MockRebalanceCoin
} from "./RebalanceTestHarness.sol";

/// @dev Stateful handler for rebalance invariant fuzzing.
contract RebalanceInvariantHandler is RebalanceTestHarness {
    ScenarioVaultCtx internal ctx;
    uint256 public ghostTotalBefore;
    uint256 public ghostTotalAfter;
    uint256 public ghostDriftBefore;
    uint256 public ghostDriftAfter;
    uint256 public rebalanceCalls;
    uint256 public opNonce;
    uint256 public syncedAtOp;

    constructor() {
        ctx = _deployScenarioVault(4500, 4500, 0);
    }

    function rebalance(uint256 minDeviationBps) external {
        minDeviationBps = bound(minDeviationBps, 0, 10_000);

        ghostTotalBefore = _economicTotal();
        ghostDriftBefore = _maxPairDriftBps(ctx);

        vm.prank(KEEPER);
        ctx.vault.rebalanceStrategies(minDeviationBps);

        ghostTotalAfter = _economicTotal();
        ghostDriftAfter = _maxPairDriftBps(ctx);
        rebalanceCalls += 1;
        opNonce += 1;
        syncedAtOp = opNonce;
    }

    function skewCharm(uint256 scaleBps) external {
        scaleBps = bound(scaleBps, 5_000, 30_000);
        uint256 target = _strategyTarget(ctx.vault, address(ctx.charm));
        if (target == 0) return;
        uint256 nav = (target * scaleBps) / 10_000;
        uint256 debt = ctx.vault.strategyDebt(address(ctx.charm));
        if (nav < debt) nav = debt;
        _setStrategyNav(ctx.coin, ctx.charm, nav);
        opNonce += 1;
    }

    function skewAjna(uint256 scaleBps) external {
        scaleBps = bound(scaleBps, 5_000, 30_000);
        uint256 target = _strategyTarget(ctx.vault, address(ctx.ajna));
        if (target == 0) return;
        uint256 nav = (target * scaleBps) / 10_000;
        uint256 debt = ctx.vault.strategyDebt(address(ctx.ajna));
        if (nav < debt) nav = debt;
        _setStrategyNav(ctx.coin, ctx.ajna, nav);
        opNonce += 1;
    }

    function mintIdle(uint256 amountE18) external {
        amountE18 = bound(amountE18, 1, 500);
        ctx.coin.mint(address(ctx.vault), amountE18 * 1e18);
        opNonce += 1;
    }

    function rebalanceAfterHeavySkew() external {
        uint256 charmTarget = _strategyTarget(ctx.vault, address(ctx.charm));
        uint256 ajnaTarget = _strategyTarget(ctx.vault, address(ctx.ajna));
        if (charmTarget > 0) _setStrategyNav(ctx.coin, ctx.charm, (charmTarget * 20_000) / 10_000);
        if (ajnaTarget > 0) {
            uint256 ajnaNav = (ajnaTarget * 5_000) / 10_000;
            uint256 ajnaDebt = ctx.vault.strategyDebt(address(ctx.ajna));
            if (ajnaNav < ajnaDebt) ajnaNav = ajnaDebt;
            _setStrategyNav(ctx.coin, ctx.ajna, ajnaNav);
        }

        ghostTotalBefore = _economicTotal();
        ghostDriftBefore = _maxPairDriftBps(ctx);
        vm.prank(KEEPER);
        ctx.vault.rebalanceStrategies(500);
        ghostTotalAfter = _economicTotal();
        ghostDriftAfter = _maxPairDriftBps(ctx);
        rebalanceCalls += 1;
        opNonce += 1;
        syncedAtOp = opNonce;

        ghostTotalBefore = _economicTotal();
        ghostDriftBefore = _maxPairDriftBps(ctx);
        vm.prank(KEEPER);
        ctx.vault.rebalanceStrategies(500);
        ghostTotalAfter = _economicTotal();
        ghostDriftAfter = _maxPairDriftBps(ctx);
        rebalanceCalls += 1;
        opNonce += 1;
        syncedAtOp = opNonce;
    }

    function _economicTotal() internal view returns (uint256) {
        return ctx.coin.balanceOf(address(ctx.vault))
            + ctx.charm.getTotalAssets()
            + ctx.ajna.getTotalAssets();
    }

    function vaultAddress() external view returns (address) {
        return address(ctx.vault);
    }

    function coinBalance() external view returns (uint256) {
        return ctx.vault.coinBalance();
    }

    function charmAssets() external view returns (uint256) {
        return ctx.charm.getTotalAssets();
    }

    function ajnaAssets() external view returns (uint256) {
        return ctx.ajna.getTotalAssets();
    }

    function charmDebt() external view returns (uint256) {
        return ctx.vault.strategyDebt(address(ctx.charm));
    }

    function ajnaDebt() external view returns (uint256) {
        return ctx.vault.strategyDebt(address(ctx.ajna));
    }

    function coinAddress() external view returns (address) {
        return address(ctx.coin);
    }
}

contract CreatorOVaultStrategiesRebalanceInvariantTest is RebalanceTestHarness {
    RebalanceInvariantHandler internal handler;

    function setUp() external {
        handler = new RebalanceInvariantHandler();
        targetContract(address(handler));
    }

    function invariant_rebalanceConservesEconomicTotal() external view {
        if (handler.rebalanceCalls() == 0) return;
        assertApproxEqAbs(handler.ghostTotalAfter(), handler.ghostTotalBefore(), 1e16);
    }

    function invariant_rebalanceDoesNotIncreaseDrift() external view {
        if (handler.rebalanceCalls() == 0) return;
        assertLe(handler.ghostDriftAfter(), handler.ghostDriftBefore());
    }

    function invariant_strategyDebtNeverExceedsNav() external view {
        assertLe(handler.charmDebt(), handler.charmAssets());
        assertLe(handler.ajnaDebt(), handler.ajnaAssets());
    }

    /// @dev Tracked `coinBalance` may lag direct token transfers until the next `_syncCoinBalance()`.
    function invariant_trackedCoinBalanceNeverExceedsLiveBalance() external view {
        assertLe(
            handler.coinBalance(),
            MockRebalanceCoin(handler.coinAddress()).balanceOf(handler.vaultAddress())
        );
    }

    /// @dev After rebalance, `_syncCoinBalance()` runs so tracked and live idle should match.
    function invariant_rebalanceSyncsTrackedIdle() external view {
        if (handler.syncedAtOp() != handler.opNonce()) return;
        assertEq(
            handler.coinBalance(),
            MockRebalanceCoin(handler.coinAddress()).balanceOf(handler.vaultAddress())
        );
    }

    function invariant_vaultTotalMatchesComponents() external view {
        uint256 total = CreatorOVault(handler.vaultAddress()).totalAssets();
        assertGe(total, handler.coinBalance());
        assertGe(total, handler.charmAssets() + handler.ajnaAssets());
    }
}
