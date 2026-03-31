// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

import {CreatorOVaultModuleBase} from "./CreatorOVaultModuleBase.sol";

/// @notice Strategy management + strategy interaction logic for CreatorOVault.
/// @dev Must be invoked via delegatecall from CreatorOVault.
contract CreatorOVaultStrategiesModule is CreatorOVaultModuleBase {
    using SafeERC20 for IERC20;

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
    error TransferAmountMismatch(uint256 expected, uint256 actual);
    error StrategyWithdrawShortfall(uint256 expected, uint256 actual);

    // =================================
    // STRATEGY MANAGEMENT
    // =================================

    function addStrategy(address strategy, uint256 weight) external onlyDelegateCall {
        addStrategy(strategy, weight, true);
    }

    function addStrategy(address strategy, uint256 weight, bool addToQueue) public onlyDelegateCall {
        if (strategy == address(0)) revert ZeroAddress();
        if (activeStrategies[strategy]) revert StrategyAlreadyActive();
        if (strategyList.length >= MAX_STRATEGIES) revert MaxStrategiesReached();
        if (weight == 0 || weight > MAX_BPS) revert InvalidWeight();
        if (totalStrategyWeight + weight > MAX_BPS) revert InvalidWeight();

        if (!IStrategy(strategy).isActive()) revert StrategyNotActive();
        address strategyAsset = IStrategy(strategy).asset();
        // NOTE: vault storage doesn't have CREATOR_COIN (immutable); use ERC4626.asset().
        address expected = address(_creatorCoin());
        if (strategyAsset != expected) revert StrategyAssetMismatch(expected, strategyAsset);

        activeStrategies[strategy] = true;
        strategyWeights[strategy] = weight;
        strategyList.push(strategy);
        totalStrategyWeight += weight;

        if (addToQueue && defaultQueue.length < MAX_QUEUE) {
            defaultQueue.push(strategy);
            emit UpdateDefaultQueue(defaultQueue);
        }

        emit StrategyAdded(strategy, weight);
    }

    function removeStrategy(address strategy) external onlyDelegateCall {
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

    function _withdrawFromStrategyBestEffort(address strategy, uint256 amount) internal returns (uint256 withdrawn) {
        if (amount == 0) return 0;

        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));

        try IStrategy(strategy).withdraw(amount) returns (uint256 reported) {
            uint256 afterBal = coin.balanceOf(address(this));

            if (afterBal < beforeBal) {
                _syncCoinBalance();
                emit StrategyWithdrawFailed(strategy, amount, bytes("NEGATIVE_BALANCE_DELTA"));
                return 0;
            }

            uint256 received = afterBal - beforeBal;
            coinBalance = afterBal;

            if (received != reported) {
                emit StrategyWithdrawFailed(
                    strategy, amount, abi.encodeWithSelector(TransferAmountMismatch.selector, reported, received)
                );
            }

            return received;
        } catch (bytes memory err) {
            _syncCoinBalance();
            emit StrategyWithdrawFailed(strategy, amount, err);
            return 0;
        }
    }

    function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets) {
        try IStrategy(strategy).getTotalAssets() returns (uint256 reportedAssets) {
            assets = reportedAssets;
        } catch {
            assets = strategyDebt[strategy];
        }
    }

    function __withdrawFromStrategies(uint256 amountNeeded) external onlyDelegateCall returns (uint256 totalWithdrawn) {
        totalWithdrawn = _withdrawFromStrategies(amountNeeded);
    }

    function _withdrawFromStrategies(uint256 amountNeeded) internal returns (uint256 totalWithdrawn) {
        uint256 remaining = amountNeeded;
        address[] memory queue = defaultQueue.length > 0 ? defaultQueue : strategyList;
        uint256 length = queue.length;

        for (uint256 i = 0; i < length && remaining > 0; i++) {
            address strategy = queue[i];
            if (!activeStrategies[strategy]) continue;

            uint256 currentDebt = strategyDebt[strategy];
            uint256 strategyAssets = _getStrategyAssetsSafe(strategy);
            if (strategyAssets == 0) continue;

            uint256 toWithdraw = remaining > strategyAssets ? strategyAssets : remaining;
            uint256 unrealizedLoss = _assessUnrealisedLoss(strategy, currentDebt, toWithdraw);
            if (unrealizedLoss > 0) {
                emit UnrealisedLossAssessed(strategy, unrealizedLoss);
            }

            uint256 withdrawn = _withdrawFromStrategyBestEffort(strategy, toWithdraw);
            if (withdrawn == 0) continue;

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
        uint256 idleBalance = _syncCoinBalance();
        if (idleBalance > deploymentThreshold && totalStrategyWeight > 0) {
            _deployToStrategies();
        }
    }

    function deployToStrategies() external onlyDelegateCall {
        _deployToStrategies();
    }

    function forceDeployToStrategies() external onlyDelegateCall {
        if (totalStrategyWeight == 0) revert NoStrategies();
        _deployToStrategies();
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
            if (!activeStrategies[strategy] || strategyWeights[strategy] == 0) continue;

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
        if (!activeStrategies[strategy]) revert StrategyNotActive();

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
}

