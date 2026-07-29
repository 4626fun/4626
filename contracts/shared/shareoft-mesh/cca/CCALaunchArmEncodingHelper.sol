// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";

contract CCALaunchArmEncodingHelper {
    uint24 public constant MPS = 1e7;
    uint256 public constant Q96 = 2 ** 96;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant THURSDAY_EPOCH_SECONDS = 7 days;

    error LaunchOracleNotConfigured();
    error UnsupportedLaunchCurrency(address currency);
    error LaunchOracleInvalidPrice(int256 assetUsdPrice, int256 ethUsdPrice);
    error LaunchOracleStale(uint256 assetTimestamp, uint256 ethTimestamp, uint64 maxAge, uint256 currentTimestamp);
    error LaunchFloorTooLow(uint256 rawFloorPriceQ96, uint256 tickSpacingQ96);

    function taxHookCalldata(
        address taxHook,
        address auctionToken,
        address currency,
        address feeRecipient,
        uint256 taxRateBps
    ) external pure returns (address target, bytes memory data) {
        target = taxHook;
        data = abi.encodeWithSignature(
            "setTaxConfig(address,address,address,uint256,bool,bool,bool)",
            auctionToken,
            currency,
            feeRecipient,
            taxRateBps,
            currency == address(0),
            true,
            false
        );
    }

    function completeAuctionCalldata(
        address strategy,
        address taxHook,
        address auctionToken,
        address currency,
        address feeRecipient,
        uint256 taxRateBps
    ) external pure returns (address[] memory targets, bytes[] memory calldatas) {
        targets = new address[](3);
        calldatas = new bytes[](3);

        targets[0] = strategy;
        calldatas[0] = abi.encodeWithSignature("sweepCurrency()");

        targets[1] = strategy;
        calldatas[1] = abi.encodeWithSignature("migrate()");

        targets[2] = taxHook;
        calldatas[2] = abi.encodeWithSignature(
            "setTaxConfig(address,address,address,uint256,bool,bool,bool)",
            auctionToken,
            currency,
            feeRecipient,
            taxRateBps,
            currency == address(0),
            true,
            false
        );
    }

    function encodeAuctionParams(
        address currency,
        address tokensRecipient,
        address fundsRecipient,
        uint256 floorPrice,
        uint256 tickSpacingQ96,
        uint128 requiredRaise,
        uint64 startBlock,
        uint64 endBlock,
        uint64 claimBlock,
        bytes calldata auctionSteps
    ) external pure returns (bytes memory) {
        return abi.encode(
            currency,
            tokensRecipient,
            fundsRecipient,
            startBlock,
            endBlock,
            claimBlock,
            tickSpacingQ96,
            address(0),
            floorPrice,
            requiredRaise,
            auctionSteps
        );
    }

    function createLinearSteps(uint64 duration) external pure returns (bytes memory) {
        return _createLinearSteps(duration);
    }

    /// @dev Above this many blocks the classic 3-step curve degrades (integer mps hits 0/1).
    uint64 internal constant SAFE_DEFAULT_MAX_DURATION = 2_000_000;
    /// @dev Above this many blocks even the quarter-ramp cannot approximate 20% in phase one
    ///      (a dead window would be required), so the body becomes perfectly uniform.
    uint64 internal constant QUARTER_RAMP_MAX_DURATION = 3_000_000;

    error DurationExceedsExpressibleIssuance(uint64 duration);

    function createUniswapSafeDefaultSteps(uint64 duration) external pure returns (bytes memory) {
        if (duration <= 2) return _createLinearSteps(duration);
        // Fast-chain branches (Orbit L2 block domains): 7 days is ~2.42M blocks on Arbitrum and
        // ~6.05M on Robinhood Chain, where the classic curve's integer mps rates degenerate.
        if (duration > QUARTER_RAMP_MAX_DURATION) return _createUniformFastChainSteps(duration);
        if (duration > SAFE_DEFAULT_MAX_DURATION) return _createQuarterRampSteps(duration);

        uint64 lastBlock = 1;
        uint64 phase1Blocks = duration / 2;
        uint64 phase2Blocks = duration - phase1Blocks - lastBlock;
        if (phase1Blocks == 0 || phase2Blocks == 0) return _createLinearSteps(duration);

        uint24 phase1Total = 2_000_000;
        uint24 phase2Total = 4_500_000;

        uint24 mps1 = uint24(uint256(phase1Total) / uint256(phase1Blocks));
        uint24 mps2 = uint24(uint256(phase2Total) / uint256(phase2Blocks));

        uint256 issued1 = uint256(mps1) * uint256(phase1Blocks);
        uint256 issued2 = uint256(mps2) * uint256(phase2Blocks);
        uint24 mps3 = uint24(MPS - uint24(issued1 + issued2));

        bytes8 packed1 = bytes8((uint64(mps1) << 40) | uint64(phase1Blocks));
        bytes8 packed2 = bytes8((uint64(mps2) << 40) | uint64(phase2Blocks));
        bytes8 packed3 = bytes8((uint64(mps3) << 40) | uint64(lastBlock));

        return abi.encodePacked(packed1, packed2, packed3);
    }

    /// @dev 5-step ramp for 2M < duration <= 3M blocks (e.g. Arbitrum 7 days ≈ 2.42M blocks).
    ///      Quarters at rates (rA, rA+1, rB, rB+1) approximate the 20/45 profile with integer mps;
    ///      the final block carries the remainder like the classic curve (~35-40%).
    function _createQuarterRampSteps(uint64 duration) internal pure returns (bytes memory) {
        uint64 quarter = duration / 4;
        uint64 b1 = quarter;
        uint64 b2 = quarter;
        uint64 b3 = quarter;
        uint64 b4 = duration - 3 * quarter - 1;

        uint24 rA = _rampRate(2_000_000, duration);
        uint24 rB = _rampRate(4_500_000, duration);

        uint256 issued = uint256(rA) * b1 + uint256(rA + 1) * b2 + uint256(rB) * b3 + uint256(rB + 1) * b4;
        uint24 finalMps = uint24(MPS - uint32(issued));

        bytes8 packed1 = bytes8((uint64(rA) << 40) | uint64(b1));
        bytes8 packed2 = bytes8((uint64(rA + 1) << 40) | uint64(b2));
        bytes8 packed3 = bytes8((uint64(rB) << 40) | uint64(b3));
        bytes8 packed4 = bytes8((uint64(rB + 1) << 40) | uint64(b4));
        bytes8 packed5 = bytes8((uint64(finalMps) << 40) | uint64(1));

        return abi.encodePacked(packed1, packed2, packed3, packed4, packed5);
    }

    /// @dev Solve (2r+1) * (duration/4) ≈ target for r, clamped to >= 1 so no quarter is dead.
    function _rampRate(uint24 target, uint64 duration) internal pure returns (uint24 r) {
        uint256 t = (4 * uint256(target)) / uint256(duration);
        if (t <= 1) return 1;
        r = uint24((t - 1) / 2);
        if (r == 0) r = 1;
    }

    /// @dev For duration > 3M blocks (e.g. Robinhood 7 days ≈ 6.05M blocks at ~100ms): integer
    ///      mps >= 1 forces >= ~60% issuance before the final block, so the body is perfectly
    ///      uniform at mps 1 and the final block carries the standard remainder tranche.
    function _createUniformFastChainSteps(uint64 duration) internal pure returns (bytes memory) {
        if (duration >= MPS) revert DurationExceedsExpressibleIssuance(duration);

        uint64 bodyBlocks = duration - 1;
        uint24 finalMps = uint24(uint256(MPS) - uint256(bodyBlocks));

        bytes8 packed1 = bytes8((uint64(1) << 40) | uint64(bodyBlocks));
        bytes8 packed2 = bytes8((uint64(finalMps) << 40) | uint64(1));

        return abi.encodePacked(packed1, packed2);
    }

    function deriveScheduledStartBlock(
        uint256 blockNumber,
        uint256 blockTimestamp,
        uint64 launchBlockTimeSeconds,
        uint64 launchBlocksPerSecond
    ) external pure returns (uint64 startBlock) {
        uint256 nextThursdayStartTimestamp = _nextThursdayStartTimestamp(blockTimestamp);
        uint256 deltaBlocks;
        if (nextThursdayStartTimestamp > blockTimestamp) {
            if (launchBlocksPerSecond > 0) {
                // Sub-second (Orbit) chains: express the wait directly in fast L2 blocks.
                deltaBlocks = (nextThursdayStartTimestamp - blockTimestamp) * launchBlocksPerSecond;
            } else {
                deltaBlocks =
                    Math.ceilDiv(nextThursdayStartTimestamp - blockTimestamp, uint256(launchBlockTimeSeconds));
            }
        }
        if (deltaBlocks == 0) deltaBlocks = 1;
        startBlock = uint64(blockNumber + deltaBlocks);
    }

    function deriveLaunchPricing(
        address oracle,
        address currency,
        uint64 launchOracleMaxAge,
        uint16 launchDiscountBps,
        uint16 launchTickSpacingBps,
        uint256 blockTimestamp
    ) external view returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 assetUsdPrice, uint256 ethUsdPrice)
    {
        if (oracle == address(0)) revert LaunchOracleNotConfigured();
        if (currency != address(0)) revert UnsupportedLaunchCurrency(currency);

        (int256 assetUsdSigned, uint256 assetTimestamp) = IOracle4626(oracle).getAssetPrice();
        (int256 ethUsdSigned, uint256 ethTimestamp) = IOracle4626(oracle).getEthPrice();

        if (assetUsdSigned <= 0 || ethUsdSigned <= 0) {
            revert LaunchOracleInvalidPrice(assetUsdSigned, ethUsdSigned);
        }

        if (
            assetTimestamp == 0 || ethTimestamp == 0 || assetTimestamp > blockTimestamp || ethTimestamp > blockTimestamp
                || blockTimestamp - assetTimestamp > launchOracleMaxAge || blockTimestamp - ethTimestamp > launchOracleMaxAge
        ) {
            revert LaunchOracleStale(assetTimestamp, ethTimestamp, launchOracleMaxAge, blockTimestamp);
        }

        assetUsdPrice = uint256(assetUsdSigned);
        ethUsdPrice = uint256(ethUsdSigned);

        uint256 discountedAssetUsd = Math.mulDiv(assetUsdPrice, uint256(launchDiscountBps), BPS_DENOMINATOR);
        uint256 rawFloorPriceQ96 = Math.mulDiv(discountedAssetUsd, Q96, ethUsdPrice);

        tickSpacingQ96 = Math.mulDiv(rawFloorPriceQ96, uint256(launchTickSpacingBps), BPS_DENOMINATOR);
        if (tickSpacingQ96 < 2) tickSpacingQ96 = 2;
        floorPriceQ96 = (rawFloorPriceQ96 / tickSpacingQ96) * tickSpacingQ96;
        if (floorPriceQ96 == 0) revert LaunchFloorTooLow(rawFloorPriceQ96, tickSpacingQ96);
    }

    function _createLinearSteps(uint64 duration) internal pure returns (bytes memory) {
        uint24 mpsPerBlock = uint24(MPS / duration);
        bytes8 packed = bytes8((uint64(mpsPerBlock) << 40) | uint64(duration));
        return abi.encodePacked(packed);
    }

    function _nextThursdayStartTimestamp(uint256 currentTimestamp) internal pure returns (uint256) {
        uint256 remainder = currentTimestamp % THURSDAY_EPOCH_SECONDS;
        if (remainder == 0) return currentTimestamp;
        return currentTimestamp + (THURSDAY_EPOCH_SECONDS - remainder);
    }
}
