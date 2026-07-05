// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAjnaPool} from "../../../interfaces/IAjnaPool.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AjnaVaultLibrary
 * @notice Math and validation helpers for the inner Ajna ERC-4626 vault.
 */
library AjnaVaultLibrary {
    uint256 internal constant MAX_AJNA_BUCKET_INDEX = 7_388;

    error InvalidBucketIndex();
    error BufferRatioViolated();
    error InsufficientBucketLiquidity();

    function validateBucketIndex(uint256 bucketIndex, uint256 minBucketIndex) internal pure {
        if (bucketIndex == 0) revert InvalidBucketIndex();
        if (bucketIndex > MAX_AJNA_BUCKET_INDEX) revert InvalidBucketIndex();
        if (minBucketIndex != 0 && bucketIndex < minBucketIndex) revert InvalidBucketIndex();
    }

    function ensureBufferRatio(uint256 totalAssets, uint256 currentBufferAssets, uint256 assetsLeavingBuffer, uint256 ratioBps)
        internal
        pure
    {
        if (ratioBps == 0) return;

        uint256 remainingBufferAssets = currentBufferAssets - assetsLeavingBuffer;
        // FIX: F-10 — use ceiling division so rounding never under-reports the minimum buffer
        uint256 minBufferAssets = Math.ceilDiv(totalAssets * ratioBps, 10_000);
        if (remainingBufferAssets < minBufferAssets) revert BufferRatioViolated();
    }

    function lpToAssets(IAjnaPool pool, uint256 bucketIndex, uint256 lpAmount) internal view returns (uint256) {
        if (lpAmount == 0) return 0;

        (uint256 bucketLpTotal,, , uint256 bucketDeposit,) = pool.bucketInfo(bucketIndex);
        if (bucketLpTotal == 0 || bucketDeposit == 0) return 0;

        return (lpAmount * bucketDeposit) / bucketLpTotal;
    }

    function bucketAssets(IAjnaPool pool, uint256 bucketIndex, address lender) internal view returns (uint256 assets) {
        (uint256 lpAmount,) = pool.lenderInfo(bucketIndex, lender);
        return lpToAssets(pool, bucketIndex, lpAmount);
    }

    function burnableLp(uint256 trackedLp, uint256 requestedLp) internal pure returns (uint256) {
        if (requestedLp == 0 || requestedLp > trackedLp) revert InsufficientBucketLiquidity();
        return requestedLp;
    }
}
