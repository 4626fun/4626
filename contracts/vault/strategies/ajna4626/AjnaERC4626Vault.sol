// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IAjnaPool} from "../../../interfaces/IAjnaPool.sol";
import {AjnaVaultAuth} from "./AjnaVaultAuth.sol";
import {AjnaVaultBuffer} from "./AjnaVaultBuffer.sol";
import {AjnaVaultLibrary} from "./AjnaVaultLibrary.sol";

/**
 * @title AjnaERC4626Vault
 * @notice Inner ERC-4626 vault that manages an idle buffer plus Ajna quote-token
 *         bucket positions.
 * @dev This vault is intended to sit behind `ERC4626StrategyAdapter`, with
 *      `CreatorOVault` remaining the public product vault.
 */
contract AjnaERC4626Vault is ERC4626, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotAuthorized();
    error VaultPaused();
    error InvalidQuoteToken();
    error BufferLiquidityInsufficient();
    // FIX: F-08 — prevent unbounded _buckets array from causing gas DoS in totalAssets()
    error MaxBucketsReached();

    // FIX: F-08 — cap bucket count to bound gas cost of totalAssets() loop
    uint256 public constant MAX_BUCKETS = 50;

    event BufferMovedToBucket(uint256 indexed bucketIndex, uint256 assets, uint256 bucketLp);
    event BucketMovedToBuffer(uint256 indexed bucketIndex, uint256 assets, uint256 bucketLp);
    event BucketMoved(uint256 indexed fromIndex, uint256 indexed toIndex, uint256 fromBucketLp, uint256 toBucketLp);
    // FIX: F-27 — emit event on fee collection for off-chain transparency
    event FeeCollected(address indexed recipient, uint256 amount);

    IAjnaPool public immutable AJNA_POOL;
    AjnaVaultAuth public immutable AUTH;
    AjnaVaultBuffer public immutable BUFFER;
    IERC20 public immutable ASSET_TOKEN;

    uint256[] private _buckets;
    mapping(uint256 => uint256) private _bucketIndexes;
    mapping(uint256 => uint256) public bucketLp;

    modifier notPaused() {
        if (AUTH.paused()) revert VaultPaused();
        _;
    }

    modifier onlyAdapterAuthorized() {
        if (msg.sender != AUTH.swapper()) revert NotAuthorized();
        _;
    }

    constructor(address pool_, IERC20 asset_, string memory name_, string memory symbol_, AjnaVaultAuth auth_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (pool_ == address(0) || address(asset_) == address(0) || address(auth_) == address(0)) {
            revert InvalidQuoteToken();
        }

        AJNA_POOL = IAjnaPool(pool_);
        AUTH = auth_;
        ASSET_TOKEN = asset_;

        if (AJNA_POOL.quoteTokenAddress() != address(asset_)) revert InvalidQuoteToken();

        BUFFER = new AjnaVaultBuffer(asset_);
        ASSET_TOKEN.forceApprove(address(BUFFER), type(uint256).max);
        ASSET_TOKEN.forceApprove(address(AJNA_POOL), type(uint256).max);
    }

    function totalAssets() public view override returns (uint256 assets) {
        assets = bufferAssets();
        uint256 bucketCount = _buckets.length;
        for (uint256 i = 0; i < bucketCount; i++) {
            uint256 bucketIndex = _buckets[i];
            assets += AjnaVaultLibrary.lpToAssets(AJNA_POOL, bucketIndex, bucketLp[bucketIndex]);
        }
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (AUTH.paused()) return 0;

        uint256 cap = AUTH.depositCap();
        if (cap == 0) return type(uint256).max;

        uint256 currentAssets = totalAssets();
        if (currentAssets >= cap) return 0;
        return cap - currentAssets;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        uint256 maxAssets = maxDeposit(receiver);
        if (maxAssets == 0) return 0;
        if (maxAssets == type(uint256).max) return type(uint256).max;

        uint256 fee = _feeFromTotal(maxAssets, AUTH.toll());
        if (maxAssets <= fee) return 0;
        return super.previewDeposit(maxAssets - fee);
    }

    /// @notice Flag signalling this vault intentionally understates
    /// maxWithdraw / maxRedeem relative to the ERC-4626 spec.
    /// @dev FIX: L-08 (4626-356) — the vault deliberately returns
    /// buffer-only capacity from maxWithdraw/maxRedeem because bucket
    /// LP positions require an on-chain Ajna pool interaction to
    /// liquidate. Integrators (aggregators, routers, indexers) must
    /// read this flag and call `bucketAssets(index)` + `getBuckets()`
    /// to recover the full withdrawable balance. Returning `true` is a
    /// stable ABI contract: it will never silently flip to `false`
    /// without a new contract deployment.
    function isPartialWithdrawVault() external pure returns (bool) {
        return true;
    }

    // =============================================================
    // ERC-4626 deviation flags (FIX: F-19 / 4626-442)
    //
    // Shared convention documented at
    // `docs/contracts/ERC4626_DEVIATION_FLAGS.md`. Integrators (aggregators,
    // routers, indexers, audit tooling) can probe any vault for the same
    // interface and branch on the bitmap.
    //
    // This vault sets bits 0 (maxWithdraw under-reports) and 1 (maxRedeem
    // under-reports) because both methods cap at buffer liquidity rather
    // than share entitlement, per the F-19 / L-08 design decision.
    // =============================================================

    /// @notice Bit 0: maxWithdraw intentionally under-reports vs ERC-4626 spec.
    uint256 public constant DEVIATION_MAX_WITHDRAW_UNDER_REPORTS = 1 << 0;

    /// @notice Bit 1: maxRedeem intentionally under-reports vs ERC-4626 spec.
    uint256 public constant DEVIATION_MAX_REDEEM_UNDER_REPORTS = 1 << 1;

    /// @notice Bitmap of ERC-4626 deviations this vault knowingly takes.
    /// @dev FIX: F-19 (4626-442). Stable ABI: bits only change via a new
    ///      contract deployment. Interpret against the shared convention in
    ///      `docs/contracts/ERC4626_DEVIATION_FLAGS.md`.
    ///      Bit 0 = maxWithdraw under-reports (capped at idle buffer)
    ///      Bit 1 = maxRedeem under-reports (capped at idle buffer)
    ///      Bits 2..255 = reserved for future deviations; always zero here.
    function erc4626DeviationFlags() external pure returns (uint256) {
        return DEVIATION_MAX_WITHDRAW_UNDER_REPORTS | DEVIATION_MAX_REDEEM_UNDER_REPORTS;
    }

    /// @notice Human-readable convenience: true iff maxWithdraw / maxRedeem
    ///         are capped below the share-entitlement value.
    /// @dev Equivalent to `erc4626DeviationFlags() & 0x3 != 0` for this vault.
    ///      Kept separate from `isPartialWithdrawVault()` for semantic clarity:
    ///      `isPartialWithdrawVault` is a vault-wide behavioural flag ("partial
    ///      withdraw semantics"); `hasConservativeMaxWithdraw` is a narrower
    ///      assertion about the maxWithdraw / maxRedeem return values.
    function hasConservativeMaxWithdraw() external pure returns (bool) {
        return true;
    }

    /// @notice Returns the maximum assets withdrawable by `owner` from the idle buffer only.
    /// @dev FIX: F-19 — ERC-4626 deviation: this intentionally understates available assets
    /// because bucket LP positions require an on-chain Ajna pool interaction to liquidate.
    /// Off-chain integrators should query bucket positions separately for total availability.
    /// Probe `erc4626DeviationFlags()` (bit 0) or `hasConservativeMaxWithdraw()` to detect
    /// this deviation without parsing NatSpec. See also `isPartialWithdrawVault()`.
    function maxWithdraw(address owner) public view override returns (uint256) {
        if (AUTH.paused()) return 0;

        uint256 grossAssetsByShares = super.maxWithdraw(owner);
        uint256 grossAssetsFromBuffer = Math.min(grossAssetsByShares, bufferAssets());
        return _netFromGross(grossAssetsFromBuffer, AUTH.tax());
    }

    /// @notice Returns the maximum shares redeemable by `owner` backed by idle buffer only.
    /// @dev FIX: F-19 — see maxWithdraw; same ERC-4626 deviation applies. Probe
    ///      `erc4626DeviationFlags()` (bit 1) or `hasConservativeMaxWithdraw()` to detect.
    function maxRedeem(address owner) public view override returns (uint256) {
        if (AUTH.paused()) return 0;

        uint256 grossAssetsByShares = super.maxWithdraw(owner);
        uint256 grossAssetsFromBuffer = Math.min(grossAssetsByShares, bufferAssets());
        uint256 sharesFromBuffer = super.previewWithdraw(grossAssetsFromBuffer);
        uint256 ownerBalance = balanceOf(owner);
        return sharesFromBuffer < ownerBalance ? sharesFromBuffer : ownerBalance;
    }

    function previewDeposit(uint256 assets) public view override returns (uint256) {
        uint256 fee = _feeFromTotal(assets, AUTH.toll());
        if (assets <= fee) return 0;
        return super.previewDeposit(assets - fee);
    }

    function previewMint(uint256 shares) public view override returns (uint256) {
        uint256 netAssets = super.previewMint(shares);
        return netAssets + _feeFromNet(netAssets, AUTH.toll());
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        uint256 grossAssets = _grossUp(assets, AUTH.tax());
        return super.previewWithdraw(grossAssets);
    }

    function previewRedeem(uint256 shares) public view override returns (uint256) {
        uint256 grossAssets = super.previewRedeem(shares);
        return _netFromGross(grossAssets, AUTH.tax());
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        onlyAdapterAuthorized
        notPaused
        nonReentrant
        returns (uint256 shares)
    {
        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) revert ERC4626ExceededMaxDeposit(receiver, assets, maxAssets);

        ASSET_TOKEN.safeTransferFrom(msg.sender, address(this), assets);

        uint256 fee = _feeFromTotal(assets, AUTH.toll());
        uint256 netAssets = assets - fee;
        shares = super.previewDeposit(netAssets);

        _sendFee(fee);
        _bufferDeposit(netAssets);
        _mint(receiver, shares);

        // FIX: F-03 — emit full `assets` (caller-supplied amount) per ERC-4626 spec, not `netAssets`
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver)
        public
        override
        onlyAdapterAuthorized
        notPaused
        nonReentrant
        returns (uint256 assetsIn)
    {
        uint256 maxShares = maxMint(receiver);
        if (shares > maxShares) revert ERC4626ExceededMaxMint(receiver, shares, maxShares);

        uint256 netAssets = super.previewMint(shares);
        uint256 fee = _feeFromNet(netAssets, AUTH.toll());
        assetsIn = netAssets + fee;

        ASSET_TOKEN.safeTransferFrom(msg.sender, address(this), assetsIn);

        _sendFee(fee);
        _bufferDeposit(netAssets);
        _mint(receiver, shares);

        // FIX: F-03 — emit full `assetsIn` (total transferred) per ERC-4626 spec, not `netAssets`
        emit Deposit(msg.sender, receiver, assetsIn, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        onlyAdapterAuthorized
        notPaused
        nonReentrant
        returns (uint256 shares)
    {
        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);

        uint256 grossAssets = _grossUp(assets, AUTH.tax());
        if (grossAssets > bufferAssets()) revert BufferLiquidityInsufficient();

        shares = super.previewWithdraw(grossAssets);
        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        _burn(owner, shares);

        BUFFER.withdrawToVault(grossAssets);

        uint256 fee = grossAssets - assets;
        _sendFee(fee);
        ASSET_TOKEN.safeTransfer(receiver, assets);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        onlyAdapterAuthorized
        notPaused
        nonReentrant
        returns (uint256 assetsOut)
    {
        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);

        uint256 grossAssets = super.previewRedeem(shares);
        if (grossAssets > bufferAssets()) revert BufferLiquidityInsufficient();

        _spendAllowanceIfNeeded(owner, msg.sender, shares);
        _burn(owner, shares);

        BUFFER.withdrawToVault(grossAssets);

        uint256 fee = _feeFromTotal(grossAssets, AUTH.tax());
        assetsOut = grossAssets - fee;

        _sendFee(fee);
        ASSET_TOKEN.safeTransfer(receiver, assetsOut);

        emit Withdraw(msg.sender, receiver, owner, assetsOut, shares);
    }

    function moveFromBuffer(uint256 toIndex, uint256 assets)
        external
        onlyAdapterAuthorized
        nonReentrant
        returns (uint256 movedAssets, uint256 mintedBucketLp)
    {
        AjnaVaultLibrary.validateBucketIndex(toIndex, AUTH.minBucketIndex());

        uint256 currentBufferAssets = bufferAssets();
        if (assets > currentBufferAssets) revert BufferLiquidityInsufficient();

        AjnaVaultLibrary.ensureBufferRatio(totalAssets(), currentBufferAssets, assets, AUTH.bufferRatio());

        BUFFER.withdrawToVault(assets);
        (mintedBucketLp, movedAssets) = AJNA_POOL.addQuoteToken(assets, toIndex, block.timestamp + 1 hours);

        if (assets > movedAssets) {
            _bufferDeposit(assets - movedAssets);
        }

        if (mintedBucketLp > 0) {
            bucketLp[toIndex] += mintedBucketLp;
            _trackBucket(toIndex);
        }

        emit BufferMovedToBucket(toIndex, movedAssets, mintedBucketLp);
    }

    function moveToBuffer(uint256 fromIndex, uint256 bucketLpAmount)
        external
        onlyAdapterAuthorized
        nonReentrant
        returns (uint256 pulledAssets, uint256 burnedBucketLp)
    {
        burnedBucketLp = AjnaVaultLibrary.burnableLp(bucketLp[fromIndex], bucketLpAmount);
        (pulledAssets, burnedBucketLp) = AJNA_POOL.removeQuoteToken(burnedBucketLp, fromIndex);

        bucketLp[fromIndex] -= burnedBucketLp;
        _untrackBucketIfEmpty(fromIndex);

        _bufferDeposit(pulledAssets);

        emit BucketMovedToBuffer(fromIndex, pulledAssets, burnedBucketLp);
    }

    function move(uint256 fromIndex, uint256 toIndex, uint256 bucketLpAmount)
        external
        onlyAdapterAuthorized
        nonReentrant
        returns (uint256 fromBucketLp, uint256 toBucketLp)
    {
        AjnaVaultLibrary.validateBucketIndex(toIndex, AUTH.minBucketIndex());

        uint256 trackedLp = AjnaVaultLibrary.burnableLp(bucketLp[fromIndex], bucketLpAmount);
        (fromBucketLp, toBucketLp,) = AJNA_POOL.moveQuoteToken(trackedLp, fromIndex, toIndex, block.timestamp + 1 hours);

        bucketLp[fromIndex] -= fromBucketLp;
        bucketLp[toIndex] += toBucketLp;
        _trackBucket(toIndex);
        _untrackBucketIfEmpty(fromIndex);

        emit BucketMoved(fromIndex, toIndex, fromBucketLp, toBucketLp);
    }

    function bufferAssets() public view returns (uint256) {
        return BUFFER.totalAssets();
    }

    function bucketAssets(uint256 bucketIndex) public view returns (uint256) {
        return AjnaVaultLibrary.lpToAssets(AJNA_POOL, bucketIndex, bucketLp[bucketIndex]);
    }

    function getBuckets() external view returns (uint256[] memory) {
        return _buckets;
    }

    function buffer() external view returns (address) {
        return address(BUFFER);
    }

    function _bufferDeposit(uint256 assets) internal {
        if (assets == 0) return;
        BUFFER.depositFromVault(assets);
    }

    function _sendFee(uint256 fee) internal {
        if (fee == 0) return;
        address recipient = AUTH.admin();
        ASSET_TOKEN.safeTransfer(recipient, fee);
        // FIX: F-27 — emit fee collection event for off-chain auditing
        emit FeeCollected(recipient, fee);
    }

    function _trackBucket(uint256 bucketIndex) internal {
        if (_bucketIndexes[bucketIndex] != 0) return;
        // FIX: F-08 — enforce bucket cap to prevent unbounded totalAssets() loop
        if (_buckets.length >= MAX_BUCKETS) revert MaxBucketsReached();
        _buckets.push(bucketIndex);
        _bucketIndexes[bucketIndex] = _buckets.length;
    }

    function _untrackBucketIfEmpty(uint256 bucketIndex) internal {
        if (bucketLp[bucketIndex] != 0) return;

        uint256 indexPlusOne = _bucketIndexes[bucketIndex];
        if (indexPlusOne == 0) return;

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _buckets.length - 1;
        if (index != lastIndex) {
            uint256 lastBucket = _buckets[lastIndex];
            _buckets[index] = lastBucket;
            _bucketIndexes[lastBucket] = index + 1;
        }

        _buckets.pop();
        delete _bucketIndexes[bucketIndex];
    }

    function _spendAllowanceIfNeeded(address owner, address caller, uint256 shares) internal {
        if (owner == caller) return;
        _spendAllowance(owner, caller, shares);
    }

    function _feeFromTotal(uint256 assets, uint256 bps) internal pure returns (uint256) {
        return Math.mulDiv(assets, bps, 10_000, Math.Rounding.Ceil);
    }

    function _feeFromNet(uint256 assets, uint256 bps) internal pure returns (uint256) {
        return _grossUp(assets, bps) - assets;
    }

    function _grossUp(uint256 netAssets, uint256 bps) internal pure returns (uint256) {
        if (bps == 0) return netAssets;
        return Math.mulDiv(netAssets, 10_000, 10_000 - bps, Math.Rounding.Ceil);
    }

    function _netFromGross(uint256 grossAssets, uint256 bps) internal pure returns (uint256) {
        if (bps == 0) return grossAssets;
        uint256 fee = Math.mulDiv(grossAssets, bps, 10_000, Math.Rounding.Ceil);
        return grossAssets - fee;
    }
}
