// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";
import {IStrategyValuation} from "../../interfaces/IStrategyValuation.sol";

interface ICreatorOVaultLike {
    function CREATOR_COIN() external view returns (IERC20);
}

/**
 * @title ERC4626StrategyAdapter
 * @author 0xakita.eth
 * @notice Adapts an ERC-4626 vault to the `IStrategy` interface.
 * @dev Used by CreatorOVault to integrate ERC-4626 yield sources.
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

    // ================================
    // STATE
    // ================================

    /// @notice CreatorOVault that owns this strategy.
    address public immutable vault;

    /// @notice Underlying asset token (must match the ERC-4626 `asset()`).
    IERC20 public immutable ASSET;

    /// @notice Target ERC-4626 vault (strategy holds shares of this vault).
    IERC4626 public immutable ERC4626_VAULT;

    /// @notice Strategy active flag.
    bool private _isActive;

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

        // Safety: prevent wiring a strategy with an asset that doesn't match the vault's creator coin.
        require(address(ICreatorOVaultLike(_vault).CREATOR_COIN()) == assetAddr, "Vault/asset mismatch");

        _isActive = true;
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
    function isValuationReady() external view override returns (bool) {
        (bool ok, uint256 currentAssetsPerShare) = _readCurrentAssetsPerShare();
        if (!ok) {
            return false;
        }

        // No ERC-4626 share exposure to value.
        if (currentAssetsPerShare == 0) return true;

        uint256 snapshot = lastValuationAssetsPerShare;
        if (snapshot == 0) {
            // Snapshot not initialized yet; first sync happens after strategy operations.
            return true;
        }

        return _isWithinValuationBounds(snapshot, currentAssetsPerShare);
    }

    function getTotalAssets() public view override returns (uint256) {
        uint256 idle = ASSET.balanceOf(address(this));
        uint256 sharesHeld = ERC4626_VAULT.balanceOf(address(this));
        if (sharesHeld == 0) return idle;

        // Best-effort conversion (some 4626 implementations can revert in edge cases).
        try ERC4626_VAULT.convertToAssets(sharesHeld) returns (uint256 assetsFromShares) {
            return idle + assetsFromShares;
        } catch {
            return idle;
        }
    }

    // ================================
    // ISTRATEGY OPERATIONS
    // ================================

    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        if (amount == 0) return 0;

        // Pull assets from the vault. `onlyVault` guarantees msg.sender is the trusted vault.
        ASSET.safeTransferFrom(msg.sender, address(this), amount);

        // Maintain idle buffer: deposit only excess idle into the ERC4626 vault.
        uint256 total = getTotalAssets();
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = ASSET.balanceOf(address(this));
        uint256 toDeposit = idle > desiredIdle ? idle - desiredIdle : 0;

        if (toDeposit > 0) {
            // Best-effort: if the ERC4626 deposit reverts, keep funds idle (never brick vault ops).
            ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
            try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {}
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

        // Best-effort: withdraw as much as possible from the ERC4626 vault.
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
        // CreatorOVault accounts for gains via totalAssets() deltas in `report()`.
        profit = 0;
        emit StrategyHarvest(profit);
    }

    function rebalance() external override onlyVault {
        // Best-effort idle buffer maintenance:
        // - deposit excess idle to ERC4626
        // - or withdraw from ERC4626 to restore idle if needed
        uint256 total = getTotalAssets();
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = ASSET.balanceOf(address(this));

        if (idle > desiredIdle) {
            uint256 toDeposit = idle - desiredIdle;
            if (toDeposit > 0) {
                ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
                try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {}
            }
        } else if (idle < desiredIdle) {
            uint256 toPull = desiredIdle - idle;
            if (toPull > 0) {
                _withdrawFrom4626BestEffort(toPull);
            }
        }

        _syncValuationSnapshotBestEffort();
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
        if (maxIncreaseBps > 10_000 || maxDecreaseBps > 10_000) revert InvalidBps();
        if (checkWindow == 0) revert InvalidWindow();

        valuationMaxIncreaseBps = maxIncreaseBps;
        valuationMaxDecreaseBps = maxDecreaseBps;
        valuationCheckWindow = checkWindow;

        emit ValuationGuardUpdated(maxIncreaseBps, maxDecreaseBps, checkWindow);
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        // Don't allow rescuing the underlying while active.
        if (token == address(ASSET) && _isActive) revert("Cannot rescue asset when active");
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
        try ERC4626_VAULT.convertToAssets(sharesHeld) returns (uint256 convertedAssets) {
            assetsFromShares = convertedAssets;
        } catch {
            return (false, 0);
        }

        assetsPerShare = Math.mulDiv(assetsFromShares, 1e18, sharesHeld);
        return (true, assetsPerShare);
    }

    function _allowedBpsForElapsedWindows(uint256 perWindowBps) internal view returns (uint256 allowedBps) {
        if (perWindowBps >= 10_000) return 10_000;

        uint256 elapsed = block.timestamp > lastValuationTimestamp ? block.timestamp - lastValuationTimestamp : 0;
        uint256 windowsElapsed = (elapsed / valuationCheckWindow) + 1; // always allow at least one window
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

        lastValuationAssetsPerShare = currentAssetsPerShare;
        lastValuationTimestamp = block.timestamp;
        emit ValuationSnapshotSynced(currentAssetsPerShare, block.timestamp);
    }
}

