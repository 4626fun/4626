// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {TickMathCompat} from "@4626/shared/libraries/uniswap/TickMathCompat.sol";
import {IUniswapV3Pool} from "@4626/shared/interfaces/uniswap/IUniswapV3Pool.sol";

interface ICreatorOracleChainlinkFeed {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/**
 * @title CreatorOracleQuoteLib
 * @notice External quote/tick/feed helpers for CreatorOracle (EIP-170 size split).
 * @dev Linked via CALL from CreatorOracle. Foundry CREATE2 salt 0 @ EIP-2470;
 *      frontend bytecode extraction uses `script/lib/extract_linked_bytecode.py`.
 */
library CreatorOracleQuoteLib {
    error NeedMoreObservations();
    error InvalidDuration();
    /**
     * @notice Convert a Uniswap tick to an ETH-quoted creator price (1e18).
     * @param tick Pool tick (token1/token0)
     * @param assetIsToken0 Whether the creator token is currency0 (invert when true)
     */
    function tickToPrice(int24 tick, bool assetIsToken0) external pure returns (uint256 price) {
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        uint256 sqrtPrice = uint256(sqrtPriceX96);

        // price = (sqrtPriceX96 / 2^96)^2, scaled to 1e18.
        if (sqrtPriceX96 <= type(uint128).max) {
            uint256 ratioX192 = sqrtPrice * sqrtPrice;
            price = Math.mulDiv(ratioX192, 1e18, uint256(1) << 192);
        } else {
            uint256 ratioX128 = Math.mulDiv(sqrtPrice, sqrtPrice, uint256(1) << 64);
            price = Math.mulDiv(ratioX128, 1e18, uint256(1) << 128);
        }

        if (assetIsToken0 && price > 0) {
            price = (1e18 * 1e18) / price;
        }
    }

    /**
     * @notice Convert a Uniswap tick to an Ajna bucket index (approx).
     * @dev Approximation: AjnaIndex ≈ 4156 - floor(tick / 50), clamped to [1, 7388].
     */
    function tickToAjnaBucket(int24 tick) external pure returns (uint256 bucketIndex) {
        int256 t = int256(tick);
        int256 q = t / 50;
        int256 r = t % 50;

        // Solidity rounds toward 0; emulate Math.floor for negatives.
        if (t < 0 && r != 0) q -= 1;

        int256 idx = 4156 - q;
        if (idx < 1) idx = 1;
        if (idx > 7388) idx = 7388;
        bucketIndex = uint256(idx);
    }

    /**
     * @dev Minimal `getQuoteAtTick` (Uniswap V3 OracleLibrary-style).
     */
    function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        external
        pure
        returns (uint256 quoteAmount)
    {
        uint160 sqrtRatioX96 = TickMathCompat.getSqrtRatioAtTick(tick);

        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * uint256(sqrtRatioX96);
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX192, baseAmount, uint256(1) << 192)
                : Math.mulDiv(uint256(1) << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = Math.mulDiv(uint256(sqrtRatioX96), uint256(sqrtRatioX96), uint256(1) << 64);
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX128, baseAmount, uint256(1) << 128)
                : Math.mulDiv(uint256(1) << 128, baseAmount, ratioX128);
        }
    }

    /// @notice Uniswap V3 TWAP tick for `pool` over `duration` seconds.
    function v3TwapTick(address pool, uint32 duration, uint32 minDuration) external view returns (int24 twapTick) {
        if (duration < minDuration) revert InvalidDuration();

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = duration;
        secondsAgos[1] = 0;

        int56[] memory tickCumulatives;
        try IUniswapV3Pool(pool).observe(secondsAgos) returns (int56[] memory _tickCumulatives, uint160[] memory) {
            tickCumulatives = _tickCumulatives;
        } catch {
            revert NeedMoreObservations();
        }
        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int56 timeDelta = int56(uint56(duration));

        int56 meanTick = tickDelta / timeDelta;
        // Uniswap V3 standard: round toward negative infinity
        if (tickDelta < 0 && (tickDelta % timeDelta != 0)) meanTick--;

        twapTick = int24(meanTick);
    }

    /// @notice Robust Chainlink-style feed read normalized to 1e18.
    function readFeedPrice18(address feed, uint256 maxStaleness)
        external
        view
        returns (uint256 price18, uint256 updatedAt, bool ok)
    {
        if (feed == address(0)) return (0, 0, false);
        uint80 roundId;
        int256 answer;
        uint80 answeredInRound;
        uint256 roundStartedAt;
        uint256 roundUpdatedAt;
        try ICreatorOracleChainlinkFeed(feed).latestRoundData() returns (
            uint80 _roundId, int256 _answer, uint256 _startedAt, uint256 _updatedAt, uint80 _answeredInRound
        ) {
            roundId = _roundId;
            answer = _answer;
            roundStartedAt = _startedAt;
            roundUpdatedAt = _updatedAt;
            answeredInRound = _answeredInRound;
        } catch {
            return (0, 0, false);
        }
        if (roundId == 0 || answeredInRound < roundId) return (0, roundUpdatedAt, false);
        if (roundStartedAt == 0 || roundStartedAt > block.timestamp) return (0, roundUpdatedAt, false);
        if (answer <= 0) return (0, roundUpdatedAt, false);
        if (roundUpdatedAt > block.timestamp) return (0, roundUpdatedAt, false);
        if (block.timestamp - roundUpdatedAt > maxStaleness) return (0, roundUpdatedAt, false);

        uint8 feedDecimals;
        try ICreatorOracleChainlinkFeed(feed).decimals() returns (uint8 d) {
            feedDecimals = d;
        } catch {
            return (0, roundUpdatedAt, false);
        }
        if (feedDecimals > 18) return (0, roundUpdatedAt, false);

        uint256 unsignedAnswer = uint256(answer);
        if (feedDecimals < 18) {
            price18 = Math.mulDiv(unsignedAnswer, 10 ** uint256(18 - feedDecimals), 1);
        } else {
            price18 = unsignedAnswer;
        }
        return (price18, roundUpdatedAt, true);
    }

    /// @notice Sequencer uptime check (fail-closed). Empty feed ⇒ up.
    function sequencerIsUp(address feed, uint256 gracePeriod) external view returns (bool) {
        if (feed == address(0)) return true;
        try ICreatorOracleChainlinkFeed(feed).latestRoundData() returns (
            uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound
        ) {
            if (roundId == 0 || answeredInRound < roundId) return false;
            if (updatedAt == 0 || startedAt == 0) return false;
            if (updatedAt > block.timestamp) return false;
            if (answer != 0) return false;
            if (startedAt > block.timestamp) return false;
            if (block.timestamp - startedAt <= gracePeriod) return false;
            return true;
        } catch {
            return false;
        }
    }
}
