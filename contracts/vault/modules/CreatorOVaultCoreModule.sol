// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

import {CreatorOVaultModuleBase} from "./CreatorOVaultModuleBase.sol";
import {ICreatorOVaultModuleIdentity} from "./ICreatorOVaultModuleIdentity.sol";

interface ICreatorOVaultStrategiesModuleInternal {
    function __withdrawFromStrategies(uint256 amountNeeded) external returns (uint256 totalWithdrawn);
    function __autoAllocateToStrategy() external;
    function __ejectDisabledStrategy(address strategy) external;
}

interface ICreatorOImpairmentClaims {
    function mintFromVault(address account, uint256 epochId, uint256 amount) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function totalSupply(uint256 id) external view returns (uint256);
}

interface ICreatorORecoveryEscrow {
    function notifyRecovery(address asset, uint256 epochId, uint256 amount) external;
    function claimRecovery(address asset, uint256 epochId, address receiver, uint256 amount) external;
}

struct CcaLifecycleStatus {
    uint8 phase;
}

interface ICCALifecycleStatusReader {
    function getLifecycleStatus() external view returns (CcaLifecycleStatus memory status);
}

interface ICCAPhaseReader {
    function phase() external view returns (uint8);
}

/// @notice Core ERC-4626 + queue + profit unlocking + reporting logic for CreatorOVault.
/// @dev Must be invoked via delegatecall from CreatorOVault.
contract CreatorOVaultCoreModule is CreatorOVaultModuleBase, ICreatorOVaultModuleIdentity {
    using SafeERC20 for IERC20;
    bytes32 internal constant MODULE_KIND = keccak256("CreatorOVaultModule.core");
    bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.v3");

    // ---- constants (must match vault) ----
    uint16 internal constant MAX_FEE = 2_000;
    uint256 internal constant MAX_BPS = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 31_556_952;
    uint256 internal constant MAX_BPS_EXTENDED = 1_000_000_000_000;
    uint256 internal constant MAX_PRICE_CHANGE_BPS = 1000;
    uint256 internal constant MINIMUM_FIRST_DEPOSIT = 50_000_000e18;
    uint8 internal constant MAX_VALUATION_MISS_THRESHOLD = 30;
    uint256 internal constant IMPAIR_REASON_MAX = 7;
    uint8 internal constant CCA_PHASE_AUCTION_LIVE = 1;

    // ---- events (must match vault signatures) ----
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(
        address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares
    );

    event Reported(uint256 profit, uint256 loss, uint256 performanceFees, uint256 totalAssets);
    event ManagementFeeAccrued(uint256 feeAssets, uint256 feeShares, uint256 elapsedSeconds);
    event StrategyValuationAutoDisabled(address indexed strategy, uint8 consecutiveMisses);
    event CapitalInjected(address indexed from, uint256 amount, uint256 newPricePerShare);
    event SharesBurnedForPrice(address indexed from, uint256 shares, uint256 newPricePerShare);

    event WithdrawalQueued(address indexed user, uint256 shares, uint256 unlockBlock);
    event WithdrawalClaimed(address indexed user, uint256 assets);
    event WithdrawalCancelled(address indexed user, uint256 shares);
    event ImpairmentChallengeWindowUpdated(uint64 newWindow);
    event ImpairmentTripped(
        uint256 indexed epochId,
        address indexed strategy,
        uint256 indexed reasonCode,
        uint256 tripBlock,
        uint256 totalSharesAtTrip
    );
    event ImpairmentTripCleared(uint256 indexed epochId, address indexed strategy);
    event ImpairmentRootProposed(uint256 indexed epochId, bytes32 indexed root, uint64 unlockTime);
    event ImpairmentRootChallenged(uint256 indexed epochId, address indexed challenger, string reason);
    event ImpairmentRootCleared(uint256 indexed epochId);
    event ImpairmentRootFinalized(uint256 indexed epochId, bytes32 indexed root, uint256 totalClaimSupply);
    event ImpairmentFinalized(
        uint256 indexed epochId, address indexed strategy, bytes32 indexed root, uint256 excludedBookValue
    );
    event ImpairmentRecoveryNotified(uint256 indexed epochId, address indexed asset, uint256 amount);
    event ImpairmentRecoveryClaimed(
        uint256 indexed epochId, address indexed account, address indexed receiver, uint256 amount
    );
    event ImpairmentResolved(uint256 indexed epochId);

    // ---- errors (must match vault selectors) ----
    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error InvalidAmount();
    error Unauthorized();
    error InsufficientBalance();
    error Paused();
    error VaultIsShutdown();
    error FirstDepositTooSmall(uint256 provided, uint256 minimum);
    error PriceChangeExceedsLimit(uint256 priceBefore, uint256 priceAfter, uint256 maxChangeBps);
    error TrustedPpsDeviationExceeded(uint256 checkpointPps, uint256 currentPps, uint256 maxDeviationBps);
    error InflationAttackDetected(uint256 assets, uint256 shares);
    error WithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);
    error TransferTooSoon(uint256 currentBlock, uint256 requiredBlock);
    error LargeWithdrawalMustBeQueued(uint256 amount, uint256 threshold);
    error WithdrawalNotUnlocked(uint256 currentBlock, uint256 unlockBlock);
    error NoQueuedWithdrawal();
    error QueuedWithdrawalReceiverMismatch(address existing, address provided);
    error StrategyValuationNotReady(address strategy);
    error TransferAmountMismatch(uint256 expected, uint256 actual);
    error ModulesNotSet();
    error OnlyGaugeController();
    error VaultNotNormal();
    error VaultNotSuspect();
    error NoActiveImpairment();
    error ImpairmentAlreadyActive(uint256 epochId);
    error InvalidImpairmentEpoch(uint256 epochId);
    error InvalidImpairmentTransition(uint256 epochId);
    error StrategyAlreadyImpaired(address strategy);
    error StrategyNotImpaired(address strategy);
    error InvalidImpairmentReason(uint256 reasonCode);
    error ImpairmentRootNotReady(uint64 unlockTime);
    error ImpairmentRootRequired(uint256 epochId);
    error ImpairmentRootAlreadyFinalized(uint256 epochId);
    error ImpairmentRootChallengedErr(uint256 epochId);
    error ChallengeWindowNotConfigured();
    error ClaimAlreadyMinted(uint256 epochId, address account);
    error InvalidClaimProof(uint256 epochId, address account);
    error NothingToClaim(uint256 epochId, address account);
    error RecoveryEscrowNotConfigured();
    error ClaimSupplyExceeded(uint256 epochId, uint256 totalClaimSupply, uint256 requested);
    error CcaAuctionDepositBlocked();

    // =================================
    // PROFIT UNLOCKING
    // =================================

    function moduleKind() external pure returns (bytes32) {
        return MODULE_KIND;
    }

    function moduleStorageVersion() external pure returns (bytes32) {
        return MODULE_STORAGE_VERSION;
    }

    function unlockedShares() external view onlyDelegateCall returns (uint256) {
        uint256 locked = totalLockedShares;
        if (locked == 0) return 0;

        uint256 unlockDate = fullProfitUnlockDate;
        if (unlockDate == 0) return 0;

        uint256 checkpoint = lastProfitUnlockUpdate;
        uint256 currentTime = block.timestamp;
        if (currentTime <= checkpoint) return 0;

        if (currentTime >= unlockDate) {
            return locked;
        }

        uint256 elapsed = currentTime - checkpoint;
        uint256 unlockedAmount = (profitUnlockingRate * elapsed) / MAX_BPS_EXTENDED;
        return unlockedAmount > locked ? locked : unlockedAmount;
    }

    function lockedShares() external view onlyDelegateCall returns (uint256) {
        return totalLockedShares - CreatorOVaultCoreModule(address(this)).unlockedShares();
    }

    function _availableProfitShares() internal view returns (uint256 available) {
        uint256 vaultBalance = _balances[address(this)];
        uint256 queued = totalQueuedWithdrawalShares;
        if (vaultBalance <= queued) return 0;
        return vaultBalance - queued;
    }

    function _processProfitUnlock() internal {
        uint256 locked = totalLockedShares;
        if (locked == 0) {
            if (profitUnlockingRate != 0) profitUnlockingRate = 0;
            if (fullProfitUnlockDate != 0) fullProfitUnlockDate = 0;
            lastProfitUnlockUpdate = uint96(block.timestamp);
            return;
        }

        uint256 unlockDate = fullProfitUnlockDate;
        if (unlockDate == 0) return;

        uint256 checkpoint = lastProfitUnlockUpdate;
        uint256 currentTime = block.timestamp;
        if (currentTime <= checkpoint) return;

        uint256 targetTime = currentTime < unlockDate ? currentTime : unlockDate;
        uint256 elapsed = targetTime - checkpoint;
        if (elapsed == 0) return;

        uint256 matured = (profitUnlockingRate * elapsed) / MAX_BPS_EXTENDED;
        if (targetTime == unlockDate || matured > locked) {
            matured = locked;
        }
        if (matured == 0) return;

        uint256 availableProfit = _availableProfitShares();
        uint256 sharesToBurn = matured > availableProfit ? availableProfit : matured;
        if (sharesToBurn == 0) return;

        _sharesUpdate(address(this), address(0), sharesToBurn);
        totalLockedShares = locked - sharesToBurn;

        uint256 consumedElapsed =
            sharesToBurn == matured ? elapsed : (sharesToBurn * MAX_BPS_EXTENDED) / profitUnlockingRate;
        if (consumedElapsed == 0) consumedElapsed = 1;
        if (consumedElapsed > elapsed) consumedElapsed = elapsed;
        lastProfitUnlockUpdate = uint96(checkpoint + consumedElapsed);

        if (totalLockedShares == 0) {
            profitUnlockingRate = 0;
            fullProfitUnlockDate = 0;
        }
    }

    // =================================
    // ERC4626 OVERRIDES
    // =================================

    function totalAssets() public view onlyDelegateCall returns (uint256) {
        // FIX: L-06 — use tracked coinBalance instead of live balanceOf to prevent donation attacks
        uint256 total = coinBalance;

        uint256 len = strategyList.length;
        for (uint256 i; i < len; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy] && !strategyImpaired[strategy]) {
                total += _getStrategyAssetsSafe(strategy);
            }
        }

        return total;
    }

    function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets) {
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

    function _firstStrategyValuationNotReady(bool allowMissGrace) internal view returns (address bad) {
        uint8 threshold = valuationMissThreshold;
        uint256 len = strategyList.length;
        for (uint256 i; i < len; i++) {
            address strategy = strategyList[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy]) continue;
            if (allowMissGrace && threshold > 0 && strategyValuationMisses[strategy] > 0) continue;

            try IStrategyValuation(strategy).isValuationReady() returns (bool ok) {
                if (!ok) return strategy;
            } catch {
                return strategy;
            }

            try IStrategy(strategy).getTotalAssets() returns (uint256) {} catch {
                return strategy;
            }
        }

        return address(0);
    }

    function _requireStrategyValuationsReady(bool allowMissGrace) internal view {
        address bad = _firstStrategyValuationNotReady(allowMissGrace);
        if (bad != address(0)) revert StrategyValuationNotReady(bad);
    }

    function _isCcaAuctionLive() internal view returns (bool) {
        address strategy = ccaLaunchStrategy;
        if (strategy == address(0)) return false;

        try ICCALifecycleStatusReader(strategy).getLifecycleStatus() returns (CcaLifecycleStatus memory status) {
            return status.phase == CCA_PHASE_AUCTION_LIVE;
        } catch {
            // Fallback for stale/legacy strategy wiring that does not expose lifecycle snapshots.
            try ICCAPhaseReader(strategy).phase() returns (uint8 phaseValue) {
                return phaseValue == CCA_PHASE_AUCTION_LIVE;
            } catch {
                return false;
            }
        }
    }

    function deposit(uint256 assets, address receiver) external onlyDelegateCall returns (uint256 shares) {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        if (_isCcaAuctionLive()) revert CcaAuctionDepositBlocked();
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        _processProfitUnlock();

        uint256 supplyBefore = _totalSupply;
        bool isFirstDeposit = supplyBefore == 0;
        if (isFirstDeposit && assets < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(assets, MINIMUM_FIRST_DEPOSIT);
        }

        uint256 priceBefore = isFirstDeposit ? 0 : pricePerShare();

        _requireStrategyValuationsReady(false);
        if (!isFirstDeposit) {
            _checkTrustedPpsDeviation(priceBefore);
        }

        shares = IERC4626(address(this)).previewDeposit(assets);
        if (shares == 0) revert ZeroShares();
        if (!isFirstDeposit && supplyBefore + shares > maxTotalSupply) revert InvalidAmount();

        if (!isFirstDeposit && shares > assets * 10_000) {
            revert InflationAttackDetected(assets, shares);
        }

        _pullCreatorCoinExact(msg.sender, assets);
        _sharesUpdate(address(0), receiver, shares);

        if (!isFirstDeposit) {
            uint256 priceAfter = pricePerShare();
            _checkPriceChange(priceBefore, priceAfter);
        }

        _increaseReportBaselineForPrincipalInflow(assets);

        emit Deposit(msg.sender, receiver, assets, shares);

        if (autoAllocate && defaultQueue.length > 0) {
            _autoAllocateToStrategy();
        }
    }

    function mint(uint256 shares, address receiver) external onlyDelegateCall returns (uint256 assets) {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        if (_isCcaAuctionLive()) revert CcaAuctionDepositBlocked();
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        _processProfitUnlock();

        uint256 supplyBefore = _totalSupply;
        bool isFirstDeposit = supplyBefore == 0;
        uint256 priceBefore = isFirstDeposit ? 0 : pricePerShare();

        _requireStrategyValuationsReady(false);
        if (!isFirstDeposit) {
            _checkTrustedPpsDeviation(priceBefore);
        }

        assets = IERC4626(address(this)).previewMint(shares);
        if (assets == 0) revert ZeroAmount();
        if (!isFirstDeposit && supplyBefore + shares > maxTotalSupply) revert InvalidAmount();

        if (isFirstDeposit && assets < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(assets, MINIMUM_FIRST_DEPOSIT);
        }

        if (!isFirstDeposit && shares > assets * 10_000) {
            revert InflationAttackDetected(assets, shares);
        }

        _pullCreatorCoinExact(msg.sender, assets);
        _sharesUpdate(address(0), receiver, shares);

        if (!isFirstDeposit) {
            uint256 priceAfter = pricePerShare();
            _checkPriceChange(priceBefore, priceAfter);
        }

        _increaseReportBaselineForPrincipalInflow(assets);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner_) external onlyDelegateCall returns (uint256 assets) {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        // FIX: L-01 — enforce pause on redeem to align with maxWithdraw/maxRedeem returning 0
        if (paused) revert Paused();
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        _processProfitUnlock();

        uint256 requiredBlock = lastDepositBlock[owner_] + withdrawDelayBlocks;
        if (block.number < requiredBlock) revert WithdrawTooSoon(block.number, requiredBlock);

        if (msg.sender != owner_) {
            _spendAllowance(owner_, msg.sender, shares);
        }

        assets = IERC4626(address(this)).previewRedeem(shares);
        if (assets == 0) revert ZeroAmount();

        if (assets >= largeWithdrawalThreshold) {
            revert LargeWithdrawalMustBeQueued(assets, largeWithdrawalThreshold);
        }

        _sharesUpdate(owner_, address(0), shares);
        _ensureCoin(assets);
        _pushCreatorCoinExact(receiver, assets);

        _decreaseReportBaselineForPrincipalOutflow(assets);

        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner_) external onlyDelegateCall returns (uint256 shares) {
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        // FIX: L-01 — enforce pause on withdraw to align with maxWithdraw/maxRedeem returning 0
        if (paused) revert Paused();
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        _processProfitUnlock();

        uint256 requiredBlock = lastDepositBlock[owner_] + withdrawDelayBlocks;
        if (block.number < requiredBlock) revert WithdrawTooSoon(block.number, requiredBlock);

        shares = IERC4626(address(this)).previewWithdraw(assets);
        if (shares == 0) revert ZeroShares();

        if (assets >= largeWithdrawalThreshold) {
            revert LargeWithdrawalMustBeQueued(assets, largeWithdrawalThreshold);
        }

        if (msg.sender != owner_) {
            _spendAllowance(owner_, msg.sender, shares);
        }

        _sharesUpdate(owner_, address(0), shares);
        _ensureCoin(assets);
        _pushCreatorCoinExact(receiver, assets);

        _decreaseReportBaselineForPrincipalOutflow(assets);

        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
    }

    // =================================
    // LARGE WITHDRAWAL QUEUE
    // =================================

    function queueWithdrawal(uint256 shares, address receiver) external onlyDelegateCall {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        _processProfitUnlock();

        uint256 requiredBlock = lastDepositBlock[msg.sender] + withdrawDelayBlocks;
        if (block.number < requiredBlock) revert WithdrawTooSoon(block.number, requiredBlock);

        uint256 assets = IERC4626(address(this)).previewRedeem(shares);
        if (assets < largeWithdrawalThreshold) revert InvalidAmount();

        _sharesUpdate(msg.sender, address(this), shares);
        totalQueuedWithdrawalShares += shares;

        uint256 unlockBlock = block.number + largeWithdrawalDelayBlocks;

        QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
        // FIX: H-03 — only set unlock time on first queue, not subsequent calls
        if (queued.shares == 0) {
            queued.unlockBlock = unlockBlock;
        }
        // FIX: L-07 — prevent silent receiver overwrite on subsequent queue calls
        if (queued.shares > 0 && queued.receiver != receiver) {
            revert QueuedWithdrawalReceiverMismatch(queued.receiver, receiver);
        }
        queued.shares += shares;
        queued.receiver = receiver;

        emit WithdrawalQueued(msg.sender, shares, unlockBlock);
    }

    function claimQueuedWithdrawal() external onlyDelegateCall returns (uint256 assets) {
        _processProfitUnlock();
        QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];

        if (queued.shares == 0) revert NoQueuedWithdrawal();
        if (block.number < queued.unlockBlock) {
            revert WithdrawalNotUnlocked(block.number, queued.unlockBlock);
        }

        uint256 shares = queued.shares;
        address receiver = queued.receiver;
        delete queuedWithdrawals[msg.sender];

        assets = IERC4626(address(this)).previewRedeem(shares);

        totalQueuedWithdrawalShares -= shares;
        _sharesUpdate(address(this), address(0), shares);

        _ensureCoin(assets);
        _pushCreatorCoinExact(receiver, assets);
        _decreaseReportBaselineForPrincipalOutflow(assets);

        emit WithdrawalClaimed(msg.sender, assets);
    }

    function cancelQueuedWithdrawal() external onlyDelegateCall returns (uint256 shares) {
        _processProfitUnlock();
        QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];

        if (queued.shares == 0) revert NoQueuedWithdrawal();
        shares = queued.shares;
        delete queuedWithdrawals[msg.sender];

        totalQueuedWithdrawalShares -= shares;
        _sharesUpdate(address(this), msg.sender, shares);

        emit WithdrawalCancelled(msg.sender, shares);
    }

    // =================================
    // LIMITS
    // =================================

    function maxDeposit(address receiver) external view onlyDelegateCall returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (_isCcaAuctionLive()) return 0;
        if (paused || isShutdown) return 0;
        if (whitelistEnabled && !whitelist[receiver]) return 0;
        if (_firstStrategyValuationNotReady(false) != address(0)) return 0;

        uint256 currentSupply = _totalSupply;
        if (currentSupply >= maxTotalSupply) return 0;

        uint256 remainingShares = maxTotalSupply - currentSupply;
        uint256 supply = _totalSupply;
        // FIX: M-05 — return asset-denominated value when supply is zero (ERC-4626 compliance)
        // Vault uses _decimalsOffset() = 3, so shares = assets * 10^3
        if (supply == 0) return remainingShares / 1000;

        return (remainingShares * totalAssets()) / supply;
    }

    function maxMint(address receiver) external view onlyDelegateCall returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (_isCcaAuctionLive()) return 0;
        if (paused || isShutdown) return 0;
        if (whitelistEnabled && !whitelist[receiver]) return 0;
        if (_firstStrategyValuationNotReady(false) != address(0)) return 0;

        uint256 currentSupply = _totalSupply;
        if (currentSupply >= maxTotalSupply) return 0;
        return maxTotalSupply - currentSupply;
    }

    function maxWithdraw(address owner_) external view onlyDelegateCall returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (paused) return 0;
        uint256 userShares = _balances[owner_];
        if (userShares == 0) return 0;
        uint256 assetsFromShares = IERC4626(address(this)).previewRedeem(userShares);
        if (largeWithdrawalThreshold == 0) return assetsFromShares;
        uint256 maxSyncAssets = largeWithdrawalThreshold - 1;
        return assetsFromShares > maxSyncAssets ? maxSyncAssets : assetsFromShares;
    }

    function maxRedeem(address owner_) external view onlyDelegateCall returns (uint256) {
        if (vaultMode != VaultMode.Normal) return 0;
        if (paused) return 0;
        uint256 userShares = _balances[owner_];
        if (userShares == 0) return 0;
        if (largeWithdrawalThreshold == 0) return userShares;

        uint256 maxSyncAssets = largeWithdrawalThreshold - 1;
        uint256 syncShares = IERC4626(address(this)).previewWithdraw(maxSyncAssets);
        return syncShares > userShares ? userShares : syncShares;
    }

    // =================================
    // ENSURE COIN / TRANSFER HELPERS
    // =================================

    function _syncCoinBalance() internal returns (uint256 actual) {
        IERC20 coin = _creatorCoin();
        actual = coin.balanceOf(address(this));
        coinBalance = actual;
    }

    function _pullCreatorCoinExact(address from, uint256 amount) internal {
        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));
        coin.safeTransferFrom(from, address(this), amount);
        uint256 afterBal = coin.balanceOf(address(this));

        uint256 received = afterBal - beforeBal;
        if (received != amount) revert TransferAmountMismatch(amount, received);
        coinBalance = afterBal;
    }

    function _pushCreatorCoinExact(address to, uint256 amount) internal {
        IERC20 coin = _creatorCoin();
        uint256 beforeBal = coin.balanceOf(address(this));
        coin.safeTransfer(to, amount);
        uint256 afterBal = coin.balanceOf(address(this));

        uint256 spent = beforeBal - afterBal;
        if (spent != amount) revert TransferAmountMismatch(amount, spent);
        coinBalance = afterBal;
    }

    function _ensureCoin(uint256 coinNeeded) internal {
        uint256 available = _syncCoinBalance();
        if (available >= coinNeeded) return;

        uint256 deficit = coinNeeded - available;
        _withdrawFromStrategies(deficit);

        available = _syncCoinBalance();
        if (available < coinNeeded) revert InsufficientBalance();
    }

    function _withdrawFromStrategies(uint256 amountNeeded) internal {
        address module = _strategiesModule;
        if (module == address(0)) revert ModulesNotSet();

        // Delegatecall is intentional: strategies module shares the same vault storage layout.
        // `_strategiesModule` is set by owner-gated module wiring and verified before use.
        (bool ok, bytes memory ret) =
            module.delegatecall(abi.encodeWithSelector(ICreatorOVaultStrategiesModuleInternal.__withdrawFromStrategies.selector, amountNeeded));
        if (!ok) _revertBytes(ret);
    }

    function _autoAllocateToStrategy() internal {
        address module = _strategiesModule;
        if (module == address(0)) revert ModulesNotSet();

        // Delegatecall is intentional and access-controlled via module-address configuration.
        (bool ok, bytes memory ret) =
            module.delegatecall(abi.encodeWithSelector(ICreatorOVaultStrategiesModuleInternal.__autoAllocateToStrategy.selector));
        if (!ok) _revertBytes(ret);
    }

    // =================================
    // PRICE SAFETY
    // =================================

    function _checkPriceChange(uint256 priceBefore, uint256 priceAfter) internal pure {
        if (priceBefore == 0) return;

        uint256 priceDiff = priceAfter > priceBefore ? priceAfter - priceBefore : priceBefore - priceAfter;
        uint256 maxAllowedChange = (priceBefore * MAX_PRICE_CHANGE_BPS) / MAX_BPS;
        if (priceDiff > maxAllowedChange) {
            revert PriceChangeExceedsLimit(priceBefore, priceAfter, MAX_PRICE_CHANGE_BPS);
        }
    }

    function _checkTrustedPpsDeviation(uint256 currentPps) internal view {
        uint256 checkpointPps = trustedPpsCheckpoint;
        if (checkpointPps == 0) return;

        uint256 maxDeviationBps = trustedPpsMaxDeviationBps;
        if (maxDeviationBps >= MAX_BPS) return;

        uint256 ppsDiff = currentPps > checkpointPps ? currentPps - checkpointPps : checkpointPps - currentPps;
        uint256 maxAllowedDiff = (checkpointPps * maxDeviationBps) / MAX_BPS;

        if (ppsDiff > maxAllowedDiff) {
            revert TrustedPpsDeviationExceeded(checkpointPps, currentPps, maxDeviationBps);
        }
    }

    function pricePerShare() public view onlyDelegateCall returns (uint256) {
        uint256 supply = _totalSupply;
        if (supply == 0) return 1e18;
        // FIX: L-03 — align with ERC-4626 virtual shares offset (_decimalsOffset() = 3)
        return ((totalAssets() + 1) * 1e18) / (supply + 1000);
    }

    // =================================
    // REPORT
    // =================================

    function report() external onlyDelegateCall returns (uint256 profit, uint256 loss) {
        _processProfitUnlock();
        _processValuationHealth();
        _requireStrategyValuationsReady(true);

        uint256 currentTotalAssets = totalAssets();
        _accrueManagementFee(currentTotalAssets);
        uint256 previousTotalAssets = totalAssetsAtLastReport;

        // FIX: I-03 — bootstrap only on the very first report, not after a full vault drain
        // If supply > 0, shares exist from prior activity so this is not a true bootstrap
        if (previousTotalAssets == 0 && trustedPpsCheckpoint == 0 && _totalSupply == 0) {
            lastReport = uint96(block.timestamp);
            totalAssetsAtLastReport = currentTotalAssets;
            trustedPpsCheckpoint = pricePerShare();
            emit Reported(0, 0, 0, currentTotalAssets);
            return (0, 0);
        }

        if (currentTotalAssets > previousTotalAssets) {
            profit = currentTotalAssets - previousTotalAssets;

            uint256 performanceFees = 0;
            if (performanceFee > 0 && profit > 0) {
                performanceFees = (profit * performanceFee) / MAX_BPS;

                if (performanceFees > 0 && performanceFeeRecipient != address(0)) {
                    uint256 supply = _totalSupply;
                    uint256 feeShares =
                        supply > 0 ? (performanceFees * supply) / currentTotalAssets : performanceFees;
                    _sharesUpdate(address(0), performanceFeeRecipient, feeShares);
                }
            }

            uint256 profitAfterFees = profit - performanceFees;
            if (profitAfterFees > 0 && profitMaxUnlockTime > 0) {
                uint256 supply = _totalSupply;
                uint256 profitShares =
                    supply > 0 ? (profitAfterFees * supply) / currentTotalAssets : profitAfterFees;

                _sharesUpdate(address(0), address(this), profitShares);
                uint256 updatedLockedShares = totalLockedShares + profitShares;
                totalLockedShares = updatedLockedShares;

                fullProfitUnlockDate = uint96(block.timestamp + profitMaxUnlockTime);
                profitUnlockingRate = (updatedLockedShares * MAX_BPS_EXTENDED) / profitMaxUnlockTime;
                lastProfitUnlockUpdate = uint96(block.timestamp);
            }

            emit Reported(profit, 0, performanceFees, currentTotalAssets);
        } else {
            loss = previousTotalAssets - currentTotalAssets;

            if (loss > 0 && totalLockedShares > 0) {
                uint256 supply = _totalSupply;
                // FIX: H-01 — prevent division by zero when total assets reach zero
                uint256 lossShares;
                if (currentTotalAssets == 0) {
                    lossShares = totalLockedShares; // 100% loss: burn all locked shares
                } else if (supply > 0) {
                    lossShares = (loss * supply) / currentTotalAssets;
                }
                uint256 sharesToBurn = lossShares > totalLockedShares ? totalLockedShares : lossShares;
                uint256 availableProfit = _availableProfitShares();
                if (sharesToBurn > availableProfit) sharesToBurn = availableProfit;

                if (sharesToBurn > 0) {
                    _sharesUpdate(address(this), address(0), sharesToBurn);
                    totalLockedShares -= sharesToBurn;
                    if (totalLockedShares == 0) {
                        profitUnlockingRate = 0;
                        fullProfitUnlockDate = 0;
                    }
                }
            }

            emit Reported(0, loss, 0, currentTotalAssets);
        }

        lastReport = uint96(block.timestamp);
        totalAssetsAtLastReport = totalAssets();
        trustedPpsCheckpoint = pricePerShare();
    }

    function _accrueManagementFee(uint256 currentTotalAssets) internal {
        uint16 feeBps = managementFee;
        if (feeBps == 0) return;

        uint256 elapsed = block.timestamp - lastReport;
        if (elapsed == 0 || currentTotalAssets == 0) return;

        uint256 feeAssets = (currentTotalAssets * feeBps * elapsed) / (MAX_BPS * SECONDS_PER_YEAR);
        if (feeAssets == 0 || feeAssets > currentTotalAssets) return;

        address recipient = managementFeeRecipient;
        if (recipient == address(0)) recipient = performanceFeeRecipient;
        if (recipient == address(0)) return;

        uint256 supply = _totalSupply;
        uint256 feeShares = supply > 0 ? (feeAssets * supply) / currentTotalAssets : feeAssets;
        if (feeShares == 0) return;

        _sharesUpdate(address(0), recipient, feeShares);
        emit ManagementFeeAccrued(feeAssets, feeShares, elapsed);
    }

    function _processValuationHealth() internal {
        uint8 threshold = valuationMissThreshold;
        if (threshold == 0) return;

        // Backward iteration: `_ejectDisabledStrategy` swap-pops `strategyList[i]`, which
        // would skip or OOB-revert under a forward loop with a cached length.
        uint256 i = strategyList.length;
        while (i > 0) {
            unchecked {
                --i;
            }
            address strategy = strategyList[i];
            if (!activeStrategies[strategy] || strategyImpaired[strategy]) continue;

            if (_isValuationReady(strategy)) {
                strategyValuationMisses[strategy] = 0;
                continue;
            }

            uint8 prior = strategyValuationMisses[strategy];
            uint8 misses = prior < type(uint8).max ? prior + 1 : prior;
            strategyValuationMisses[strategy] = misses;
            if (misses < threshold) continue;

            strategyValuationMisses[strategy] = 0;
            _ejectDisabledStrategy(strategy);
            emit StrategyValuationAutoDisabled(strategy, misses);
        }
    }

    function _ejectDisabledStrategy(address strategy) internal {
        address module = _strategiesModule;
        if (module == address(0)) revert ModulesNotSet();

        (bool ok, bytes memory ret) = module.delegatecall(
            abi.encodeWithSelector(ICreatorOVaultStrategiesModuleInternal.__ejectDisabledStrategy.selector, strategy)
        );
        if (!ok) _revertBytes(ret);
    }

    function _isValuationReady(address strategy) internal view returns (bool) {
        try IStrategyValuation(strategy).isValuationReady() returns (bool ok) {
            if (!ok) return false;
        } catch {
            return false;
        }

        try IStrategy(strategy).getTotalAssets() returns (uint256) {
            return true;
        } catch {
            return false;
        }
    }

    // FIX: I-04 — do not rebuild baseline from live totalAssets() when baseline is zero;
    // simply add the inflow delta to prevent flash-loan-assisted baseline manipulation
    function _increaseReportBaselineForPrincipalInflow(uint256 assetsIn) internal {
        totalAssetsAtLastReport += assetsIn;
    }

    function _decreaseReportBaselineForPrincipalOutflow(uint256 assetsOut) internal {
        uint256 baseline = totalAssetsAtLastReport;
        totalAssetsAtLastReport = assetsOut >= baseline ? 0 : baseline - assetsOut;
    }

    // =================================
    // MISC
    // =================================

    function burnSharesForPriceIncrease(uint256 shares) external onlyDelegateCall {
        if (shares == 0) revert ZeroAmount();
        address sender = msg.sender;
        if (sender != gaugeController && sender != burnStream) revert OnlyGaugeController();

        _sharesUpdate(sender, address(0), shares);
        totalSharesBurned += shares;

        emit SharesBurnedForPrice(sender, shares, pricePerShare());
    }

    function injectCapital(uint256 amount) external onlyDelegateCall {
        if (amount == 0) revert ZeroAmount();

        uint256 priceBefore = pricePerShare();
        _pullCreatorCoinExact(msg.sender, amount);
        uint256 priceAfter = pricePerShare();
        _checkPriceChange(priceBefore, priceAfter);

        emit CapitalInjected(msg.sender, amount, priceAfter);
    }

    // =================================
    // IMPAIRMENT SIDE-POCKET (V1)
    // =================================

    function setImpairmentChallengeWindow(uint64 window) external onlyDelegateCall {
        impairmentChallengeWindow = window;
        emit ImpairmentChallengeWindowUpdated(window);
    }

    function tripImpairment(address strategy, uint256 reasonCode) external onlyDelegateCall returns (uint256 epochId) {
        if (strategy == address(0)) revert ZeroAddress();
        if (reasonCode == 0 || reasonCode > IMPAIR_REASON_MAX) revert InvalidImpairmentReason(reasonCode);
        if (activeImpairmentEpoch != 0) revert ImpairmentAlreadyActive(activeImpairmentEpoch);
        if (!_isStrategyListed(strategy)) revert StrategyNotImpaired(strategy);
        if (strategyImpaired[strategy]) revert StrategyAlreadyImpaired(strategy);

        epochId = nextImpairmentEpochId == 0 ? 1 : nextImpairmentEpochId;
        nextImpairmentEpochId = epochId + 1;
        activeImpairmentEpoch = epochId;
        vaultMode = VaultMode.Suspect;
        strategyImpaired[strategy] = true;

        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        epoch.status = ImpairmentEpochStatus.Tripped;
        epoch.strategy = strategy;
        epoch.reasonCode = reasonCode;
        epoch.tripBlock = block.number;
        epoch.trippedAt = uint64(block.timestamp);
        epoch.totalSharesAtTrip = _totalSupply;

        emit ImpairmentTripped(epochId, strategy, reasonCode, block.number, _totalSupply);
    }

    function clearImpairmentTrip(uint256 epochId) external onlyDelegateCall {
        if (epochId == 0 || epochId != activeImpairmentEpoch) revert InvalidImpairmentEpoch(epochId);
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);

        epoch.status = ImpairmentEpochStatus.Resolved;
        epoch.resolvedAt = uint64(block.timestamp);
        // FIX C-3: a false-alarm trip must lose its claim surface. Any root
        // proposed during the trip becomes Resolved-state-claimable otherwise,
        // letting snapshot holders mint claims against a healthy vault. Mirror
        // clearImpairmentRootAfterChallenge: zero all root-derived fields so
        // mintImpairmentClaim / notifyImpairmentRecovery hard-revert for this
        // epoch. Legitimate post-finalize Resolved epochs keep their root.
        epoch.snapshotRoot = bytes32(0);
        epoch.totalClaimSupply = 0;
        epoch.recoveryAsset = address(0);
        impairmentRootUnlockTime[epochId] = 0;
        impairmentRootChallenged[epochId] = false;
        strategyImpaired[epoch.strategy] = false;
        activeImpairmentEpoch = 0;
        vaultMode = VaultMode.Normal;
        emit ImpairmentTripCleared(epochId, epoch.strategy);
        emit ImpairmentResolved(epochId);
    }

    function proposeImpairmentRoot(
        uint256 epochId,
        bytes32 snapshotRoot,
        uint256 totalClaimSupply,
        address recoveryAsset
    ) external onlyDelegateCall {
        if (snapshotRoot == bytes32(0)) revert InvalidAmount();
        if (recoveryAsset == address(0)) revert ZeroAddress();
        if (impairmentChallengeWindow == 0) revert ChallengeWindowNotConfigured();
        if (epochId == 0 || epochId != activeImpairmentEpoch) revert InvalidImpairmentEpoch(epochId);

        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);
        if (epoch.snapshotRoot != bytes32(0)) revert ImpairmentRootAlreadyFinalized(epochId);
        if (totalClaimSupply == 0) totalClaimSupply = epoch.totalSharesAtTrip;

        epoch.snapshotRoot = snapshotRoot;
        epoch.totalClaimSupply = totalClaimSupply;
        epoch.recoveryAsset = recoveryAsset;
        uint64 unlock = uint64(block.timestamp) + impairmentChallengeWindow;
        impairmentRootUnlockTime[epochId] = unlock;
        emit ImpairmentRootProposed(epochId, snapshotRoot, unlock);
    }

    function challengeImpairmentRoot(uint256 epochId, string calldata reason) external onlyDelegateCall {
        if (epochId == 0) revert InvalidImpairmentEpoch(epochId);
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);
        if (epoch.snapshotRoot == bytes32(0)) revert ImpairmentRootRequired(epochId);
        impairmentRootChallenged[epochId] = true;
        emit ImpairmentRootChallenged(epochId, msg.sender, reason);
    }

    function clearImpairmentRootAfterChallenge(uint256 epochId) external onlyDelegateCall {
        if (epochId == 0) revert InvalidImpairmentEpoch(epochId);
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);
        if (!impairmentRootChallenged[epochId]) revert ImpairmentRootChallengedErr(epochId);
        epoch.snapshotRoot = bytes32(0);
        epoch.totalClaimSupply = 0;
        epoch.recoveryAsset = address(0);
        impairmentRootUnlockTime[epochId] = 0;
        impairmentRootChallenged[epochId] = false;
        emit ImpairmentRootCleared(epochId);
    }

    function finalizeImpairment(uint256 epochId) external onlyDelegateCall {
        if (epochId == 0 || epochId != activeImpairmentEpoch) revert InvalidImpairmentEpoch(epochId);
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);
        if (epoch.snapshotRoot == bytes32(0)) revert ImpairmentRootRequired(epochId);
        if (impairmentRootChallenged[epochId]) revert ImpairmentRootChallengedErr(epochId);

        uint64 unlock = impairmentRootUnlockTime[epochId];
        if (block.timestamp < unlock) revert ImpairmentRootNotReady(unlock);

        epoch.status = ImpairmentEpochStatus.Finalized;
        epoch.finalizedAt = uint64(block.timestamp);
        epoch.excludedBookValue = _getStrategyAssetsSafe(epoch.strategy);
        activeImpairmentEpoch = 0;
        vaultMode = VaultMode.Normal;
        emit ImpairmentRootFinalized(epochId, epoch.snapshotRoot, epoch.totalClaimSupply);
        emit ImpairmentFinalized(epochId, epoch.strategy, epoch.snapshotRoot, epoch.excludedBookValue);
    }

    function mintImpairmentClaim(uint256 epochId, address account, uint256 amount, bytes32[] calldata proof)
        external
        onlyDelegateCall
    {
        if (account == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status == ImpairmentEpochStatus.None) revert InvalidImpairmentEpoch(epochId);
        if (epoch.status != ImpairmentEpochStatus.Finalized && epoch.status != ImpairmentEpochStatus.Resolved) {
            revert InvalidImpairmentTransition(epochId);
        }
        // FIX C-3: epochs whose trip was cleared (false alarm) have their root
        // zeroed and must never be claimable. Without this guard a zero root
        // could even verify crafted proofs.
        if (epoch.snapshotRoot == bytes32(0)) revert ImpairmentRootRequired(epochId);
        if (impairmentClaimMinted[epochId][account]) revert ClaimAlreadyMinted(epochId, account);
        bytes32 leaf = keccak256(abi.encode(epochId, account, amount));
        bool valid = MerkleProof.verify(proof, epoch.snapshotRoot, leaf);
        if (!valid) revert InvalidClaimProof(epochId, account);
        if (impairmentClaims == address(0)) revert RecoveryEscrowNotConfigured();
        // FIX C-2: cap cumulative minted claims at the epoch's totalClaimSupply.
        // claimImpairmentRecovery divides by totalClaimSupply assuming claims
        // never exceed it; an over-stated root (leaves summing past the cap)
        // would otherwise dilute honest holders / over-pay early claimers.
        uint256 mintedSupply = ICreatorOImpairmentClaims(impairmentClaims).totalSupply(epochId);
        if (mintedSupply + amount > epoch.totalClaimSupply) {
            revert ClaimSupplyExceeded(epochId, epoch.totalClaimSupply, mintedSupply + amount);
        }

        impairmentClaimMinted[epochId][account] = true;
        ICreatorOImpairmentClaims(impairmentClaims).mintFromVault(account, epochId, amount);
    }

    function notifyImpairmentRecovery(uint256 epochId, uint256 amount) external onlyDelegateCall {
        // FIX H-1: zero-amount notify was a no-op state write + event spam.
        if (amount == 0) revert InvalidAmount();
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.status != ImpairmentEpochStatus.Finalized && epoch.status != ImpairmentEpochStatus.Resolved) {
            revert InvalidImpairmentTransition(epochId);
        }
        // FIX C-3: cleared-trip epochs zero recoveryAsset; safeTransfer on
        // address(0) would otherwise revert opaquely (or worse, a future
        // refactor could route funds to a zero-asset escrow entry).
        if (epoch.recoveryAsset == address(0)) revert ImpairmentRootRequired(epochId);
        if (impairmentRecoveryEscrow == address(0)) revert RecoveryEscrowNotConfigured();
        if (epoch.recoveryAsset == address(_creatorCoin())) {
            // FIX H-1: a raw safeTransfer of the creator coin desyncs the
            // cached coinBalance used by totalAssets(), leaving the recovered
            // amount double-counted (escrow + vault book) until the next sync.
            _pushCreatorCoinExact(impairmentRecoveryEscrow, amount);
        } else {
            IERC20(epoch.recoveryAsset).safeTransfer(impairmentRecoveryEscrow, amount);
        }
        ICreatorORecoveryEscrow(impairmentRecoveryEscrow).notifyRecovery(epoch.recoveryAsset, epochId, amount);
        epoch.totalRecovered += amount;
        emit ImpairmentRecoveryNotified(epochId, epoch.recoveryAsset, amount);
    }

    function claimImpairmentRecovery(uint256 epochId, address receiver, uint256 /*claimUnits*/ ) external onlyDelegateCall returns (uint256 amountOut) {
        if (receiver == address(0)) revert ZeroAddress();
        ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
        if (epoch.totalClaimSupply == 0) revert InvalidImpairmentEpoch(epochId);
        uint256 claimUnits = ICreatorOImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId);
        uint256 gross = (epoch.totalRecovered * claimUnits) / epoch.totalClaimSupply;
        uint256 already = impairmentAmountClaimed[epochId][msg.sender];
        if (gross <= already) revert NothingToClaim(epochId, msg.sender);
        amountOut = gross - already;
        impairmentAmountClaimed[epochId][msg.sender] = gross;
        epoch.totalClaimed += amountOut;
        ICreatorORecoveryEscrow(impairmentRecoveryEscrow).claimRecovery(epoch.recoveryAsset, epochId, receiver, amountOut);
        if (epoch.status == ImpairmentEpochStatus.Finalized && epoch.totalClaimed >= epoch.totalRecovered) {
            epoch.status = ImpairmentEpochStatus.Resolved;
            epoch.resolvedAt = uint64(block.timestamp);
            emit ImpairmentResolved(epochId);
        }
        emit ImpairmentRecoveryClaimed(epochId, msg.sender, receiver, amountOut);
    }

    function _isStrategyListed(address strategy) internal view returns (bool) {
        uint256 len = strategyList.length;
        for (uint256 i = 0; i < len; i++) {
            if (strategyList[i] == strategy) return true;
        }
        return false;
    }

    function _revertBytes(bytes memory ret) internal pure {
        assembly {
            revert(add(ret, 32), mload(ret))
        }
    }
}
