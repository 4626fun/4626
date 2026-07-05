// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

interface IVaultLiquidityReader {
    function coinBalance() external view returns (uint256);
    function minimumTotalIdle() external view returns (uint256);
    function deploymentThreshold() external view returns (uint256);
    function totalAssets() external view returns (uint256);
    function totalQueuedWithdrawalShares() external view returns (uint256);
    function lockedShares() external view returns (uint256);
    function largeWithdrawalThreshold() external view returns (uint256);
    function strategyCount() external view returns (uint256);
    function strategyList(uint256 index) external view returns (address);
    function activeStrategies(address strategy) external view returns (bool);
    function strategyDebt(address strategy) external view returns (uint256);
    function strategyMaxAssets(address strategy) external view returns (uint256);
}

/// @notice Read-only liquidity transparency for CreatorOVault (P0 / P2 integrator surface).
library CreatorOVaultLiquidityLib {
    uint256 internal constant MAX_BPS = 10_000;

    struct StrategyLiquidity {
        address strategy;
        bool active;
        bool valuationReady;
        uint256 reportedAssets;
        uint256 strategyDebt;
    }

    struct LiquiditySnapshot {
        uint256 totalAssets;
        uint256 idleAssets;
        uint256 minIdleReserve;
        /// @notice Creator Coin redeemable from vault idle without pulling strategies.
        uint256 instantIdleAssets;
        /// @notice `instantIdleAssets * MAX_BPS / totalAssets` (0 when totalAssets == 0).
        uint256 instantIdleBps;
        /// @notice Vault shares reserved for queued large withdrawals.
        uint256 queuedWithdrawalShares;
        /// @notice Profit-unlock shares not yet matured on the vault balance.
        uint256 lockedProfitShares;
        /// @notice Largest synchronous redeem per ERC-4626 `maxWithdraw` policy (0 = unlimited).
        uint256 maxSyncWithdrawAssets;
        StrategyLiquidity[] strategies;
    }

    /// @dev FIX: AUDIT-2026-07-01-M05 — conservative instant-withdraw ceiling from idle
    ///      reserves plus strategy debt on active, valuation-ready strategies.
    function maxInstantWithdrawAssets(LiquiditySnapshot memory snap) internal pure returns (uint256) {
        uint256 total = snap.instantIdleAssets;
        for (uint256 i = 0; i < snap.strategies.length; i++) {
            StrategyLiquidity memory strategy = snap.strategies[i];
            if (strategy.active && strategy.valuationReady) {
                total += strategy.strategyDebt;
            }
        }
        return total > snap.totalAssets ? snap.totalAssets : total;
    }

    function snapshot(address vault) internal view returns (LiquiditySnapshot memory snap) {
        IVaultLiquidityReader reader = IVaultLiquidityReader(vault);

        snap.totalAssets = reader.totalAssets();
        snap.idleAssets = reader.coinBalance();
        uint256 minIdle = reader.minimumTotalIdle();
        uint256 deployThreshold = reader.deploymentThreshold();
        snap.minIdleReserve = minIdle > deployThreshold ? minIdle : deployThreshold;

        snap.instantIdleAssets = snap.idleAssets > snap.minIdleReserve ? snap.idleAssets - snap.minIdleReserve : 0;
        snap.instantIdleBps = snap.totalAssets == 0 ? 0 : (snap.instantIdleAssets * MAX_BPS) / snap.totalAssets;

        snap.queuedWithdrawalShares = reader.totalQueuedWithdrawalShares();
        snap.lockedProfitShares = reader.lockedShares();

        uint256 largeThreshold = reader.largeWithdrawalThreshold();
        if (largeThreshold == 0) {
            snap.maxSyncWithdrawAssets = type(uint256).max;
        } else {
            snap.maxSyncWithdrawAssets = largeThreshold > 0 ? largeThreshold - 1 : 0;
        }

        uint256 count = reader.strategyCount();
        snap.strategies = new StrategyLiquidity[](count);
        for (uint256 i = 0; i < count; i++) {
            address strategy = reader.strategyList(i);
            snap.strategies[i] = StrategyLiquidity({
                strategy: strategy,
                active: reader.activeStrategies(strategy),
                valuationReady: _valuationReady(strategy),
                reportedAssets: _reportedAssets(vault, strategy, reader),
                strategyDebt: reader.strategyDebt(strategy)
            });
        }
    }

    function _valuationReady(address strategy) private view returns (bool) {
        try IStrategyValuation(strategy).isValuationReady() returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    function _reportedAssets(address vault, address strategy, IVaultLiquidityReader reader)
        private
        view
        returns (uint256 assets)
    {
        try IStrategy(strategy).getTotalAssets() returns (uint256 reported) {
            assets = reported;
        } catch {
            assets = reader.strategyDebt(strategy);
        }

        uint256 cap = reader.strategyMaxAssets(strategy);
        if (cap != 0 && assets > cap) {
            assets = cap;
        }
    }
}
