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
     * @notice Ticket-level fair jackpot prize in USD 1e6 (ODA-496-2 fee-proxy EV).
     * @dev `maxPrizeUSD1e6 = amountUSD * fairEvFeeBps * 1e6 / (BASIS_POINTS * winChancePPM)`.
     *      Fail closed to 0 when inputs are missing — never disable the EV bound.
     */
    function fairMaxJackpotPrizeUSD(uint256 amountUSD1e6, uint256 winChancePPM, uint256 fairEvFeeBps)
        external
        pure
        returns (uint256 maxPrizeUSD1e6)
    {
        if (amountUSD1e6 == 0 || winChancePPM == 0 || fairEvFeeBps == 0) {
            return 0;
        }
        return FullMath.mulDiv(amountUSD1e6, fairEvFeeBps * 1_000_000, BASIS_POINTS * winChancePPM);
    }

    /**
     * @notice Convert a USD 1e6 prize budget into 18-decimal shares at `priceUSD1e18`.
     */
    function sharesForPrizeUSD(uint256 prizeUSD1e6, uint256 priceUSD1e18)
        external
        pure
        returns (uint256 shares)
    {
        if (prizeUSD1e6 == 0 || priceUSD1e18 == 0) return 0;
        // shares = prizeUSD1e18 * 1e18 / price; prizeUSD1e18 = prizeUSD1e6 * 1e12
        return FullMath.mulDiv(prizeUSD1e6, 1e30, priceUSD1e18);
    }

    /**
     * @notice Convert 18-decimal shares into a USD 1e6 notional at `priceUSD1e18`.
     */
    function prizeUSDForShares(uint256 shares, uint256 priceUSD1e18) external pure returns (uint256 prizeUSD1e6) {
        if (shares == 0 || priceUSD1e18 == 0) return 0;
        return FullMath.mulDiv(shares, priceUSD1e18, 1e30);
    }

    /**
     * @notice Cap jackpot shares so `p * prize` tracks a fee-proxy EV bound (ODA-496-2).
     * @dev Composes `fairMaxJackpotPrizeUSD` + `sharesForPrizeUSD`. Returns 0 when the
     *      cap cannot be evaluated (fail closed — never disable the EV bound).
     */
    function fairMaxJackpotShares(
        uint256 amountUSD1e6,
        uint256 winChancePPM,
        uint256 fairEvFeeBps,
        uint256 priceUSD1e18
    ) external pure returns (uint256 maxShares) {
        // Fail closed: missing context must not disable the EV bound (ODA-496-2 / #801).
        if (amountUSD1e6 == 0 || winChancePPM == 0 || fairEvFeeBps == 0 || priceUSD1e18 == 0) {
            return 0;
        }
        uint256 maxPrizeUSD1e6 =
            FullMath.mulDiv(amountUSD1e6, fairEvFeeBps * 1_000_000, BASIS_POINTS * winChancePPM);
        return FullMath.mulDiv(maxPrizeUSD1e6, 1e30, priceUSD1e18);
    }

    /**
     * @notice Value `amount` of `tokenIn` in USD (1e6) using the lane oracle.
     * @param registry Registry for oracle/shareOFT lookup
     * @param token Lane token
     * @param tokenIn Token being valued (lane coin or its ShareOFT)
     * @param amount Token amount (native decimals)
     * @param oracleMaxStaleness Max age of oracle timestamp (0 = disabled)
     * @param oracleMaxDeviationBps Max deviation vs last accepted price (0 = disabled)
     * @param oracleDeviationWindow Base window for deviation band growth (0 = off)
     * @param lastPrice Last accepted price 1e18 (0 if none)
     * @param lastTs Last accepted price timestamp
     * @param usdMultiplierBps Lottery USD multiplier (0 = none)
     * @dev ODA-496-6: deviation always applies when a reference exists. The allowed
     *      band widens by one `oracleMaxDeviationBps` step per full
     *      `oracleDeviationWindow` elapsed (capped at 100%), so quiet lanes can
     *      recover without a hard re-bootstrap that disables the circuit breaker.
     *      First entry (`lastPrice == 0`) still bootstraps with no deviation check.
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

        // ODA-496-6: always enforce deviation against the last reference; widen the
        // band as the reference ages instead of disabling the check past the window.
        if (oracleMaxDeviationBps > 0 && oracleDeviationWindow > 0 && lastPrice > 0 && lastTs > 0) {
            if (block.timestamp >= lastTs) {
                uint256 elapsed = block.timestamp - lastTs;
                uint256 windowsElapsed = elapsed / oracleDeviationWindow;
                uint256 allowedBps = oracleMaxDeviationBps * (windowsElapsed + 1);
                if (allowedBps > BASIS_POINTS) allowedBps = BASIS_POINTS;
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256 currentPrice = uint256(priceUSD);
                uint256 diff = currentPrice > lastPrice ? currentPrice - lastPrice : lastPrice - currentPrice;
                uint256 deviationBps = FullMath.mulDiv(diff, BASIS_POINTS, lastPrice);
                if (deviationBps > allowedBps) return (0, 0, 0);
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
