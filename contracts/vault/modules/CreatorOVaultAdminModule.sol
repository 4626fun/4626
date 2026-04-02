// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";

import {CreatorOVaultModuleBase} from "./CreatorOVaultModuleBase.sol";
import {ICreatorOVaultModuleIdentity} from "./ICreatorOVaultModuleIdentity.sol";

/// @notice Admin + emergency + rescue + config logic for CreatorOVault.
/// @dev Must be invoked via delegatecall from CreatorOVault.
contract CreatorOVaultAdminModule is CreatorOVaultModuleBase, ICreatorOVaultModuleIdentity {
    using SafeERC20 for IERC20;
    bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.admin");
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v1");

    // ---- constants (must match vault) ----
    uint256 internal constant MAX_BPS = 10_000;
    uint16 internal constant MAX_FEE = 2_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    uint64 internal constant MIN_RESCUE_DELAY = 1 days;
    uint64 internal constant MAX_RESCUE_DELAY = 30 days;

    // ---- events (must match vault signatures) ----
    event UpdateManagement(address indexed newManagement);
    event UpdatePendingManagement(address indexed newPendingManagement);
    event UpdateKeeper(address indexed newKeeper);
    event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);
    event UpdateGaugeController(address indexed oldController, address indexed newController);
    event UpdatePerformanceFee(uint16 newPerformanceFee);
    event UpdatePerformanceFeeRecipient(address indexed newRecipient);
    event UpdateProfitMaxUnlockTime(uint256 newProfitMaxUnlockTime);
    event UpdateTrustedPpsDeviationBps(uint256 newTrustedPpsDeviationBps);

    event BalancesSynced(uint256 coinBalance);
    event WhitelistEnabled(bool enabled);
    event WhitelistUpdated(address indexed account, bool status);
    event EmergencyPause(bool paused);
    event VaultShutdown();
    event EmergencyWithdraw(address indexed to, uint256 amount);

    event RescueConfigured(address indexed rescue, uint64 delay);
    event RescueInitiated(address indexed oldOwner, address indexed newOwner, uint64 unlockTime);
    event RescueCancelled(address indexed oldOwner);
    event RescueFinalized(address indexed oldOwner, address indexed newOwner);

    // ---- errors (must match vault selectors) ----
    error ZeroAddress();
    error Unauthorized();
    error InvalidAmount();
    error VaultNotShutdown();
    error RescueNotConfigured();
    error RescueDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
    error RescueAlreadyPending(address pendingOwner);
    error RescueNotPending();
    error RescueTooEarly(uint64 unlockTime);
    error InvalidRescueOwner(address newOwner);
    error MaxTotalSupplyBelowCurrent(uint256 provided, uint256 current);
    error TooManyBlocks(uint256 provided, uint256 max);
    error CannotRescueCreatorCoin();
    error ETHTransferFailed();

    // =================================
    // EMERGENCY CONTROLS
    // =================================

    function moduleKind() external pure returns (bytes32) {
        return MODULE_KIND;
    }

    function moduleStorageVersion() external pure returns (bytes32) {
        return MODULE_STORAGE_VERSION;
    }

    function shutdownVault() external onlyDelegateCall {
        isShutdown = true;
        emit VaultShutdown();
    }

    function emergencyWithdrawFromStrategies() external onlyDelegateCall {
        IERC20 coin = _creatorCoin();
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy]) continue;

            uint256 beforeBal = coin.balanceOf(address(this));
            try IStrategy(strategy).emergencyWithdraw() returns (uint256) {
                uint256 afterBal = coin.balanceOf(address(this));
                if (afterBal >= beforeBal) {
                    coinBalance = afterBal;
                } else {
                    coinBalance = coin.balanceOf(address(this));
                }
            } catch {}
        }
    }

    function emergencyWithdraw(uint256 amount, address to) external onlyDelegateCall {
        if (!isShutdown) revert VaultNotShutdown();
        if (to == address(0)) revert ZeroAddress();

        IERC20 coin = _creatorCoin();
        if (amount > 0) {
            coin.safeTransfer(to, amount);
        }
        coinBalance = coin.balanceOf(address(this));

        emit EmergencyWithdraw(to, amount);
    }

    function setPaused(bool _paused) external onlyDelegateCall {
        paused = _paused;
        emit EmergencyPause(_paused);
    }

    // =================================
    // ADMIN FUNCTIONS
    // =================================

    function setGaugeController(address _gaugeController) external onlyDelegateCall {
        address old = gaugeController;
        gaugeController = _gaugeController;
        emit UpdateGaugeController(old, _gaugeController);
    }

    function setBurnStream(address _burnStream) external onlyDelegateCall {
        if (_burnStream == address(0)) revert ZeroAddress();
        if (burnStream != address(0)) revert Unauthorized();
        burnStream = _burnStream;
    }

    function setKeeper(address _keeper) external onlyDelegateCall {
        if (_keeper == address(0)) revert ZeroAddress();
        keeper = _keeper;
        emit UpdateKeeper(_keeper);
    }

    function setEmergencyAdmin(address _emergencyAdmin) external onlyDelegateCall {
        if (_emergencyAdmin == address(0)) revert ZeroAddress();
        emergencyAdmin = _emergencyAdmin;
        emit UpdateEmergencyAdmin(_emergencyAdmin);
    }

    function setWhitelistEnabled(bool _enabled) external onlyDelegateCall {
        whitelistEnabled = _enabled;
        emit WhitelistEnabled(_enabled);
    }

    function setWhitelist(address _account, bool _status) external onlyDelegateCall {
        if (_account == address(0)) revert ZeroAddress();
        whitelist[_account] = _status;
        emit WhitelistUpdated(_account, _status);
    }

    function setWhitelistBatch(address[] calldata _accounts, bool _status) external onlyDelegateCall {
        for (uint256 i = 0; i < _accounts.length; i++) {
            if (_accounts[i] == address(0)) revert ZeroAddress();
            whitelist[_accounts[i]] = _status;
            emit WhitelistUpdated(_accounts[i], _status);
        }
    }

    // =================================
    // PROTOCOL-ASSISTED OWNERSHIP RESCUE
    // =================================

    function setProtocolRescue(address rescue) external onlyDelegateCall {
        if (pendingRescueOwner != address(0)) revert RescueAlreadyPending(pendingRescueOwner);
        protocolRescue = rescue;
        emit RescueConfigured(rescue, rescueDelay);
    }

    function setRescueDelay(uint64 delay) external onlyDelegateCall {
        if (pendingRescueOwner != address(0)) revert RescueAlreadyPending(pendingRescueOwner);
        if (delay < MIN_RESCUE_DELAY || delay > MAX_RESCUE_DELAY) {
            revert RescueDelayOutOfBounds(delay, MIN_RESCUE_DELAY, MAX_RESCUE_DELAY);
        }
        rescueDelay = delay;
        emit RescueConfigured(protocolRescue, delay);
    }

    function initiateOwnershipRescue(address newOwner) external onlyDelegateCall {
        if (pendingRescueOwner != address(0)) revert RescueAlreadyPending(pendingRescueOwner);
        if (newOwner == address(0) || newOwner == _owner) revert InvalidRescueOwner(newOwner);

        pendingRescueOwner = newOwner;
        uint64 unlockTime = uint64(block.timestamp) + rescueDelay;
        rescueUnlockTime = unlockTime;

        emit RescueInitiated(_owner, newOwner, unlockTime);
    }

    function cancelOwnershipRescue() external onlyDelegateCall {
        if (pendingRescueOwner == address(0)) revert RescueNotPending();
        pendingRescueOwner = address(0);
        rescueUnlockTime = 0;
        emit RescueCancelled(_owner);
    }

    function finalizeOwnershipRescue() external onlyDelegateCall {
        address newOwner = pendingRescueOwner;
        if (newOwner == address(0)) revert RescueNotPending();

        uint64 unlockTime = rescueUnlockTime;
        if (block.timestamp < unlockTime) revert RescueTooEarly(unlockTime);

        address oldOwner = _owner;

        pendingRescueOwner = address(0);
        rescueUnlockTime = 0;

        _transferOwnership(newOwner);
        emit RescueFinalized(oldOwner, newOwner);
    }

    // =================================
    // FEES / ROLES / PARAMS
    // =================================

    function setPerformanceFee(uint16 _performanceFee) external onlyDelegateCall {
        if (_performanceFee > MAX_FEE) revert InvalidAmount();
        performanceFee = _performanceFee;
        emit UpdatePerformanceFee(_performanceFee);
    }

    function setPerformanceFeeRecipient(address _performanceFeeRecipient) external onlyDelegateCall {
        if (_performanceFeeRecipient == address(0)) revert ZeroAddress();
        performanceFeeRecipient = _performanceFeeRecipient;
        emit UpdatePerformanceFeeRecipient(_performanceFeeRecipient);
    }

    function setProfitMaxUnlockTime(uint256 _profitMaxUnlockTime) external onlyDelegateCall {
        if (_profitMaxUnlockTime > SECONDS_PER_YEAR) revert InvalidAmount();
        profitMaxUnlockTime = uint32(_profitMaxUnlockTime);
        emit UpdateProfitMaxUnlockTime(_profitMaxUnlockTime);
    }

    function setTrustedPpsDeviationBps(uint256 _trustedPpsMaxDeviationBps) external onlyDelegateCall {
        if (_trustedPpsMaxDeviationBps > MAX_BPS) revert InvalidAmount();
        trustedPpsMaxDeviationBps = _trustedPpsMaxDeviationBps;
        emit UpdateTrustedPpsDeviationBps(_trustedPpsMaxDeviationBps);
    }

    function setPendingManagement(address _management) external onlyDelegateCall {
        if (_management == address(0)) revert ZeroAddress();
        pendingManagement = _management;
        emit UpdatePendingManagement(_management);
    }

    function acceptManagement() external onlyDelegateCall {
        if (msg.sender != pendingManagement) revert Unauthorized();
        management = pendingManagement;
        pendingManagement = address(0);
        emit UpdateManagement(management);
    }

    function setDeploymentParams(uint256 _threshold, uint256 _interval) external onlyDelegateCall {
        deploymentThreshold = _threshold;
        minDeploymentInterval = _interval;
    }

    function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyDelegateCall {
        uint256 current = _totalSupply;
        if (_maxTotalSupply < current) revert MaxTotalSupplyBelowCurrent(_maxTotalSupply, current);
        maxTotalSupply = _maxTotalSupply;
    }

    function setFlashLoanProtection(
        uint256 _withdrawDelayBlocks,
        uint256 _largeWithdrawalThreshold,
        uint256 _largeWithdrawalDelayBlocks
    ) external onlyDelegateCall {
        if (_withdrawDelayBlocks > 100) revert TooManyBlocks(_withdrawDelayBlocks, 100);
        if (_largeWithdrawalDelayBlocks > 1000) revert TooManyBlocks(_largeWithdrawalDelayBlocks, 1000);

        withdrawDelayBlocks = _withdrawDelayBlocks;
        largeWithdrawalThreshold = _largeWithdrawalThreshold;
        largeWithdrawalDelayBlocks = _largeWithdrawalDelayBlocks;
    }

    // =================================
    // MAINTENANCE / RESCUE
    // =================================

    function syncBalances() external onlyDelegateCall {
        IERC20 coin = _creatorCoin();
        uint256 actual = coin.balanceOf(address(this));
        coinBalance = actual;
        emit BalancesSynced(actual);
    }

    function rescueETH() external onlyDelegateCall {
        uint256 balance = address(this).balance;
        if (balance == 0) return;
        (bool success,) = payable(_owner).call{value: balance}("");
        if (!success) revert ETHTransferFailed();
    }

    function rescueToken(address token, uint256 amount, address to) external onlyDelegateCall {
        if (token == address(_creatorCoin())) revert CannotRescueCreatorCoin();
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }
}

