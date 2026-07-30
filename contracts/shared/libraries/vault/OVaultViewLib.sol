// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IStrategy} from "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";

interface IOVaultViewHost {
    function balanceOf(address account) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function maxWithdraw(address owner) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function pricePerShare() external view returns (uint256);
    function queuedWithdrawals(address user)
        external
        view
        returns (uint256 shares, uint256 unlockBlock, address receiver);
    function lastDepositBlock(address user) external view returns (uint256);
    function withdrawDelayBlocks() external view returns (uint256);
    function largeWithdrawalThreshold() external view returns (uint256);
    function largeWithdrawalDelayBlocks() external view returns (uint256);
    function paused() external view returns (bool);
    function vaultMode() external view returns (uint8);
    function ppsCheckpointWrites() external view returns (uint64);
    function ppsCheckpoints(uint64 index) external view returns (uint40 timestamp, uint216 pps);
    function CREATOR_COIN() external view returns (address);
    function coinBalance() external view returns (uint256);
    function strategyCount() external view returns (uint256);
    function strategyList(uint256 index) external view returns (address);
    function activeStrategies(address strategy) external view returns (bool);
    function strategyImpaired(address strategy) external view returns (bool);
    function strategyDebt(address strategy) external view returns (uint256);
    function strategyMaxAssets(address strategy) external view returns (uint256);
    function ccaLaunchArm() external view returns (address);
    function totalLockedShares() external view returns (uint256);
    function fullProfitUnlockDate() external view returns (uint256);
    function lastProfitUnlockUpdate() external view returns (uint256);
    function profitUnlockingRate() external view returns (uint256);
    function isShutdown() external view returns (bool);
    function whitelistEnabled() external view returns (bool);
    function whitelist(address account) external view returns (bool);
    function maxTotalSupply() external view returns (uint256);
    function depositLimit() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function totalQueuedWithdrawalShares() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function erc4626PreviewRedeem(uint256 shares) external view returns (uint256);
}

interface IOVaultCcaLifecycleStatusReader {
    struct CcaLifecycleStatus {
        uint8 phase;
    }

    function getLifecycleStatus() external view returns (CcaLifecycleStatus memory status);
}

interface IOVaultCcaPhaseReader {
    function phase() external view returns (uint8);
}

/**
 * @title OVaultViewLib
 * @notice Fat EIP-170 view helpers for CreatorOVault / AgentOVault facades.
 * @dev Linked external library. Host exposes public getters used below.
 */
