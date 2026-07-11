// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";

interface IRegistry4626LotteryPricing {
    function getOracleForToken(address _token) external view returns (address);
    function getShareOFTForToken(address _token) external view returns (address);
}

/**
 * @title LotteryManager4626PricingLib
 * @notice External library: USD pricing + oracle guards for LotteryManager4626.
 * @dev Linked via DELEGATECALL-free external CALL from the manager to shrink EIP-170 main size.
 */
library LotteryManager4626PricingLib {
    uint256 internal constant BASIS_POINTS = 10_000;

    /**
     * @notice Value `amount` of `tokenIn` in USD (1e6) using the lane oracle.
     * @param registry Registry for oracle/shareOFT lookup
     * @param token Lane token
     * @param tokenIn Token being valued (lane coin or its ShareOFT)
     * @param amount Token amount (native decimals)
     * @param oracleMaxStaleness Max age of oracle timestamp (0 = disabled)
     * @param oracleMaxDeviationBps Max deviation vs last accepted price (0 = disabled)
     * @param oracleDeviationWindow Apply deviation only while lastTs is this fresh (0 = off)
     * @param lastPrice Last accepted price 1e18 (0 if none)
     * @param lastTs Last accepted price timestamp
     * @param usdMultiplierBps Lottery USD multiplier (0 = none)
     * @dev Deviation is windowed: after `oracleDeviationWindow` elapses, a legitimate
     *      oracle repricing is accepted (new reference). Without the window, the first
     *      accepted price permanently rejects moves beyond maxDeviationBps.
     */
    function calculateTokenUSD(
        address registry,
        address token,
        address tokenIn,
        uint256 amount,
        uint256 oracleMaxStaleness,
        uint256 oracleMaxDeviationBps,
        uint256 oracleDeviationWindow,
        uint256 lastPrice,
        uint256 lastTs,
        uint256 usdMultiplierBps
    ) external view returns (uint256 usd1e6, uint256 priceUSD1e18, uint256 oracleTimestamp) {
        if (registry == address(0) || token == address(0) || tokenIn == address(0) || amount == 0) {
            return (0, 0, 0);
        }

        address oracleAddr;
        try IRegistry4626LotteryPricing(registry).getOracleForToken(token) returns (address o) {
            oracleAddr = o;
        } catch {
            return (0, 0, 0);
        }
        if (oracleAddr == address(0) || oracleAddr.code.length == 0) return (0, 0, 0);

        address shareOFT;
        try IRegistry4626LotteryPricing(registry).getShareOFTForToken(token) returns (address s) {
            shareOFT = s;
        } catch {
            return (0, 0, 0);
        }
        if (tokenIn != token && tokenIn != shareOFT) return (0, 0, 0);

        int256 priceUSD;
        uint256 timestamp;
        try IOracle4626(oracleAddr).getAssetPrice() returns (int256 p, uint256 t) {
            priceUSD = p;
            timestamp = t;
        } catch {
            return (0, 0, 0);
        }
        if (priceUSD <= 0 || timestamp == 0) return (0, 0, 0);
        if (timestamp > block.timestamp) return (0, 0, 0);
        if (oracleMaxStaleness > 0 && block.timestamp - timestamp > oracleMaxStaleness) return (0, 0, 0);

        // Deviation only while the stored reference is still inside the window.
        // After the window elapses, accept the new price so entries are not locked forever.
        if (
            oracleMaxDeviationBps > 0 && oracleDeviationWindow > 0 && lastPrice > 0 && lastTs > 0
                && block.timestamp >= lastTs && block.timestamp - lastTs <= oracleDeviationWindow
        ) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint256 currentPrice = uint256(priceUSD);
            uint256 diff = currentPrice > lastPrice ? currentPrice - lastPrice : lastPrice - currentPrice;
            // lastPrice > 0 already; mulDiv is safe
            uint256 deviationBps = FullMath.mulDiv(diff, BASIS_POINTS, lastPrice);
            if (deviationBps > oracleMaxDeviationBps) return (0, 0, 0);
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        priceUSD1e18 = uint256(priceUSD);
        oracleTimestamp = timestamp;

        uint256 usd1e18 = FullMath.mulDiv(amount, priceUSD1e18, 1e18);
        // Cap multiplier at 10x to avoid config mistakes exploding odds base
        if (usdMultiplierBps > 0) {
            uint256 mult = usdMultiplierBps > 100_000 ? 100_000 : usdMultiplierBps;
            usd1e18 = FullMath.mulDiv(usd1e18, mult, BASIS_POINTS);
        }
        usd1e6 = usd1e18 / 1e12;
    }
}
