// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

import {CreatorOVaultModuleBase} from "./CreatorOVaultModuleBase.sol";
import {ICreatorOVaultModuleIdentity} from "./ICreatorOVaultModuleIdentity.sol";

interface ICreatorORecoveryEscrowStrategyModule {
    function notifyRecovery(address asset, uint256 epochId, uint256 amount) external;
}

/// @notice Strategy management + strategy interaction logic for CreatorOVault.
/// @dev Must be invoked via delegatecall from CreatorOVault.
contract CreatorOVaultStrategiesModule is CreatorOVaultModuleBase, ICreatorOVaultModuleIdentity {
    using SafeERC20 for IERC20;
    bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.strategies");
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3");

    // ---- constants (must match vault) ----
    uint256 internal constant MAX_BPS = 10_000;
    uint256 internal constant MAX_QUEUE = 10;
    uint256 internal constant MAX_STRATEGIES = 5;

    // ---- events (must match vault signatures) ----
    event StrategyAdded(address indexed strategy, uint256 weight);
    event StrategyRemoved(address indexed strategy);
    event StrategyDeployed(address indexed strategy, uint256 amount);
    event StrategyWithdrawn(address indexed strategy, uint256 amount);
    event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);

    event UpdateDefaultQueue(address[] newDefaultQueue);
    event UpdateUseDefaultQueue(bool useDefaultQueue);
    event UpdateAutoAllocate(bool autoAllocate);
    event UpdateMinimumTotalIdle(uint256 minimumTotalIdle);
    event UpdateDebtPurchaser(address indexed newDebtPurchaser);
    event DebtUpdated(address indexed strategy, uint256 currentDebt, uint256 newDebt);
    event DebtPurchased(address indexed strategy, uint256 amount, address indexed buyer);
    event UnrealisedLossAssessed(address indexed strategy, uint256 lossAmount);
    event AutoAllocated(address indexed strategy, uint256 amount);
    event StrategiesRebalanced(uint256 totalWithdrawn, uint256 totalRedeployed);
    event ImpairedStrategyReinstated(address indexed strategy, uint256 indexed epochId);

    // ---- errors (must match vault selectors) ----
    error ZeroAddress();
    error StrategyAlreadyActive();
    error StrategyNotActive();
    error MaxStrategiesReached();
    error InvalidWeight();
    error QueueTooLong(uint256 length, uint256 maxLength);
    error StrategyAssetMismatch(address expected, address actual);
    error NoStrategies();
    error NothingToBuy();
    error VaultNotNormal();
    error TransferAmountMismatch(uint256 expected, uint256 actual);
    error StrategyWithdrawShortfall(uint256 expected, uint256 actual);

    // =================================
    // STRATEGY MANAGEMENT
    // =================================

    function moduleKind() external pure returns (bytes32) {
        return MODULE_KIND;
    }

    function moduleStorageVersion() external pure returns (bytes32) {
        return MODULE_STORAGE_VERSION;
    }

    function addStrategy(address strategy, uint256 weight) external onlyDelegateCall {
        addStrategy(strategy, weight, true);
    }

    function addStrategy(address strategy, uint256 weight, bool addToQueue) public onlyDelegateCall {
        _addStrategy(strategy, weight, addToQueue);
    }

    function migrateStrategy(address oldStrategy, address newStrategy, uint256 weight, bool addToQueue)
        external
        onlyDelegateCall
    {
        if (oldStrategy == address(0) || newStrategy == address(0)) revert ZeroAddress();
        if (oldStrategy == newStrategy) revert ZeroAddress();

        if (activeStrategies[oldStrategy]) {
            _removeStrategy(oldStrategy);
        } else if (_isStrategyListed(oldStrategy)) {
            _ejectStrategyFromList(oldStrategy);
        }
        _addStrategy(newStrategy, weight, addToQueue);
    }

    function removeStrategy(address strategy) external onlyDelegateCall {
        _removeStrategy(strategy);
    }

    function _addStrategy(address strategy, uint256 weight, bool addToQueue) internal {
        if (strategy == address(0)) revert ZeroAddress();
        if (activeStrategies[strategy]) revert StrategyAlreadyActive();
        if (strategyList.length >= MAX_STRATEGIES) revert MaxStrategiesReached();
        if (weight == 0 || weight > MAX_BPS) revert InvalidWeight();
        if (totalStrategyWeight + weight > MAX_BPS) revert InvalidWeight();

        if (!IStrategy(strategy).isActive()) revert StrategyNotActive();
        address strategyAsset = IStrategy(strategy).asset();
        address expected = address(_creatorCoin());
        if (strategyAsset != expected) revert StrategyAssetMismatch(expected, strategyAsset);

        activeStrategies[strategy] = true;
        strategyImpaired[strategy] = false;
        strategyWeights[strategy] = weight;
        strategyList.push(strategy);
        totalStrategyWeight += weight;

        if (addToQueue && defaultQueue.length < MAX_QUEUE) {
            defaultQueue.push(strategy);
            emit UpdateDefaultQueue(defaultQueue);
        }

        emit StrategyAdded(strategy, weight);
    }

    function _removeStrategy(address strategy) internal {
        if (!activeStrategies[strategy]) revert StrategyNotActive();

        uint256 currentDebt = strategyDebt[strategy];
        if (currentDebt > 0) {
            uint256 withdrawn = _withdrawFromStrategyMeasured(strategy, currentDebt);
            if (withdrawn < currentDebt) revert StrategyWithdrawShortfall(currentDebt, withdrawn);
            totalDebt -= currentDebt;
            strategyDebt[strategy] = 0;
            emit DebtUpdated(strategy, currentDebt, 0);
        }

        activeStrategies[strategy] = false;
        totalStrategyWeight -= strategyWeights[strategy];
        strategyWeights[strategy] = 0;

        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            if (strategyList[i] == strategy) {
                strategyList[i] = strategyList[length - 1];
                strategyList.pop();
                break;
            }
        }

        _removeFromQueue(strategy);
        emit StrategyRemoved(strategy);
    }

    // FIX: M-02 — force-remove a strategy even when withdrawal has shortfall
    function forceRemoveStrategy(address strategy) external onlyDelegateCall {
        if (!activeStrategies[strategy]) revert StrategyNotActive();
        _ejectStrategyFromList(strategy);
    }

    function reinstateImpairedStrategy(address strategy, uint256 epochId) external onlyDelegateCall {
        if (!_isStrategyListed(strategy)) revert StrategyNotActive();
        if (!strategyImpaired[strategy]) revert StrategyNotActive();
        if (impairmentEpochs[epochId].strategy != strategy) revert StrategyNotActive();
        if (impairmentEpochs[epochId].status != ImpairmentEpochStatus.Resolved) revert StrategyNotActive();
        strategyImpaired[strategy] = false;
        emit ImpairedStrategyReinstated(strategy, epochId);
    }

    /// @notice Best-effort unwind + list/queue removal for valuation-disabled strategies (core module only).
    function __ejectDisabledStrategy(address strategy) external onlyDelegateCall {
        _ejectStrategyFromList(strategy);
    }

    function _ejectStrategyFromList(address strategy) internal {
        if (!_isStrategyListed(strategy)) revert StrategyNotActive();

        if (activeStrategies[strategy]) {
            totalStrategyWeight -= strategyWeights[strategy];
            activeStrategies[strategy] = false;
            strategyWeights[strategy] = 0;
        } else if (strategyWeights[strategy] > 0) {
            totalStrategyWeight -= strategyWeights[strategy];
            strategyWeights[strategy] = 0;
        }

        uint256 currentDebt = strategyDebt[strategy];
        if (currentDebt > 0) {
            IERC20 coin = _creatorCoin();
            uint256 beforeBal = coin.balanceOf(address(this));
            try IStrategy(strategy).withdraw(currentDebt) returns (uint256) {} catch {
                try IStrategy(strategy).emergencyWithdraw() returns (uint256) {} catch {}
            }
            uint256 afterBal = coin.balanceOf(address(this));
            coinBalance = afterBal;

            totalDebt -= currentDebt;
            strategyDebt[strategy] = 0;
            emit DebtUpdated(strategy, currentDebt, 0);

            if (strategyImpaired[strategy] && impairmentRecoveryEscrow != address(0) && afterBal > beforeBal) {
                uint256 recovered = afterBal - beforeBal;
                uint256 epochId = _findLatestEpochForStrategy(strategy);
                if (epochId != 0) {
                    coin.safeTransfer(impairmentRecoveryEscrow, recovered);
                    ICreatorORecoveryEscrowStrategyModule(impairmentRecoveryEscrow).notifyRecovery(
                        address(coin), epochId, recovered
                    );
                    coinBalance = coin.balanceOf(address(this));
                }
            }
        }

        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            if (strategyList[i] == strategy) {
                strategyList[i] = strategyList[length - 1];
                strategyList.pop();
                break;
            }
        }

        _removeFromQueue(strategy);
        emit StrategyRemoved(strategy);
    }

    function _isStrategyListed(address strategy) internal view returns (bool) {
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            if (strategyList[i] == strategy) return true;
        }
        return false;
    }

    function updateStrategyWeight(address strategy, uint256 newWeight) external onlyDelegateCall {
        if (!activeStrategies[strategy]) revert StrategyNotActive();
        if (newWeight > MAX_BPS) revert InvalidWeight();

        uint256 oldWeight = strategyWeights[strategy];
        uint256 newTotal = totalStrategyWeight - oldWeight + newWeight;
        if (newTotal > MAX_BPS) revert InvalidWeight();

        strategyWeights[strategy] = newWeight;
        totalStrategyWeight = newTotal;
    }

    // =================================
    // DEPLOY / WITHDRAW (INTERNAL HELPERS)
    // =================================

    function _syncCoinBalance() internal returns (uint256 actual) {
        IERC20 coin = _creatorCoin();
        actual = coin.balanceOf(address(this));
        coinBalance = actual;
    }

    /// @dev Strategy deposit accounting is based on measured vault outflow (`spent`),
    ///      not strategy-reported values, so fee-on-transfer and partial-spend
    ///      strategy internals do not brick keeper deploys.
    function _depositIntoStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 deposited) {
        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));
        coin.forceApprove(strategy, amount);
        IStrategy(strategy).deposit(amount);
        uint256 afterBal = coin.balanceOf(address(this));

        if (afterBal > beforeBal) revert TransferAmountMismatch(amount, 0);
        uint256 spent = beforeBal - afterBal;
        if (spent > amount) revert TransferAmountMismatch(amount, spent);

        deposited = spent;
        coinBalance = afterBal;
    }

    function _withdrawFromStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 withdrawn) {
        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));
        withdrawn = IStrategy(strategy).withdraw(amount);
        uint256 afterBal = coin.balanceOf(address(this));

        uint256 received = afterBal - beforeBal;
        if (received != withdrawn) revert TransferAmountMismatch(withdrawn, received);

        coinBalance = afterBal;
    }

    /// @dev FIX: M-09 — best-effort withdraw used on the user-facing withdrawal hot path.
    ///      A hostile or temporarily-illiquid strategy must not be able to freeze vault
    ///      withdrawals. On revert or measured/reported mismatch we emit
    ///      `StrategyWithdrawFailed` and fall through with 0/received — the caller
    ///      (`_withdrawFromStrategies`) continues to the next strategy in the queue, and
    ///      the vault's core module still reverts with `InsufficientBalance` if the
    ///      aggregate shortfall can't be met. Strict accounting remains on
    ///      `_withdrawFromStrategyMeasured` for admin flows (`removeStrategy`).
    ///
    ///      FIX: M-09 Codex review (PR #357) — negative balance deltas (strategy
    ///      DECREASED the vault's balance, e.g. via leftover allowance) must be
    ///      treated as a failed leg instead of subtracted blindly. Prior version
    ///      underflowed on `afterBalRevert - beforeBal` and re-bricked the user's
    ///      withdraw, defeating the entire M-09 best-effort fix. Both the revert
    ///      path and the success-with-lying-report path now guard this.
    function _tryWithdrawFromStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 withdrawn) {
        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));

        uint256 reported;
        try IStrategy(strategy).withdraw(amount) returns (uint256 _reported) {
            reported = _reported;
        } catch (bytes memory revertData) {
            emit StrategyWithdrawFailed(strategy, amount, revertData);
            // Strategy may have moved funds before reverting. Sync `coinBalance`
            // to the observed value and return the positive delta (if any). A
            // NEGATIVE delta means the strategy pulled tokens out of the vault
            // (e.g. via stale allowance from a prior deposit) before reverting;
            // that is a failed leg from the user's perspective — sync state,
            // keep the event record, and return 0 so the queue moves on.
            uint256 afterBalRevert = coin.balanceOf(address(this));
            coinBalance = afterBalRevert;
            if (afterBalRevert > beforeBal) {
                return afterBalRevert - beforeBal;
            }
            return 0;
        }

        uint256 afterBal = coin.balanceOf(address(this));
        coinBalance = afterBal;

        if (afterBal < beforeBal) {
            // Strategy returned a success value but our balance went DOWN —
            // the strategy is lying about having withdrawn when it actually
            // drained the vault. Treat as failed leg: sync state (already
            // done), emit, return 0. Do NOT revert the user's withdrawal —
            // the caller will continue to the next strategy and the aggregate
            // `InsufficientBalance` check still protects the user.
            emit StrategyWithdrawFailed(
                strategy,
                amount,
                abi.encodeWithSelector(TransferAmountMismatch.selector, reported, 0)
            );
            return 0;
        }

        uint256 received = afterBal - beforeBal;

        if (received != reported) {
            // Report the mismatch via the existing failure event — the strategy's
            // accounting disagrees with measured transfer. Do NOT revert the user's
            // withdrawal; trust the measured `received` amount and move on.
            emit StrategyWithdrawFailed(
                strategy,
                amount,
                abi.encodeWithSelector(TransferAmountMismatch.selector, reported, received)
            );
            return received;
        }

        return reported;
    }

    function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets) {
        if (strategyImpaired[strategy]) return 0;
        try IStrategy(strategy).getTotalAssets() returns (uint256 reportedAssets) {
            assets = reportedAssets;
        } catch {
            assets = strategyDebt[strategy];
        }

        // Governance cap clamp — see CreatorOVault.strategyMaxAssets.
        uint256 cap = strategyMaxAssets[strategy];
        if (cap != 0 && assets > cap) {
            assets = cap;
        }
    }

    function __withdrawFromStrategies(uint256 amountNeeded) external onlyDelegateCall returns (uint256 totalWithdrawn) {
        totalWithdrawn = _withdrawFromStrategies(amountNeeded);
    }

    function _withdrawFromStrategies(uint256 amountNeeded) internal returns (uint256 totalWithdrawn) {
        uint256 remaining = amountNeeded;
        address[] memory queue = useDefaultQueue && defaultQueue.length > 0 ? defaultQueue : strategyList;
        uint256 length = queue.length;

        for (uint256 i = 0; i < length && remaining > 0; i++) {
            address strategy = queue[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy]) continue;

            uint256 currentDebt = strategyDebt[strategy];
            uint256 strategyAssets = _getStrategyAssetsSafe(strategy);
            if (strategyAssets == 0) continue;

            uint256 toWithdraw = remaining > strategyAssets ? strategyAssets : remaining;
            uint256 unrealizedLoss = _assessUnrealisedLoss(strategy, currentDebt, toWithdraw);
            if (unrealizedLoss > 0) {
                emit UnrealisedLossAssessed(strategy, unrealizedLoss);
            }

            // FIX: M-09 — user-facing withdrawal path is best-effort per strategy.
            // A reverting/illiquid strategy is skipped (via `_tryWithdrawFromStrategyMeasured`)
            // instead of bubbling up and freezing the entire withdrawal queue.
            uint256 balanceBefore = _creatorCoin().balanceOf(address(this));
            uint256 withdrawn = _tryWithdrawFromStrategyMeasured(strategy, toWithdraw);
            uint256 balanceAfter = _creatorCoin().balanceOf(address(this));

            if (withdrawn == 0) {
                // If a hostile strategy drained idle funds while reporting failure, the
                // user-facing deficit grew. Ask later queue strategies to cover the new gap.
                if (balanceAfter < balanceBefore) {
                    remaining += balanceBefore - balanceAfter;
                }
                continue;
            }

            totalWithdrawn += withdrawn;
            remaining = remaining > withdrawn ? remaining - withdrawn : 0;

            uint256 debtReduction = withdrawn > currentDebt ? currentDebt : withdrawn;
            uint256 newDebt = currentDebt - debtReduction;
            strategyDebt[strategy] = newDebt;
            totalDebt -= debtReduction;

            emit DebtUpdated(strategy, currentDebt, newDebt);
            emit StrategyWithdrawn(strategy, withdrawn);
        }
    }

    function _assessUnrealisedLoss(address strategy, uint256 currentDebt, uint256 assetsNeeded)
        internal
        view
        returns (uint256)
    {
        uint256 strategyAssets = _getStrategyAssetsSafe(strategy);
        if (strategyAssets >= currentDebt || currentDebt == 0) return 0;

        uint256 numerator = assetsNeeded * strategyAssets;
        uint256 lossShare = assetsNeeded - (numerator / currentDebt);
        if (numerator % currentDebt != 0) lossShare += 1;
        return lossShare;
    }

    function __autoAllocateToStrategy() external onlyDelegateCall {
        _autoAllocateToStrategy();
    }

    function _autoAllocateToStrategy() internal {
        if (defaultQueue.length == 0) return;

        address firstStrategy = defaultQueue[0];
        if (!activeStrategies[firstStrategy]) return;

        uint256 idleBalance = _syncCoinBalance();

        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        if (idleBalance <= minIdle) return;

        uint256 toAllocate = idleBalance - minIdle;
        if (toAllocate == 0) return;

        uint256 currentDebt = strategyDebt[firstStrategy];
        uint256 deposited = _depositIntoStrategyMeasured(firstStrategy, toAllocate);

        uint256 newDebt = currentDebt + deposited;
        strategyDebt[firstStrategy] = newDebt;
        totalDebt += deposited;

        emit DebtUpdated(firstStrategy, currentDebt, newDebt);
        emit AutoAllocated(firstStrategy, deposited);
    }

    // =================================
    // ALLOCATION (KEEPER / MANAGEMENT)
    // =================================

    function tend() external onlyDelegateCall {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        uint256 idleBalance = _syncCoinBalance();
        if (idleBalance > deploymentThreshold && totalStrategyWeight > 0) {
            _deployToStrategies();
        }
    }

    function deployToStrategies() external onlyDelegateCall {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        _deployToStrategies();
    }

    function forceDeployToStrategies() external onlyDelegateCall {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        if (totalStrategyWeight == 0) revert NoStrategies();
        _deployToStrategies();
    }

    /// @notice Pull overweight strategy TVL back to idle, then redeploy by weight.
    /// @dev Cross-strategy moves always route vault idle — strategies never transfer directly.
    /// @param minDeviationBps Minimum overweight drift (bps of target) before withdrawing excess.
    function rebalanceStrategies(uint256 minDeviationBps) external onlyDelegateCall {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        if (totalStrategyWeight == 0) revert NoStrategies();
        if (minDeviationBps > MAX_BPS) revert InvalidWeight();

        _syncCoinBalance();

        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        uint256 totalAssets = _sumActiveStrategyAssets(coinBalance);
        uint256 deployableBase = totalAssets > minIdle ? totalAssets - minIdle : 0;

        uint256 totalWithdrawn;
        uint256 totalRedeployed;

        if (deployableBase > 0) {
            address[] memory queue =
                useDefaultQueue && defaultQueue.length > 0 ? defaultQueue : strategyList;
            uint256 queueLength = queue.length;

            for (uint256 i = 0; i < queueLength; i++) {
                address strategy = queue[i];
                if (!activeStrategies[strategy] || strategyImpaired[strategy] || strategyWeights[strategy] == 0) continue;

                uint256 targetAssets = (deployableBase * strategyWeights[strategy]) / totalStrategyWeight;
                uint256 actualAssets = _getStrategyAssetsSafe(strategy);
                if (actualAssets <= targetAssets) continue;

                uint256 excess = actualAssets - targetAssets;
                if (targetAssets > 0) {
                    uint256 driftThreshold = (targetAssets * minDeviationBps) / MAX_BPS;
                    if (excess <= driftThreshold) continue;
                } else if (minDeviationBps > 0) {
                    continue;
                }

                uint256 currentDebt = strategyDebt[strategy];
                uint256 withdrawn = _tryWithdrawFromStrategyMeasured(strategy, excess);
                if (withdrawn == 0) continue;

                totalWithdrawn += withdrawn;

                uint256 debtReduction = withdrawn > currentDebt ? currentDebt : withdrawn;
                uint256 newDebt = currentDebt - debtReduction;
                strategyDebt[strategy] = newDebt;
                totalDebt -= debtReduction;

                emit DebtUpdated(strategy, currentDebt, newDebt);
                emit StrategyWithdrawn(strategy, withdrawn);
            }
        }

        uint256 idleBeforeDeploy = _syncCoinBalance();
        if (idleBeforeDeploy > minIdle) {
            totalRedeployed = _deployUnderweightStrategies(deployableBase, minIdle);
        }

        emit StrategiesRebalanced(totalWithdrawn, totalRedeployed);
    }

    function _deployUnderweightStrategies(uint256 deployableBase, uint256 minIdle)
        internal
        returns (uint256 totalDeposited)
    {
        if (deployableBase == 0 || totalStrategyWeight == 0) return 0;

        uint256 idleBalance = _syncCoinBalance();
        uint256 deployable = idleBalance > minIdle ? idleBalance - minIdle : 0;
        if (deployable == 0) return 0;

        uint256 underweightWeight;
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy] || strategyWeights[strategy] == 0) continue;

            uint256 targetAssets = (deployableBase * strategyWeights[strategy]) / totalStrategyWeight;
            uint256 actualAssets = _getStrategyAssetsSafe(strategy);
            if (actualAssets < targetAssets) {
                underweightWeight += strategyWeights[strategy];
            }
        }

        if (underweightWeight == 0) return 0;

        for (uint256 i = 0; i < length && deployable > 0; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy] || strategyWeights[strategy] == 0) continue;

            uint256 targetAssets = (deployableBase * strategyWeights[strategy]) / totalStrategyWeight;
            uint256 actualAssets = _getStrategyAssetsSafe(strategy);
            if (actualAssets >= targetAssets) continue;

            uint256 deficit = targetAssets - actualAssets;
            uint256 weightedSlice = (deployable * strategyWeights[strategy]) / underweightWeight;
            uint256 amount = weightedSlice > deficit ? deficit : weightedSlice;
            if (amount > coinBalance) amount = coinBalance;
            if (amount == 0) continue;

            uint256 currentDebt = strategyDebt[strategy];
            uint256 deposited = _depositIntoStrategyMeasured(strategy, amount);
            if (deposited == 0) continue;

            totalDeposited += deposited;
            deployable = deployable > deposited ? deployable - deposited : 0;

            uint256 newDebt = currentDebt + deposited;
            strategyDebt[strategy] = newDebt;
            totalDebt += deposited;

            emit DebtUpdated(strategy, currentDebt, newDebt);
            emit StrategyDeployed(strategy, deposited);
        }

        if (totalDeposited > 0) {
            lastDeployment = block.timestamp;
        }
    }

    function _sumActiveStrategyAssets(uint256 idleBalance) internal view returns (uint256 total) {
        total = idleBalance;
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy] && !strategyImpaired[strategy]) {
                total += _getStrategyAssetsSafe(strategy);
            }
        }
    }

    function _deployToStrategies() internal {
        if (totalStrategyWeight == 0) return;

        uint256 idleBalance = _syncCoinBalance();
        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        uint256 deployable = idleBalance > minIdle ? idleBalance - minIdle : 0;
        if (deployable == 0) return;

        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy] || strategyWeights[strategy] == 0) continue;

            uint256 amount = (deployable * strategyWeights[strategy]) / totalStrategyWeight;
            if (amount > coinBalance) amount = coinBalance;
            if (amount == 0) continue;

            uint256 currentDebt = strategyDebt[strategy];
            uint256 deposited = _depositIntoStrategyMeasured(strategy, amount);

            uint256 newDebt = currentDebt + deposited;
            strategyDebt[strategy] = newDebt;
            totalDebt += deposited;

            emit DebtUpdated(strategy, currentDebt, newDebt);
            emit StrategyDeployed(strategy, deposited);
        }

        lastDeployment = block.timestamp;
    }

    // =================================
    // QUEUE MANAGEMENT
    // =================================

    function setDefaultQueue(address[] calldata newQueue) external onlyDelegateCall {
        if (newQueue.length > MAX_QUEUE) revert QueueTooLong(newQueue.length, MAX_QUEUE);

        for (uint256 i = 0; i < newQueue.length; i++) {
            if (!activeStrategies[newQueue[i]]) revert StrategyNotActive();
        }

        defaultQueue = newQueue;
        emit UpdateDefaultQueue(newQueue);
    }

    function setUseDefaultQueue(bool _useDefaultQueue) external onlyDelegateCall {
        useDefaultQueue = _useDefaultQueue;
        emit UpdateUseDefaultQueue(_useDefaultQueue);
    }

    function setAutoAllocate(bool _autoAllocate) external onlyDelegateCall {
        autoAllocate = _autoAllocate;
        emit UpdateAutoAllocate(_autoAllocate);
    }

    function setMinimumTotalIdle(uint256 _minimumTotalIdle) external onlyDelegateCall {
        minimumTotalIdle = _minimumTotalIdle;
        emit UpdateMinimumTotalIdle(_minimumTotalIdle);
    }

    // =================================
    // DEBT PURCHASING
    // =================================

    function setDebtPurchaser(address _debtPurchaser) external onlyDelegateCall {
        debtPurchaser = _debtPurchaser;
        emit UpdateDebtPurchaser(_debtPurchaser);
    }

    function buyDebt(address strategy, uint256 amount) external onlyDelegateCall {
        if (!activeStrategies[strategy] && !strategyImpaired[strategy]) revert StrategyNotActive();

        uint256 currentDebt = strategyDebt[strategy];
        if (currentDebt == 0) revert NothingToBuy();
        if (amount == 0) revert NothingToBuy();

        uint256 _amount = amount > currentDebt ? currentDebt : amount;

        // Buyer sends Creator Coin to vault
        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));
        coin.safeTransferFrom(msg.sender, address(this), _amount);
        uint256 afterBal = coin.balanceOf(address(this));

        uint256 received = afterBal - beforeBal;
        if (received != _amount) revert TransferAmountMismatch(_amount, received);
        coinBalance = afterBal;

        uint256 newDebt = currentDebt - _amount;
        strategyDebt[strategy] = newDebt;
        totalDebt -= _amount;

        if (strategyImpaired[strategy] && impairmentRecoveryEscrow != address(0)) {
            uint256 epochId = _findLatestEpochForStrategy(strategy);
            if (epochId != 0) {
                _creatorCoin().safeTransfer(impairmentRecoveryEscrow, _amount);
                ICreatorORecoveryEscrowStrategyModule(impairmentRecoveryEscrow).notifyRecovery(
                    address(_creatorCoin()), epochId, _amount
                );
                coinBalance = _creatorCoin().balanceOf(address(this));
            }
        }

        emit DebtUpdated(strategy, currentDebt, newDebt);
        emit DebtPurchased(strategy, _amount, msg.sender);
    }

    function assessUnrealisedLosses(address strategy, uint256 assetsNeeded)
        external
        view
        onlyDelegateCall
        returns (uint256)
    {
        uint256 currentDebt = strategyDebt[strategy];
        return _assessUnrealisedLoss(strategy, currentDebt, assetsNeeded);
    }

    // =================================
    // INTERNAL
    // =================================

    function _removeFromQueue(address strategy) internal {
        uint256 queueLength = defaultQueue.length;
        for (uint256 i = 0; i < queueLength; i++) {
            if (defaultQueue[i] == strategy) {
                defaultQueue[i] = defaultQueue[queueLength - 1];
                defaultQueue.pop();
                emit UpdateDefaultQueue(defaultQueue);
                break;
            }
        }
    }

    function _findLatestEpochForStrategy(address strategy) internal view returns (uint256 epochId) {
        uint256 maxEpoch = nextImpairmentEpochId;
        while (maxEpoch > 1) {
            unchecked {
                --maxEpoch;
            }
            if (impairmentEpochs[maxEpoch].strategy == strategy) {
                return maxEpoch;
            }
        }
        if (activeImpairmentEpoch != 0 && impairmentEpochs[activeImpairmentEpoch].strategy == strategy) {
            return activeImpairmentEpoch;
        }
        return 0;
    }
}