library OVaultViewLib {
    uint64 internal constant PPS_CHECKPOINT_CAPACITY = 64;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;
    uint256 internal constant MAX_BPS_EXTENDED = 1_000_000_000_000;
    uint8 internal constant VAULT_MODE_NORMAL = 0;
    uint8 internal constant CCA_PHASE_AUCTION_LIVE = 1;
    /// @dev Must match CreatorOVault / OVaultModuleConstants.DECIMALS_OFFSET.
    uint8 internal constant DECIMALS_OFFSET = 3;

    error InvalidAmount();

    struct VaultPosition {
        uint256 shares;
        uint256 assets;
        uint256 maxWithdrawNow;
        uint256 queuedShares;
        uint256 queuedAssetsEst;
        uint256 queuedUnlockBlock;
        uint256 cooldownEndBlock;
        bool claimableNow;
    }

    struct WithdrawalEta {
        bool available;
        bool requiresAsync;
        uint256 cooldownEndBlock;
        uint256 earliestClaimBlock;
    }

    function positionOf(address host, address user) external view returns (VaultPosition memory p) {
        IOVaultViewHost h = IOVaultViewHost(host);
        p.shares = h.balanceOf(user);
        p.assets = p.shares == 0 ? 0 : h.previewRedeem(p.shares);
        p.maxWithdrawNow = h.maxWithdraw(user);
        (uint256 qShares, uint256 unlockBlock,) = h.queuedWithdrawals(user);
        p.queuedShares = qShares;
        p.queuedAssetsEst = qShares == 0 ? 0 : h.convertToAssets(qShares);
        p.queuedUnlockBlock = unlockBlock;
        p.cooldownEndBlock = h.lastDepositBlock(user) + h.withdrawDelayBlocks();
        bool paused = h.paused();
        p.claimableNow = qShares > 0 && block.number >= unlockBlock && !paused && h.vaultMode() == VAULT_MODE_NORMAL;
    }

    function withdrawalEta(address host, address user, uint256 shares)
        external
        view
        returns (WithdrawalEta memory eta)
    {
        if (shares == 0) revert InvalidAmount();
        IOVaultViewHost h = IOVaultViewHost(host);
        eta.available = !h.paused() && h.vaultMode() == VAULT_MODE_NORMAL;
        eta.cooldownEndBlock = h.lastDepositBlock(user) + h.withdrawDelayBlocks();
        uint256 startBlock = block.number > eta.cooldownEndBlock ? block.number : eta.cooldownEndBlock;

        uint256 threshold = h.largeWithdrawalThreshold();
        eta.requiresAsync = threshold != 0 && h.convertToAssets(shares) >= threshold;
        if (!eta.requiresAsync) {
            eta.earliestClaimBlock = startBlock;
            return eta;
        }

        uint256 unlock = startBlock + h.largeWithdrawalDelayBlocks();
        (, uint256 existingUnlock,) = h.queuedWithdrawals(user);
        eta.earliestClaimBlock = existingUnlock > unlock ? existingUnlock : unlock;
    }

    function ppsCheckpointAtOrBefore(address host, uint40 timestamp)
        external
        view
        returns (bool found, uint40 ts, uint216 pps)
    {
        IOVaultViewHost h = IOVaultViewHost(host);
        uint64 writes = h.ppsCheckpointWrites();
        uint64 count = writes > PPS_CHECKPOINT_CAPACITY ? PPS_CHECKPOINT_CAPACITY : writes;
        for (uint64 k = 0; k < count; k++) {
            uint64 idx = (writes - 1 - k) % PPS_CHECKPOINT_CAPACITY;
            (uint40 cTs, uint216 cPps) = h.ppsCheckpoints(idx);
            if (cTs <= timestamp) return (true, cTs, cPps);
        }
        return (false, 0, 0);
    }

    function apyBps(address host, uint64 windowSeconds) external view returns (bool available, int256 apy) {
        if (windowSeconds == 0) revert InvalidAmount();
        IOVaultViewHost h = IOVaultViewHost(host);
        uint40 target = block.timestamp > windowSeconds ? uint40(block.timestamp - windowSeconds) : 0;

        bool found;
        uint40 ts;
        uint216 ppsThen;
        {
            uint64 writes = h.ppsCheckpointWrites();
            uint64 count = writes > PPS_CHECKPOINT_CAPACITY ? PPS_CHECKPOINT_CAPACITY : writes;
            for (uint64 k = 0; k < count; k++) {
                uint64 idx = (writes - 1 - k) % PPS_CHECKPOINT_CAPACITY;
                (uint40 cTs, uint216 cPps) = h.ppsCheckpoints(idx);
                if (cTs <= target) {
                    found = true;
                    ts = cTs;
                    ppsThen = cPps;
                    break;
                }
            }
        }
        if (!found || ppsThen == 0 || block.timestamp <= ts) return (false, 0);

        uint256 ppsNow = h.pricePerShare();
        uint256 elapsed = block.timestamp - ts;
        int256 diff = int256(ppsNow) - int256(uint256(ppsThen));
        apy = (diff * int256(SECONDS_PER_YEAR) * 10_000) / (int256(uint256(ppsThen)) * int256(elapsed));
        return (true, apy);
    }

    function unlockedShares(address host) external view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        uint256 locked = h.totalLockedShares();
        if (locked == 0) return 0;

        uint256 unlockDate = h.fullProfitUnlockDate();
        if (unlockDate == 0) return 0;

        uint256 checkpoint = h.lastProfitUnlockUpdate();
        uint256 currentTime = block.timestamp;
        if (currentTime <= checkpoint) return 0;
        if (currentTime >= unlockDate) return locked;

        uint256 elapsed = currentTime - checkpoint;
        uint256 unlockedAmount = (h.profitUnlockingRate() * elapsed) / MAX_BPS_EXTENDED;
        return unlockedAmount > locked ? locked : unlockedAmount;
    }

    function strategyAssetsSafe(address host, address strategy) external view returns (uint256) {
        return _strategyAssetsSafe(host, strategy);
    }

    function _strategyAssetsSafe(address host, address strategy) private view returns (uint256 assets) {
        IOVaultViewHost h = IOVaultViewHost(host);
        try IStrategy(strategy).getTotalAssets() returns (uint256 reportedAssets) {
            assets = reportedAssets;
        } catch {
            assets = h.strategyDebt(strategy);
        }

        uint256 cap = h.strategyMaxAssets(strategy);
        if (cap == 0) {
            uint256 debt = h.strategyDebt(strategy);
            if (assets > debt) assets = debt;
        } else if (assets > cap) {
            assets = cap;
        }
    }

    function totalAssets(address host) external view returns (uint256) {
        return _totalAssets(host);
    }

    function _totalAssets(address host) private view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        uint256 idle = h.coinBalance();
        uint256 live = IERC20(h.CREATOR_COIN()).balanceOf(host);
        if (live < idle) idle = live;

        uint256 total = idle;
        uint256 len = h.strategyCount();
        for (uint256 i; i < len; i++) {
            address strategy = h.strategyList(i);
            if (h.activeStrategies(strategy) && !h.strategyImpaired(strategy)) {
                total += _strategyAssetsSafe(host, strategy);
            }
        }
        return total;
    }

    function firstStrategyValuationNotReady(address host) external view returns (address) {
        return _firstStrategyValuationNotReady(host);
    }

    function _firstStrategyValuationNotReady(address host) private view returns (address bad) {
        IOVaultViewHost h = IOVaultViewHost(host);
        uint256 len = h.strategyCount();
        for (uint256 i; i < len; i++) {
            address strategy = h.strategyList(i);
            if (!h.activeStrategies(strategy) || h.strategyImpaired(strategy)) continue;

            try IStrategyValuation(strategy).isValuationReady() returns (bool ok) {
                if (!ok) return strategy;
            } catch {
                return strategy;
            }

            try IStrategy(strategy).getTotalAssets() returns (uint256) {}
            catch {
                return strategy;
            }
        }
        return address(0);
    }

    function isCcaAuctionLive(address host) external view returns (bool) {
        return _isCcaAuctionLive(host);
    }

    function _isCcaAuctionLive(address host) private view returns (bool) {
        address strategy = IOVaultViewHost(host).ccaLaunchArm();
        if (strategy == address(0)) return false;

        try IOVaultCcaLifecycleStatusReader(strategy).getLifecycleStatus()
        returns (IOVaultCcaLifecycleStatusReader.CcaLifecycleStatus memory status) {
            return status.phase == CCA_PHASE_AUCTION_LIVE;
        } catch {
            try IOVaultCcaPhaseReader(strategy).phase() returns (uint8 phaseValue) {
                return phaseValue == CCA_PHASE_AUCTION_LIVE;
            } catch {
                return true;
            }
        }
    }

    function assessUnrealisedLoss(address host, address strategy, uint256 currentDebt, uint256 assetsNeeded)
        external
        view
        returns (uint256)
    {
        uint256 strategyAssets = _strategyAssetsSafe(host, strategy);
        if (strategyAssets >= currentDebt || currentDebt == 0) {
            return 0;
        }

        uint256 numerator = assetsNeeded * strategyAssets;
        uint256 lossShare = assetsNeeded - (numerator / currentDebt);
        if (numerator % currentDebt != 0) {
            lossShare += 1;
        }
        return lossShare;
    }

    function remainingDepositAssets(address host) external view returns (uint256) {
        return _remainingDepositAssets(host);
    }

    function _remainingDepositAssets(address host) private view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        uint256 limit = h.depositLimit();
        if (limit == 0) return type(uint256).max;
        uint256 ta = _totalAssets(host);
        if (ta >= limit) return 0;
        return limit - ta;
    }

    function maxDeposit(address host, address receiver) external view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        if (h.vaultMode() != VAULT_MODE_NORMAL) return 0;
        if (_isCcaAuctionLive(host)) return 0;
        if (h.paused() || h.isShutdown()) return 0;
        if (h.whitelistEnabled() && !h.whitelist(receiver)) return 0;
        if (_firstStrategyValuationNotReady(host) != address(0)) return 0;
        uint256 currentSupply = h.totalSupply();
        uint256 maxSupply = h.maxTotalSupply();
        if (currentSupply >= maxSupply) return 0;

        uint256 byShares = type(uint256).max;
        if (maxSupply != type(uint256).max) {
            uint256 remainingShares = maxSupply - currentSupply;
            if (currentSupply == 0) {
                byShares = remainingShares / (10 ** uint256(DECIMALS_OFFSET));
            } else {
                byShares = (remainingShares * _totalAssets(host)) / currentSupply;
            }
        }
        uint256 byAssets = _remainingDepositAssets(host);
        return byShares < byAssets ? byShares : byAssets;
    }

    function maxMint(address host, address receiver) external view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        if (h.vaultMode() != VAULT_MODE_NORMAL) return 0;
        if (_isCcaAuctionLive(host)) return 0;
        if (h.paused() || h.isShutdown()) return 0;
        if (h.whitelistEnabled() && !h.whitelist(receiver)) return 0;
        if (_firstStrategyValuationNotReady(host) != address(0)) return 0;
        uint256 currentSupply = h.totalSupply();
        uint256 maxSupply = h.maxTotalSupply();
        if (currentSupply >= maxSupply) return 0;
        uint256 byShares = maxSupply == type(uint256).max ? type(uint256).max : maxSupply - currentSupply;
        uint256 remainingAssets = _remainingDepositAssets(host);
        if (remainingAssets == type(uint256).max) return byShares;
        if (remainingAssets == 0) return 0;
        uint256 byAssets = h.convertToShares(remainingAssets);
        return byShares < byAssets ? byShares : byAssets;
    }

    /// @dev Gap-analysis G-5 / ODA-427-F4: quote against withdrawable liquidity
    ///      (idle + best-effort per-strategy `maxWithdraw`), not raw NAV.
    function maxWithdraw(address host, address owner_) external view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        if (h.vaultMode() != VAULT_MODE_NORMAL) return 0;
        if (h.paused()) return 0;
        uint256 userShares = h.balanceOf(owner_);
        if (userShares == 0) return 0;
        uint256 assetsFromShares = h.previewRedeem(userShares);
        uint256 liquid = _estimatedWithdrawableLiquidity(host);
        uint256 reserved = h.erc4626PreviewRedeem(h.totalQueuedWithdrawalShares());
        uint256 available = liquid > reserved ? liquid - reserved : 0;
        if (assetsFromShares > available) assetsFromShares = available;
        uint256 threshold = h.largeWithdrawalThreshold();
        if (threshold == 0) return assetsFromShares;
        uint256 maxSyncAssets = threshold - 1;
        return assetsFromShares > maxSyncAssets ? maxSyncAssets : assetsFromShares;
    }

    function _estimatedWithdrawableLiquidity(address host) private view returns (uint256 liquid) {
        IOVaultViewHost h = IOVaultViewHost(host);
        uint256 idle = h.coinBalance();
        uint256 live = IERC20(h.CREATOR_COIN()).balanceOf(host);
        if (live < idle) idle = live;
        liquid = idle;
        uint256 len = h.strategyCount();
        for (uint256 i; i < len; i++) {
            address strategy = h.strategyList(i);
            if (!h.activeStrategies(strategy) || h.strategyImpaired(strategy)) continue;
            liquid += _strategyWithdrawableEstimate(host, strategy);
        }
    }

    function _strategyWithdrawableEstimate(address host, address strategy) private view returns (uint256) {
        uint256 cap = _strategyAssetsSafe(host, strategy);
        try IERC4626(strategy).maxWithdraw(host) returns (uint256 w) {
            return w > cap ? cap : w;
        } catch {
            return cap;
        }
    }

    function maxRedeem(address host, address owner_) external view returns (uint256) {
        IOVaultViewHost h = IOVaultViewHost(host);
        if (h.vaultMode() != VAULT_MODE_NORMAL) return 0;
        if (h.paused()) return 0;
        uint256 userShares = h.balanceOf(owner_);
        if (userShares == 0) return 0;
        uint256 threshold = h.largeWithdrawalThreshold();
        if (threshold == 0) return userShares;

        uint256 maxSyncAssets = threshold - 1;
        uint256 syncShares = h.previewWithdraw(maxSyncAssets);
        return syncShares > userShares ? userShares : syncShares;
    }

    function previewRedeem(address host, uint256 shares, uint256 uncappedAssets) external view returns (uint256) {
        uint256 liquid = _totalAssets(host);
        uint256 reserved = IOVaultViewHost(host).erc4626PreviewRedeem(
            IOVaultViewHost(host).totalQueuedWithdrawalShares()
        );
        uint256 available = liquid > reserved ? liquid - reserved : 0;
        return uncappedAssets > available ? available : uncappedAssets;
    }
}
