// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {IStrategy} from "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";

/**
 * @notice Optional Ajna inner-vault bucket ops used by the ERC-4626 strategy adapter.
 * @dev Non-Ajna ERC-4626 vaults simply leave these methods unimplemented; forwarding
 *      uses try/catch so the adapter stays generic.
 */
interface IAjnaBucketOps {
    function moveFromBuffer(uint256 toIndex, uint256 assets)
        external
        returns (uint256 movedAssets, uint256 mintedBucketLp);

    function move(uint256 fromIndex, uint256 toIndex, uint256 bucketLpAmount)
        external
        returns (uint256 fromBucketLp, uint256 toBucketLp);

    function moveToBuffer(uint256 fromIndex, uint256 bucketLpAmount)
        external
        returns (uint256 pulledAssets, uint256 burnedBucketLp);

    function getBuckets() external view returns (uint256[] memory);

    function bucketLp(uint256 bucketIndex) external view returns (uint256);
}

/**
 * @title ERC4626StrategyAdapter
 * @author 0xakita.eth
 * @notice Adapts an ERC-4626 vault to the `IStrategy` interface.
 * @dev Used by lane vaults (CreatorOVault / AgentOVault) to integrate ERC-4626 yield sources.
 */
contract ERC4626StrategyAdapter is IStrategy, IStrategyValuation, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // ERRORS
    // ================================

    error OnlyVault();
    error StrategyPaused();
    error InvalidBps();
    error InvalidWindow();
    // FIX: S-C04 — block deposits during active rebalance
    error RebalanceInProgress();
    error InnerDepositFailed();
    error CannotRescueAssetWhenActive();
    error CannotRescuePositionShares();
    /// @notice ODA-423-H01 — idle ASSET may only return to the owning vault.
    error CannotRescueAssetToNonVault();
    error ZeroAddress();
    error InnerBucketOpFailed();

    // ================================
    // STATE
    // ================================

    /// @notice Lane vault that owns this strategy.
    address public immutable vault;

    /// @notice Underlying asset token (must match the ERC-4626 `asset()`).
    IERC20 public immutable ASSET;

    /// @notice Target ERC-4626 vault (strategy holds shares of this vault).
    IERC4626 public immutable ERC4626_VAULT;

    /// @notice Strategy active flag.
    bool private _isActive;

    /// @notice FIX: S-C04 — rebalance lock prevents deposit-during-rebalance window
    bool public rebalanceActive;

    /// @notice Target % of strategy assets to keep idle (basis points).
    uint256 public idleBufferBps = 1000; // 10% default

    /// @notice Maximum upward valuation move allowed per check window (basis points).
    uint256 public valuationMaxIncreaseBps = 1000; // 10%

    /// @notice Maximum downward valuation move allowed per check window (basis points).
    uint256 public valuationMaxDecreaseBps = 1000; // 10%

    /// @notice Length of one valuation guard window (seconds).
    uint256 public valuationCheckWindow = 30 minutes;

    /// @notice Last trusted assets-per-share snapshot (1e18 scale).
    uint256 public lastValuationAssetsPerShare;

    /// @notice Timestamp when valuation snapshot was last synchronized.
    uint256 public lastValuationTimestamp;

    // ================================
    // EVENTS
    // ================================

    event ValuationGuardUpdated(uint256 maxIncreaseBps, uint256 maxDecreaseBps, uint256 checkWindow);
    event ValuationSnapshotSynced(uint256 assetsPerShare, uint256 timestamp);
    // FIX: S-H03 — surface silent deposit failures during rebalance
    event RebalanceDepositFailed(uint256 amount, bytes reason);
    event AjnaBufferMovedToBucket(uint256 indexed toIndex, uint256 assets, uint256 mintedBucketLp);
    event AjnaBucketMoved(uint256 indexed fromIndex, uint256 indexed toIndex, uint256 fromBucketLp, uint256 toBucketLp);
    event AjnaBucketMovedToBuffer(uint256 indexed fromIndex, uint256 pulledAssets, uint256 burnedBucketLp);
    event AjnaBucketsDrained(uint256 bucketsProcessed, uint256 residualBuckets);
    /// @notice ODA-519-12: inner deposit deferred (paused/cap/revert) — assets left idle.
    event InnerDepositDeferred(uint256 amount, bytes reason);

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    modifier whenActive() {
        if (!_isActive) revert StrategyPaused();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _vault, address _erc4626Vault, address _owner) Ownable(_owner) {
        require(_vault != address(0), "Invalid vault");
        require(_erc4626Vault != address(0), "Invalid ERC4626");

        vault = _vault;
        ERC4626_VAULT = IERC4626(_erc4626Vault);

        address assetAddr = IERC4626(_erc4626Vault).asset();
        require(assetAddr != address(0), "Invalid asset");
        ASSET = IERC20(assetAddr);

        // Safety: prevent wiring a strategy with an asset that doesn't match the outer vault's asset.
        require(IERC4626(_vault).asset() == assetAddr, "Vault/asset mismatch");

        _isActive = true;

        // FIX: M-10 (4626-319) — seed the valuation snapshot immediately on
        // construction. Previously isValuationReady() returned true whenever
        // `lastValuationAssetsPerShare == 0`, which is the initial state until
        // the first strategy operation. During that window deposits routed
        // here were not bounded against the underlying ERC-4626's assets-per-
        // share, leaving an inflation-attack window on any freshly-deployed
        // 4626 vault. Best-effort read on construction closes that window; if
        // the underlying read reverts (empty / uninitialized), the snapshot
        // stays zero and isValuationReady() will still tolerate the absence
        // of exposure (currentAssetsPerShare == 0 branch above).
        _syncValuationSnapshotBestEffort();
    }

    // ================================
    // ISTRATEGY VIEW
    // ================================

    function isActive() external view override returns (bool) {
        return _isActive;
    }

    function asset() external view override returns (address) {
        return address(ASSET);
    }

    /**
     * @notice Strategy valuation health check for ERC-4626 deposit/mint gating.
     * @dev MUST NOT revert. Returns false when the underlying ERC-4626 conversion
     *      reverts for any held shares.
     */
    /// @notice Cap drift windows so the valuation guard cannot self-disable (ODA-423-M07).
    uint256 internal constant MAX_VALUATION_WINDOWS = 3;

    function isValuationReady() external view override returns (bool) {
        (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
        if (!ok) {
            return false;
        }

        // No ERC-4626 share exposure to value.
        if (currentAssetsPerShare == 0) return true;

        uint256 snapshot = lastValuationAssetsPerShare;
        if (snapshot == 0) {
            // FIX: M-10 (4626-319) — returning true here previously let
            // deposits through when there was ERC-4626 share exposure but no
            // trusted snapshot (e.g. constructor read reverted, or an
            // operator manually cleared it). Treat that state as NOT ready.
            // Honest path: the constructor now seeds the snapshot, and every
            // strategy op refreshes it. If we still see snapshot == 0 with
            // non-zero current PPS, something is off and we should fail safe.
            return false;
        }

        // ODA-423-M07: snapshot older than MAX_VALUATION_WINDOWS is not ready
        // (do not linearly widen the band to 100%).
        if (valuationCheckWindow > 0 && lastValuationTimestamp > 0) {
            uint256 elapsed =
                block.timestamp > lastValuationTimestamp ? block.timestamp - lastValuationTimestamp : 0;
            if (elapsed > valuationCheckWindow * MAX_VALUATION_WINDOWS) return false;
        }

        return _isWithinValuationBounds(snapshot, currentAssetsPerShare);
    }

    /**
     * @notice Economic NAV: adapter idle + full inner-share claim.
     * @dev Must not haircut to `maxWithdraw`. Ajna intentionally under-reports
     *      `maxWithdraw` as buffer-only liquidity; clamping here fabricated losses when
     *      capital moved into buckets and caused OVault over-allocation / `report` PnL.
     *      Use `getRealizableAssets()` for synchronous withdrawal sizing.
     */
    function getTotalAssets() public view override returns (uint256) {
        uint256 idle = ASSET.balanceOf(address(this));
        uint256 sharesHeld = ERC4626_VAULT.balanceOf(address(this));
        if (sharesHeld == 0) return idle;

        // ODA-519-11: prefer tax-aware previewRedeem (Ajna overrides it); fall back to convertToAssets.
        try ERC4626_VAULT.previewRedeem(sharesHeld) returns (uint256 assetsFromShares) {
            return idle + assetsFromShares;
        } catch {
            try ERC4626_VAULT.convertToAssets(sharesHeld) returns (uint256 assetsFromShares) {
                return idle + assetsFromShares;
            } catch {
                return idle;
            }
        }
    }

    /**
     * @notice Immediately realizable assets (adapter idle + inner `maxWithdraw`).
     * @dev For Ajna this is typically buffer-backed liquidity only.
     */
    function getRealizableAssets() public view returns (uint256) {
        return ASSET.balanceOf(address(this)) + _maxWithdrawBestEffort();
    }

    // ================================
    // ISTRATEGY OPERATIONS
    // ================================

    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        // FIX: S-C04 — prevent deposit during rebalance window
        if (rebalanceActive) revert RebalanceInProgress();
        if (amount == 0) return 0;

        // Pull assets from the vault. `onlyVault` guarantees msg.sender is the trusted vault.
        ASSET.safeTransferFrom(msg.sender, address(this), amount);

        // Maintain idle buffer: deposit only excess idle into the ERC4626 vault.
        uint256 total = getTotalAssets();
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = ASSET.balanceOf(address(this));
        uint256 toDeposit = idle > desiredIdle ? idle - desiredIdle : 0;

        if (toDeposit > 0) {
            // ODA-519-12: clamp to inner maxDeposit and soft-fail like rebalance (don't brick lane deposits).
            try ERC4626_VAULT.maxDeposit(address(this)) returns (uint256 maxIn) {
                if (toDeposit > maxIn) toDeposit = maxIn;
            } catch {}
            if (toDeposit > 0) {
                ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
                try ERC4626_VAULT.deposit(toDeposit, address(this)) returns (uint256 shares) {
                    // ODA-466 low: treat zero-share mints as deferred (idle), not hard revert.
                    if (shares == 0) {
                        ASSET.forceApprove(address(ERC4626_VAULT), 0);
                        emit InnerDepositDeferred(toDeposit, bytes("zero-share mint"));
                    }
                } catch (bytes memory reason) {
                    ASSET.forceApprove(address(ERC4626_VAULT), 0);
                    emit InnerDepositDeferred(toDeposit, reason);
                }
            }
        }

        deposited = amount;
        _syncValuationSnapshotBestEffort();
        emit StrategyDeposit(msg.sender, amount, deposited);
    }

    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn) {
        if (amount == 0) return 0;

        uint256 remaining = amount;
        uint256 idle = ASSET.balanceOf(address(this));

        // Use idle first.
        if (idle > 0) {
            uint256 takeIdle = idle > remaining ? remaining : idle;
            if (takeIdle > 0) {
                ASSET.safeTransfer(vault, takeIdle);
                withdrawn += takeIdle;
                remaining -= takeIdle;
            }
        }

        if (remaining > 0) {
            uint256 pulled = _withdrawFrom4626BestEffort(remaining);
            if (pulled > 0) {
                ASSET.safeTransfer(vault, pulled);
                withdrawn += pulled;
            }
        }

        _syncValuationSnapshotBestEffort();
        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 totalWithdrawn) {
        _isActive = false;

        // Stage 1: pull Ajna bucket LP back into the inner buffer when supported.
        _drainBucketsToBufferBestEffort();

        // Stage 2: withdraw realizable inner liquidity (buffer-backed for Ajna).
        uint256 maxAssets = _maxWithdrawBestEffort();
        if (maxAssets > 0) {
            _withdrawFrom4626BestEffort(maxAssets);
        }

        totalWithdrawn = ASSET.balanceOf(address(this));
        if (totalWithdrawn > 0) {
            ASSET.safeTransfer(vault, totalWithdrawn);
        }

        _syncValuationSnapshotBestEffort();
        emit EmergencyWithdraw(vault, totalWithdrawn);
    }

    function harvest() external override onlyVault returns (uint256 profit) {
        // The outer lane vault accounts for gains via totalAssets() deltas in `report()`.
        // ODA-519-7: refresh the valuation window on harvest so idle strategies do not soft-lock.
        _syncValuationSnapshotBestEffort();
        profit = 0;
        emit StrategyHarvest(profit);
    }

    /// @notice Permissionless valuation liveness heartbeat (ODA-519-7).
    /// @dev Advances only the timestamp when current PPS is in-band. Does **not** ratchet
    ///      `lastValuationAssetsPerShare` — a permissionless PPS write would allow compounding
    ///      in-band manipulations across repeated syncs. Use `forceSyncValuation` / strategy ops
    ///      to advance the trusted PPS baseline (ODA-519-8).
    function syncValuation() external {
        (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
        if (!ok) return;

        // No ERC-4626 share exposure: keep PPS at 0 and refresh liveness.
        if (currentAssetsPerShare == 0) {
            lastValuationAssetsPerShare = 0;
            lastValuationTimestamp = block.timestamp;
            emit ValuationSnapshotSynced(0, block.timestamp);
            return;
        }

        uint256 snapshot = lastValuationAssetsPerShare;
        // Bootstrap with exposure requires a privileged path.
        if (snapshot == 0) return;
        if (!_isWithinValuationBounds(snapshot, currentAssetsPerShare)) return;

        lastValuationTimestamp = block.timestamp;
        emit ValuationSnapshotSynced(snapshot, block.timestamp);
    }

    /// @notice Owner escape hatch to re-arm the valuation snapshot after a genuine regime change.
    function forceSyncValuation() external onlyOwner {
        (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
        if (!ok) return;
        lastValuationAssetsPerShare = currentAssetsPerShare;
        lastValuationTimestamp = block.timestamp;
        emit ValuationSnapshotSynced(currentAssetsPerShare, block.timestamp);
    }

    function rebalance() external override onlyVault {
        // FIX: S-C04 — lock to prevent deposit-during-rebalance window
        rebalanceActive = true;

        // FIX: S-M04 — enforce deadline to prevent stale rebalance txs
        // block.timestamp is used as deadline in sub-calls; rebalance must be mined promptly

        uint256 total = getTotalAssets();
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = ASSET.balanceOf(address(this));

        if (idle > desiredIdle) {
            uint256 toDeposit = idle - desiredIdle;
            if (toDeposit > 0) {
                ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
                // FIX: S-H03 — log deposit failure instead of silently swallowing
                try ERC4626_VAULT.deposit(toDeposit, address(this)) returns (uint256 shares) {
                    if (shares == 0) {
                        ASSET.forceApprove(address(ERC4626_VAULT), 0);
                        emit RebalanceDepositFailed(toDeposit, bytes("zero-share mint"));
                    }
                } catch (bytes memory reason) {
                    ASSET.forceApprove(address(ERC4626_VAULT), 0);
                    emit RebalanceDepositFailed(toDeposit, reason);
                }
            }
        } else if (idle < desiredIdle) {
            uint256 toPull = desiredIdle - idle;
            if (toPull > 0) {
                _withdrawFrom4626BestEffort(toPull);
            }
        }

        _syncValuationSnapshotBestEffort();
        rebalanceActive = false;
        emit StrategyRebalanced(getTotalAssets());
    }

    // ================================
    // INTERNAL (BEST-EFFORT 4626)
    // ================================

    function _maxWithdrawBestEffort() internal view returns (uint256) {
        try ERC4626_VAULT.maxWithdraw(address(this)) returns (uint256 maxAssets) {
            return maxAssets;
        } catch {
            return 0;
        }
    }

    function _maxRedeemBestEffort() internal view returns (uint256) {
        try ERC4626_VAULT.maxRedeem(address(this)) returns (uint256 maxShares) {
            return maxShares;
        } catch {
            return 0;
        }
    }

    function _withdrawFrom4626BestEffort(uint256 assets) internal returns (uint256 pulled) {
        if (assets == 0) return 0;

        uint256 maxAssets = _maxWithdrawBestEffort();
        uint256 toWithdraw = assets > maxAssets ? maxAssets : assets;
        if (toWithdraw == 0) return 0;

        // Prefer withdraw(assets) to keep accounting in asset terms.
        try ERC4626_VAULT.withdraw(toWithdraw, address(this), address(this)) returns (
            uint256 /* shares */
        ) {
            pulled = toWithdraw;
            return pulled;
        } catch {
            // Fallback: try redeeming the maximum available shares (or previewWithdraw shares).
            uint256 maxShares = _maxRedeemBestEffort();
            if (maxShares == 0) return 0;

            // Attempt to redeem enough shares for the requested assets.
            uint256 sharesToRedeem = maxShares;
            try ERC4626_VAULT.previewWithdraw(toWithdraw) returns (uint256 previewShares) {
                if (previewShares < sharesToRedeem) sharesToRedeem = previewShares;
            } catch {
                // If previewWithdraw reverts, redeem maxShares (best-effort).
            }

            if (sharesToRedeem == 0) return 0;

            try ERC4626_VAULT.redeem(sharesToRedeem, address(this), address(this)) returns (uint256 assetsOut) {
                return assetsOut;
            } catch {
                return 0;
            }
        }
    }

    function _drainBucketsToBufferBestEffort() internal returns (uint256 residualBuckets) {
        IAjnaBucketOps ops = IAjnaBucketOps(address(ERC4626_VAULT));
        uint256[] memory buckets;
        try ops.getBuckets() returns (uint256[] memory tracked) {
            buckets = tracked;
        } catch {
            return 0;
        }

        uint256 processed;
        for (uint256 i = 0; i < buckets.length; i++) {
            uint256 idx = buckets[i];
            uint256 lpAmount;
            try ops.bucketLp(idx) returns (uint256 lp) {
                lpAmount = lp;
            } catch {
                residualBuckets++;
                continue;
            }
            if (lpAmount == 0) continue;

            try ops.moveToBuffer(idx, lpAmount) {
                // ODA-519-15: partial Ajna redemptions must count as residual, not clean exits.
                uint256 remainingLp;
                try ops.bucketLp(idx) returns (uint256 lpLeft) {
                    remainingLp = lpLeft;
                } catch {
                    residualBuckets++;
                    continue;
                }
                if (remainingLp > 0) {
                    residualBuckets++;
                } else {
                    processed++;
                }
            } catch {
                residualBuckets++;
            }
        }

        emit AjnaBucketsDrained(processed, residualBuckets);
    }

    // ================================
    // AJNA BUCKET FORWARDING (optional)
    // ================================

    /**
     * @notice Deploy idle buffer into an Ajna lending bucket via the inner vault.
     * @dev Adapter must be the inner vault's authenticated swapper. Owner/treasury operates.
     */
    function moveFromBuffer(uint256 toIndex, uint256 assets)
        external
        onlyOwner
        nonReentrant
        returns (uint256 movedAssets, uint256 mintedBucketLp)
    {
        try IAjnaBucketOps(address(ERC4626_VAULT)).moveFromBuffer(toIndex, assets) returns (
            uint256 moved, uint256 minted
        ) {
            movedAssets = moved;
            mintedBucketLp = minted;
            emit AjnaBufferMovedToBucket(toIndex, movedAssets, mintedBucketLp);
        } catch {
            revert InnerBucketOpFailed();
        }
        _syncValuationSnapshotBestEffort();
    }

    /**
     * @notice Rebalance Ajna bucket LP from one index to another via the inner vault.
     */
    function move(uint256 fromIndex, uint256 toIndex, uint256 bucketLpAmount)
        external
        onlyOwner
        nonReentrant
        returns (uint256 fromBucketLp, uint256 toBucketLp)
    {
        try IAjnaBucketOps(address(ERC4626_VAULT)).move(fromIndex, toIndex, bucketLpAmount) returns (
            uint256 fromLp, uint256 toLp
        ) {
            fromBucketLp = fromLp;
            toBucketLp = toLp;
            emit AjnaBucketMoved(fromIndex, toIndex, fromBucketLp, toBucketLp);
        } catch {
            revert InnerBucketOpFailed();
        }
        _syncValuationSnapshotBestEffort();
    }

    /**
     * @notice Pull Ajna bucket LP back into the inner buffer via the inner vault.
     */
    function moveToBuffer(uint256 fromIndex, uint256 bucketLpAmount)
        external
        onlyOwner
        nonReentrant
        returns (uint256 pulledAssets, uint256 burnedBucketLp)
    {
        try IAjnaBucketOps(address(ERC4626_VAULT)).moveToBuffer(fromIndex, bucketLpAmount) returns (
            uint256 pulled, uint256 burned
        ) {
            pulledAssets = pulled;
            burnedBucketLp = burned;
            emit AjnaBucketMovedToBuffer(fromIndex, pulledAssets, burnedBucketLp);
        } catch {
            revert InnerBucketOpFailed();
        }
        _syncValuationSnapshotBestEffort();
    }

    /**
     * @notice Best-effort drain of all tracked Ajna buckets into the inner buffer.
     * @dev Stage-1 emergency / de-risk path. Returns the count of buckets that still hold LP.
     */
    function drainBucketsToBuffer() external onlyOwner nonReentrant returns (uint256 residualBuckets) {
        residualBuckets = _drainBucketsToBufferBestEffort();
        _syncValuationSnapshotBestEffort();
    }

    // ================================
    // ADMIN
    // ================================

    function setActive(bool active) external onlyOwner {
        _isActive = active;
    }

    function setIdleBufferBps(uint256 newBps) external onlyOwner {
        require(newBps <= 10_000, "Invalid bps");
        idleBufferBps = newBps;
    }

    /**
     * @notice Configure valuation guard thresholds and window.
     * @dev The allowed valuation drift scales by full elapsed windows since the last trusted snapshot.
     */
    function setValuationGuard(uint256 maxIncreaseBps, uint256 maxDecreaseBps, uint256 checkWindow) external onlyOwner {
        // ODA-519-18: 10_000 fully disables the guard — require a strict ceiling.
        if (maxIncreaseBps >= 10_000 || maxDecreaseBps >= 10_000) revert InvalidBps();
        if (checkWindow == 0) revert InvalidWindow();

        valuationMaxIncreaseBps = maxIncreaseBps;
        valuationMaxDecreaseBps = maxDecreaseBps;
        valuationCheckWindow = checkWindow;

        emit ValuationGuardUpdated(maxIncreaseBps, maxDecreaseBps, checkWindow);
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        // Never allow rescuing ERC-4626 position shares.
        if (token == address(ERC4626_VAULT)) revert CannotRescuePositionShares();
        // ODA-423-H01: ASSET outflows must go to the owning vault only — mirrors
        // CharmStrategy4626.ownerEmergencyWithdraw. Prevents owner from diverting
        // idle principal via setActive(false) + rescue to an arbitrary address.
        if (token == address(ASSET) && to != vault) revert CannotRescueAssetToNonVault();
        // Defense-in-depth: still block ASSET rescue while the strategy is live.
        if (token == address(ASSET) && _isActive) revert CannotRescueAssetWhenActive();
        IERC20(token).safeTransfer(to, amount);
    }

    // ================================
    // INTERNAL VALUATION GUARD
    // ================================

    function _readCurrentAssetsPerShare() internal view returns (bool ok, uint256 assetsPerShare) {
        uint256 sharesHeld;
        try ERC4626_VAULT.balanceOf(address(this)) returns (uint256 s) {
            sharesHeld = s;
        } catch {
            return (false, 0);
        }

        if (sharesHeld == 0) return (true, 0);

        uint256 assetsFromShares;
        // ODA-519-11: tax-aware preview first.
        try ERC4626_VAULT.previewRedeem(sharesHeld) returns (uint256 previewedAssets) {
            assetsFromShares = previewedAssets;
        } catch {
            try ERC4626_VAULT.convertToAssets(sharesHeld) returns (uint256 convertedAssets) {
                assetsFromShares = convertedAssets;
            } catch {
                return (false, 0);
            }
        }

        assetsPerShare = Math.mulDiv(assetsFromShares, 1e18, sharesHeld);
        return (true, assetsPerShare);
    }

    function _allowedBpsForElapsedWindows(uint256 perWindowBps) internal view returns (uint256 allowedBps) {
        if (perWindowBps >= 10_000) return 10_000;

        uint256 elapsed = block.timestamp > lastValuationTimestamp ? block.timestamp - lastValuationTimestamp : 0;
        uint256 windowsElapsed = (elapsed / valuationCheckWindow) + 1; // always allow at least one window
        // ODA-423-M07: cap window count so allowed drift cannot saturate at 100%.
        if (windowsElapsed > MAX_VALUATION_WINDOWS) windowsElapsed = MAX_VALUATION_WINDOWS;
        allowedBps = perWindowBps * windowsElapsed;
        if (allowedBps > 10_000) allowedBps = 10_000;
    }

    function _isWithinValuationBounds(uint256 snapshotPps, uint256 currentPps) internal view returns (bool) {
        if (currentPps >= snapshotPps) {
            uint256 increase = currentPps - snapshotPps;
            uint256 allowedIncrease = Math.mulDiv(snapshotPps, _allowedBpsForElapsedWindows(valuationMaxIncreaseBps), 10_000);
            return increase <= allowedIncrease;
        }

        uint256 decrease = snapshotPps - currentPps;
        uint256 allowedDecrease = Math.mulDiv(snapshotPps, _allowedBpsForElapsedWindows(valuationMaxDecreaseBps), 10_000);
        return decrease <= allowedDecrease;
    }

    function _syncValuationSnapshotBestEffort() internal {
        (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
        if (!ok) return;

        uint256 snapshot = lastValuationAssetsPerShare;
        // ODA-519-8: do not re-anchor an out-of-band PPS (clears a tripped guard).
        // Bootstrap (snapshot == 0) and zero-exposure still sync normally.
        if (snapshot != 0 && currentAssetsPerShare != 0 && !_isWithinValuationBounds(snapshot, currentAssetsPerShare)) {
            return;
        }

        lastValuationAssetsPerShare = currentAssetsPerShare;
        lastValuationTimestamp = block.timestamp;
        emit ValuationSnapshotSynced(currentAssetsPerShare, block.timestamp);
    }
}
