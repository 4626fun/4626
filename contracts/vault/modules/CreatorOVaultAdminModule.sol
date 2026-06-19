// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";

import {CreatorOVaultModuleBase} from "./CreatorOVaultModuleBase.sol";
import {ICreatorOVaultModuleIdentity} from "./ICreatorOVaultModuleIdentity.sol";

interface IVaultShareBurnStreamQueuer {
    function setAuthorizedQueuer(address queuer, bool authorized) external;
}

/// @notice Admin + emergency + rescue + config logic for CreatorOVault.
/// @dev Must be invoked via delegatecall from CreatorOVault.
contract CreatorOVaultAdminModule is CreatorOVaultModuleBase, ICreatorOVaultModuleIdentity {
    using SafeERC20 for IERC20;
    bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.admin");
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3");

    // ---- constants (must match vault) ----
    uint256 internal constant MAX_BPS = 10_000;
    uint16 internal constant MAX_FEE = 2_000;
    uint16 internal constant MAX_MANAGEMENT_FEE = 500;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    uint64 internal constant MIN_RISK_CONFIG_DELAY = 1 days;
    uint64 internal constant MAX_RISK_CONFIG_DELAY = 30 days;

    uint8 internal constant RISK_KIND_NONE = 0;
    uint8 internal constant RISK_KIND_PERFORMANCE_FEE = 1;
    uint8 internal constant RISK_KIND_MANAGEMENT_FEE = 2;
    uint8 internal constant RISK_KIND_STRATEGY_MAX_ASSETS = 3;
    uint8 internal constant RISK_KIND_MANAGEMENT_FEE_RECIPIENT = 4;
    uint8 internal constant MAX_VALUATION_MISS_THRESHOLD = 30;
    uint64 internal constant MIN_RESCUE_DELAY = 1 days;
    uint64 internal constant MAX_RESCUE_DELAY = 30 days;

    // ---- events (must match vault signatures) ----
    event UpdateManagement(address indexed newManagement);
    event UpdatePendingManagement(address indexed newPendingManagement);
    event UpdateKeeper(address indexed newKeeper);
    event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);
    event UpdateGaugeController(address indexed oldController, address indexed newController);
    event UpdateCcaLaunchStrategy(address indexed oldStrategy, address indexed newStrategy);
    event UpdateBurnStream(address indexed oldBurnStream, address indexed newBurnStream);
    event BurnStreamQueuerUpdated(address indexed queuer, bool authorized);
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
    event RescueDisabled();
    event RescueInitiated(address indexed oldOwner, address indexed newOwner, uint64 unlockTime);
    event RescueCancelled(address indexed oldOwner);
    event RescueFinalized(address indexed oldOwner, address indexed newOwner);

    event UpdateStrategyMaxAssets(address indexed strategy, uint256 oldCap, uint256 newCap);
    event UpdateManagementFee(uint16 newManagementFee);
    event UpdateManagementFeeRecipient(address indexed newRecipient);
    event UpdateRiskConfigDelay(uint64 newDelay);
    event RiskConfigScheduled(uint8 kind, address indexed target, uint256 value, uint64 unlockTime);
    event RiskConfigExecuted(uint8 kind, address indexed target, uint256 value);
    event RiskConfigCancelled(uint8 kind);
    event UpdateValuationMissThreshold(uint8 newThreshold);
    event ImpairmentGuardianUpdated(address indexed guardian);
    event ImpairmentClaimsUpdated(address indexed claims);
    event ImpairmentRecoveryEscrowUpdated(address indexed escrow);

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
    error RiskConfigDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
    error PendingRiskConfigExists(uint8 kind);
    error NoPendingRiskConfig();
    error RiskConfigTooEarly(uint64 unlockTime);
    error InvalidRiskConfigKind(uint8 kind);
    error InvalidImpairmentConfig(address provided);

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

    // slither-disable-next-line uninitialized-state
    function emergencyWithdrawFromStrategies() external onlyDelegateCall {
        IERC20 coin = _creatorCoin();
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy]) continue;

            uint256 beforeBal = coin.balanceOf(address(this));
            try IStrategy(strategy).emergencyWithdraw() returns (uint256) {
                uint256 afterBal = coin.balanceOf(address(this));
                // FIX: L-02 — simplify balance tracking, remove redundant balanceOf call
                coinBalance = afterBal;

                // FIX: H-02 — update strategyDebt and totalDebt to prevent double-counting
                if (afterBal >= beforeBal) {
                    uint256 recovered = afterBal - beforeBal;
                    uint256 debt = strategyDebt[strategy];
                    uint256 reduction = recovered > debt ? debt : recovered;
                    strategyDebt[strategy] -= reduction;
                    totalDebt -= reduction;
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

    /// @notice Link/unlink the vault's CCA strategy used for auction-time deposit gating.
    /// @dev Zero address clears the gate linkage.
    function setCCALaunchStrategy(address _ccaLaunchStrategy) external onlyDelegateCall {
        address old = ccaLaunchStrategy;
        ccaLaunchStrategy = _ccaLaunchStrategy;
        emit UpdateCcaLaunchStrategy(old, _ccaLaunchStrategy);
    }

    /**
     * @notice Update the vault's burn stream address.
     * @dev FIX: L-01 (4626-349) — previously one-time-set. Once the initial
     *      non-zero burn stream was wired, any future override required a
     *      full vault migration. If the Charm/gauge infra upgrades the
     *      burn stream contract, this is operationally expensive.
     *
     *      Override now permitted via the same onlyDelegateCall gate that
     *      governs every other admin setter in this module. The call still
     *      runs through the vault's management/multisig path (see
     *      CreatorOVaultRescueModule / `onlyDelegateCall` construction), so
     *      unilateral overrides from an EOA are not possible. A governance
     *      timelock should enforce the delay at that layer; we deliberately
     *      do NOT add a second timelock here so the setter shape matches
     *      every other `set*` in this module.
     *
     *      Emits UpdateBurnStream(oldBurnStream, newBurnStream).
     */
    function setBurnStream(address _burnStream) external onlyDelegateCall {
        if (_burnStream == address(0)) revert ZeroAddress();
        address old = burnStream;
        burnStream = _burnStream;
        emit UpdateBurnStream(old, _burnStream);
    }

    /// @notice Authorize or revoke a burn-stream share queuer (for example PayoutRouter).
    /// @dev Only the vault may call `VaultShareBurnStream.setAuthorizedQueuer`; this bridges owner intent.
    function setBurnStreamAuthorizedQueuer(address queuer, bool authorized) external onlyDelegateCall {
        if (queuer == address(0)) revert ZeroAddress();
        if (burnStream == address(0)) revert ZeroAddress();
        IVaultShareBurnStreamQueuer(burnStream).setAuthorizedQueuer(queuer, authorized);
        emit BurnStreamQueuerUpdated(queuer, authorized);
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
        // FIX: L-05 — emit distinct event when rescue mechanism is disabled
        if (rescue == address(0)) {
            emit RescueDisabled();
        } else {
            emit RescueConfigured(rescue, rescueDelay);
        }
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
        // FIX: M-06 — enforce minimum rescue delay at initiation time
        if (rescueDelay < MIN_RESCUE_DELAY) revert RescueDelayOutOfBounds(rescueDelay, MIN_RESCUE_DELAY, MAX_RESCUE_DELAY);

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
        _scheduleRiskChange(RISK_KIND_PERFORMANCE_FEE, address(0), _performanceFee);
    }

    function scheduleSetPerformanceFee(uint16 _performanceFee) external onlyDelegateCall {
        _scheduleRiskChange(RISK_KIND_PERFORMANCE_FEE, address(0), _performanceFee);
    }

    function scheduleSetManagementFee(uint16 _managementFee) external onlyDelegateCall {
        if (_managementFee > MAX_MANAGEMENT_FEE) revert InvalidAmount();
        _scheduleRiskChange(RISK_KIND_MANAGEMENT_FEE, address(0), _managementFee);
    }

    function scheduleSetStrategyMaxAssets(address strategy, uint256 cap) external onlyDelegateCall {
        if (strategy == address(0)) revert ZeroAddress();
        _scheduleRiskChange(RISK_KIND_STRATEGY_MAX_ASSETS, strategy, cap);
    }

    function scheduleSetManagementFeeRecipient(address recipient) external onlyDelegateCall {
        if (recipient == address(0)) revert ZeroAddress();
        _scheduleRiskChange(RISK_KIND_MANAGEMENT_FEE_RECIPIENT, recipient, 0);
    }

    function setManagementFeeRecipient(address recipient) external onlyDelegateCall {
        if (recipient == address(0)) revert ZeroAddress();
        _scheduleRiskChange(RISK_KIND_MANAGEMENT_FEE_RECIPIENT, recipient, 0);
    }

    function executePendingRiskConfig() external onlyDelegateCall {
        if (pendingRiskKind == RISK_KIND_NONE) revert NoPendingRiskConfig();
        if (block.timestamp < pendingRiskUnlockTime) revert RiskConfigTooEarly(pendingRiskUnlockTime);

        uint8 kind = pendingRiskKind;
        address target = pendingRiskTarget;
        uint256 value = pendingRiskValue;

        pendingRiskKind = RISK_KIND_NONE;
        pendingRiskTarget = address(0);
        pendingRiskValue = 0;
        pendingRiskUnlockTime = 0;

        _executeRiskChange(kind, target, value);
        emit RiskConfigExecuted(kind, target, value);
    }

    function cancelPendingRiskConfig() external onlyDelegateCall {
        uint8 kind = pendingRiskKind;
        if (kind == RISK_KIND_NONE) revert NoPendingRiskConfig();
        pendingRiskKind = RISK_KIND_NONE;
        pendingRiskTarget = address(0);
        pendingRiskValue = 0;
        pendingRiskUnlockTime = 0;
        emit RiskConfigCancelled(kind);
    }

    function setRiskConfigDelay(uint64 delay) external onlyDelegateCall {
        if (delay != 0 && (delay < MIN_RISK_CONFIG_DELAY || delay > MAX_RISK_CONFIG_DELAY)) {
            revert RiskConfigDelayOutOfBounds(delay, MIN_RISK_CONFIG_DELAY, MAX_RISK_CONFIG_DELAY);
        }
        riskConfigDelay = delay;
        emit UpdateRiskConfigDelay(delay);
    }

    function setValuationMissThreshold(uint8 threshold) external onlyDelegateCall {
        if (threshold > MAX_VALUATION_MISS_THRESHOLD) revert InvalidAmount();
        valuationMissThreshold = threshold;
        emit UpdateValuationMissThreshold(threshold);
    }

    function setImpairmentGuardian(address guardian) external onlyDelegateCall {
        if (guardian == address(0)) revert InvalidImpairmentConfig(guardian);
        impairmentGuardian = guardian;
        emit ImpairmentGuardianUpdated(guardian);
    }

    function setImpairmentClaims(address claims) external onlyDelegateCall {
        if (claims == address(0)) revert InvalidImpairmentConfig(claims);
        impairmentClaims = claims;
        emit ImpairmentClaimsUpdated(claims);
    }

    function setImpairmentRecoveryEscrow(address escrow) external onlyDelegateCall {
        if (escrow == address(0)) revert InvalidImpairmentConfig(escrow);
        impairmentRecoveryEscrow = escrow;
        emit ImpairmentRecoveryEscrowUpdated(escrow);
    }

    function _scheduleRiskChange(uint8 kind, address target, uint256 value) internal {
        if (kind == RISK_KIND_PERFORMANCE_FEE && value > MAX_FEE) revert InvalidAmount();
        if (kind == RISK_KIND_MANAGEMENT_FEE && value > MAX_MANAGEMENT_FEE) revert InvalidAmount();

        uint64 delay = riskConfigDelay;
        if (delay == 0) {
            _executeRiskChange(kind, target, value);
            emit RiskConfigExecuted(kind, target, value);
            return;
        }

        if (pendingRiskKind != RISK_KIND_NONE) revert PendingRiskConfigExists(pendingRiskKind);

        pendingRiskKind = kind;
        pendingRiskTarget = target;
        pendingRiskValue = value;
        uint256 unlock = uint256(block.timestamp) + delay;
        if (unlock > type(uint64).max) revert InvalidAmount();
        pendingRiskUnlockTime = uint64(unlock);
        emit RiskConfigScheduled(kind, target, value, pendingRiskUnlockTime);
    }

    function _executeRiskChange(uint8 kind, address target, uint256 value) internal {
        if (kind == RISK_KIND_PERFORMANCE_FEE) {
            performanceFee = uint16(value);
            emit UpdatePerformanceFee(uint16(value));
            return;
        }
        if (kind == RISK_KIND_MANAGEMENT_FEE) {
            managementFee = uint16(value);
            emit UpdateManagementFee(uint16(value));
            return;
        }
        if (kind == RISK_KIND_STRATEGY_MAX_ASSETS) {
            uint256 oldCap = strategyMaxAssets[target];
            strategyMaxAssets[target] = value;
            emit UpdateStrategyMaxAssets(target, oldCap, value);
            return;
        }
        if (kind == RISK_KIND_MANAGEMENT_FEE_RECIPIENT) {
            managementFeeRecipient = target;
            emit UpdateManagementFeeRecipient(target);
            return;
        }
        revert InvalidRiskConfigKind(kind);
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

    // slither-disable-next-line uninitialized-state
    function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyDelegateCall {
        uint256 current = _totalSupply;
        if (_maxTotalSupply < current) revert MaxTotalSupplyBelowCurrent(_maxTotalSupply, current);
        maxTotalSupply = _maxTotalSupply;
    }

    /// @notice Set the governance-enforced asset cap for a strategy.
    /// @dev Pass 0 to disable the cap (uncapped). The cap clamps the strategy's
    ///      contribution to `totalAssets()` so misreporting cannot inflate share price.
    function setStrategyMaxAssets(address strategy, uint256 cap) external onlyDelegateCall {
        if (strategy == address(0)) revert ZeroAddress();
        _scheduleRiskChange(RISK_KIND_STRATEGY_MAX_ASSETS, strategy, cap);
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

