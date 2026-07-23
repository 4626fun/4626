// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";

interface IRegistry4626LotteryPricing {
    function getOracleForToken(address _token) external view returns (address);
    function getShareOFTForToken(address _token) external view returns (address);
}

interface IBoostManagerLotteryPricing {
    function calculateBoostForPosition(
        address user,
        uint256 shareBalanceUSD,
        uint256 swapAmountUSD,
        uint256 totalShareUSD
    ) external view returns (uint256 boostBps);
}

interface IGaugeVotingLotteryPricing {
    function getVaultProbabilityBoostPPM(address vault) external view returns (uint256);
}

/**
 * @title LotteryManager4626PricingLib
 * @notice External library: USD pricing + oracle guards for LotteryManager4626.
 * @dev Linked via DELEGATECALL-free external CALL from the manager to shrink EIP-170 main size.
 *
 *      Deploy / bytecode-store:
 *      - Foundry links this library into `LotteryManager4626` creation bytecode at the
 *        CREATE2 address from EIP-2470 deployer + `create2_library_salt` (default 0).
 *      - Deploy this library first (see `DeployLotteryManagerCreate2*.s.sol`), then LM.
 *      - Manifest extraction must fully link placeholders (`script/lib/extract_linked_bytecode.py`);
 *        truncating at `__$…$__` produces broken initcode hashes.
 */
library LotteryManager4626PricingLib {
    uint256 internal constant BASIS_POINTS = 10_000;
    /// @notice Practical amount ceiling to keep `mulDiv` from overflowing pathological inputs.
    uint256 internal constant MAX_PRICING_AMOUNT = type(uint128).max;

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
     * @dev Deviation is windowed and fail-closed *inside* the window. Outside the
     *      window (or with no reference), skip deviation so a quiet lane can
     *      re-bootstrap from a fresh oracle quote (`oracleMaxStaleness` still applies).
     *      First entry (`lastPrice == 0`) bootstraps the same way.
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
        // ODA-461-F22: unbounded amount can overflow mulDiv and brick LZ receive.
        if (amount > MAX_PRICING_AMOUNT) return (0, 0, 0);

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

        // ODA-460-3 / 461-3 (+ Codex/Bugbot liveness fix): enforce deviation only while
        // the last accepted reference is still inside `oracleDeviationWindow`. After the
        // window elapses, skip deviation so the next successful entry can re-seed
        // `lastAcceptedPrice*` (avoids permanent lane disable after quiet periods).
        if (oracleMaxDeviationBps > 0 && oracleDeviationWindow > 0 && lastPrice > 0 && lastTs > 0) {
            if (block.timestamp >= lastTs && block.timestamp - lastTs <= oracleDeviationWindow) {
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256 currentPrice = uint256(priceUSD);
                uint256 diff = currentPrice > lastPrice ? currentPrice - lastPrice : lastPrice - currentPrice;
                uint256 deviationBps = FullMath.mulDiv(diff, BASIS_POINTS, lastPrice);
                if (deviationBps > oracleMaxDeviationBps) return (0, 0, 0);
            }
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        priceUSD1e18 = uint256(priceUSD);
        oracleTimestamp = timestamp;

        // ODA-460-7 / 461-2: normalize by tokenIn decimals when metadata is present.
        // Missing/reverting decimals() keeps the historical 18 default (ShareOFT / mocks).
        uint8 tokenDecimals = 18;
        if (tokenIn.code.length > 0) {
            try IERC20Metadata(tokenIn).decimals() returns (uint8 d) {
                if (d == 0 || d > 36) return (0, 0, 0);
                tokenDecimals = d;
            } catch {}
        }
        uint256 unit = 10 ** uint256(tokenDecimals);

        uint256 usd1e18 = FullMath.mulDiv(amount, priceUSD1e18, unit);
        // Cap multiplier at 10x to avoid config mistakes exploding odds base
        if (usdMultiplierBps > 0) {
            uint256 mult = usdMultiplierBps > 100_000 ? 100_000 : usdMultiplierBps;
            usd1e18 = FullMath.mulDiv(usd1e18, mult, BASIS_POINTS);
        }
        usd1e6 = usd1e18 / 1e12;
    }

    /**
     * @notice Apply personal + gauge boosts to base win chance (extracted for EIP-170).
     * @dev ODA-461-20: clamps external boost returns before arithmetic.
     */
    function applyBoost(
        address boostManager,
        address gaugeVoting,
        address user,
        uint256 shareBalanceAmount,
        address vault,
        uint256 swapAmountUSD,
        uint256 baseWinChance,
        uint256 totalShareUSD,
        uint256 maxWinChance,
        uint256 minSwapAmount
    ) external view returns (uint256 boostedWinChance) {
        boostedWinChance = baseWinChance;

        if (boostManager != address(0) && shareBalanceAmount > 0 && swapAmountUSD > 0) {
            try IBoostManagerLotteryPricing(boostManager).calculateBoostForPosition(
                user, shareBalanceAmount, swapAmountUSD, totalShareUSD
            ) returns (uint256 boostBPS) {
                if (boostBPS > 25_000) boostBPS = 25_000;
                if (boostBPS > BASIS_POINTS) {
                    uint256 coveredUSD =
                        shareBalanceAmount < swapAmountUSD ? shareBalanceAmount : swapAmountUSD;
                    uint256 coverageBPS = FullMath.mulDiv(coveredUSD, BASIS_POINTS, swapAmountUSD);
                    uint256 coveredUpliftBPS =
                        FullMath.mulDiv(boostBPS - BASIS_POINTS, coverageBPS, BASIS_POINTS);
                    boostedWinChance =
                        FullMath.mulDiv(baseWinChance, BASIS_POINTS + coveredUpliftBPS, BASIS_POINTS);
                }
            } catch {}
        }

        if (gaugeVoting != address(0) && vault != address(0)) {
            try IGaugeVotingLotteryPricing(gaugeVoting).getVaultProbabilityBoostPPM(vault) returns (
                uint256 gaugeBoostPPM
            ) {
                if (gaugeBoostPPM > maxWinChance) gaugeBoostPPM = maxWinChance;
                if (gaugeBoostPPM > 0) {
                    if (swapAmountUSD > minSwapAmount) {
                        uint256 scaledAmount = swapAmountUSD - minSwapAmount;
                        uint256 maxScale = 9_999_000_000;
                        boostedWinChance += scaledAmount >= maxScale
                            ? gaugeBoostPPM
                            : (gaugeBoostPPM * scaledAmount) / maxScale;
                    }
                }
            } catch {}
        }

        if (boostedWinChance > maxWinChance) boostedWinChance = maxWinChance;
    }
}
