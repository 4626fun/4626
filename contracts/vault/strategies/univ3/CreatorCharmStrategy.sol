// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IUniswapV3Factory} from "../../../interfaces/uniswap/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "../../../interfaces/uniswap/IUniswapV3Pool.sol";
import {TickMathCompat} from "../../../libraries/TickMathCompat.sol";
import "../../../interfaces/IStrategy.sol";
import {ICreatorOracle} from "../../../interfaces/ICreatorOracle.sol";
import {IStrategyValuation} from "../../../interfaces/IStrategyValuation.sol";

/**
 * @title CreatorCharmStrategy
 * @author 0xakita.eth
 * @notice Charm vault strategy adapter for CREATOR/USDC.
 * @dev Used by CreatorOVault as a yield strategy.
 */

interface ICharmVault {
    function deposit(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to)
        external
        returns (uint256 shares, uint256 amount0, uint256 amount1);

    function withdraw(uint256 shares, uint256 amount0Min, uint256 amount1Min, address to)
        external
        returns (uint256 amount0, uint256 amount1);

    function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);

    // Tick range functions
    function baseLower() external view returns (int24);
    function baseUpper() external view returns (int24);
    function pool() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice zRouter - gas-efficient multi-AMM DEX aggregator
/// @dev Base deployment uses a Uniswap-style swapV3 entrypoint with explicit `to` + `exactOut` args.
interface IzRouter {
    function swapV3(
        address to,
        bool exactOut,
        uint24 swapFee,
        address tokenIn,
        address tokenOut,
        uint256 swapAmount,
        uint256 amountLimit,
        uint256 deadline
    ) external payable returns (uint256 amountIn, uint256 amountOut);
}

// Interfaces imported from v3-core and interfaces/IStrategy.sol

contract CreatorCharmStrategy is IStrategy, IStrategyValuation, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================

    /// @dev Default TWAP window used for valuation (share pricing).
    uint32 internal constant DEFAULT_TWAP_DURATION = 1800; // 30 minutes
    uint32 public constant MIN_TWAP_DURATION = 60; // 1 minute
    uint32 public constant MAX_TWAP_DURATION = 1 days;

    address public immutable vault; // CreatorOVault address
    IERC20 public immutable CREATOR; // Creator token
    IERC20 public immutable USDC; // USDC (quote token)
    ISwapRouter public immutable UNISWAP_ROUTER;

    ICharmVault public charmVault;
    IUniswapV3Pool public swapPool; // CREATOR/USDC pool for pricing

    /// @notice CreatorOracle used for USDC valuation inside `getTotalAssets()`.
    /// @dev This is intentionally distinct from Uniswap TWAP used for swap sizing/slippage.
    ICreatorOracle public creatorOracle;

    /// @notice TWAP window (seconds) used for valuation inside `getTotalAssets()`.
    /// @dev This impacts ERC-4626 share pricing via `CreatorOVault.totalAssets()`.
    uint32 public twapDuration = DEFAULT_TWAP_DURATION;

    /// @notice zRouter for gas-efficient swaps (optional)
    /// @dev Base: TBD
    IzRouter public zRouter;
    bool public useZRouter = false;

    /// @notice Uniswap V3 Factory for auto fee tier discovery
    /// @dev Base: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
    IUniswapV3Factory public uniFactory;
    bool public autoFeeTier = false;

    /// @notice Configurable parameters
    uint256 public maxSwapPercent = 5; // Max 5% CREATOR → USDC (99/1 ratio)
    uint256 public swapSlippageBps = 300; // 3% max swap slippage
    uint256 public depositSlippageBps = 500; // 5% deposit slippage
    uint24 public swapPoolFee = 3000; // 0.3% fee tier (default)

    bool public active = true;

    // Track for harvest calculations
    uint256 private lastTotalAssets;

    // =================================
    // EVENTS (Standard events from IStrategy.sol)
    // =================================
    // Standard events inherited from IStrategy interface:
    // - event StrategyDeposit(address indexed from, uint256 amount, uint256 deposited);
    // - event StrategyWithdraw(address indexed to, uint256 amount, uint256 withdrawn);
    // - event StrategyHarvest(uint256 profit);
    // - event StrategyRebalanced(uint256 newTotalAssets);
    // - event EmergencyWithdraw(address indexed to, uint256 amount);

    // Additional strategy-specific events:
    event TokensSwapped(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event DepositFailed(string reason);
    event UnusedTokensReturned(uint256 creatorAmount, uint256 usdcAmount);
    event ParametersUpdated(uint256 maxSwapPercent, uint256 swapSlippageBps);
    event TwapDurationUpdated(uint32 oldDuration, uint32 newDuration);
    event CreatorOracleUpdated(address indexed oldOracle, address indexed newOracle);

    // =================================
    // ERRORS
    // =================================

    error NotVault();
    error NotActive();
    error ZeroAddress();
    error SlippageExceeded(uint256 expected, uint256 actual);
    error InvalidTwapDuration(uint32 duration);
    error TwapUnavailable();
    error RequiredSwapFailed();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    modifier whenActive() {
        if (!active) revert NotActive();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _vault,
        address _creator,
        address _usdc,
        address _uniswapRouter,
        address _charmVault,
        address _swapPool,
        address _owner
    ) Ownable(_owner) {
        if (_vault == address(0) || _creator == address(0) || _usdc == address(0) || _uniswapRouter == address(0)) {
            revert ZeroAddress();
        }

        vault = _vault;
        CREATOR = IERC20(_creator);
        USDC = IERC20(_usdc);
        UNISWAP_ROUTER = ISwapRouter(_uniswapRouter);

        if (_charmVault != address(0)) {
            charmVault = ICharmVault(_charmVault);
        }
        if (_swapPool != address(0)) {
            swapPool = IUniswapV3Pool(_swapPool);
        }
    }

    // =================================
    // CONFIGURATION
    // =================================

    function setCharmVault(address _charmVault) external onlyOwner {
        charmVault = ICharmVault(_charmVault);
    }

    function setSwapPool(address _swapPool) external onlyOwner {
        swapPool = IUniswapV3Pool(_swapPool);
    }

    function setCreatorOracle(address _creatorOracle) external onlyOwner {
        address old = address(creatorOracle);
        creatorOracle = ICreatorOracle(_creatorOracle);
        emit CreatorOracleUpdated(old, _creatorOracle);
    }

    function setTwapDuration(uint32 _twapDuration) external onlyOwner {
        if (_twapDuration < MIN_TWAP_DURATION || _twapDuration > MAX_TWAP_DURATION) {
            revert InvalidTwapDuration(_twapDuration);
        }
        uint32 old = twapDuration;
        twapDuration = _twapDuration;
        emit TwapDurationUpdated(old, _twapDuration);
    }

    /// @notice Set zRouter address for gas-efficient swaps
    function setZRouter(address _zRouter) external onlyOwner {
        zRouter = IzRouter(_zRouter);
    }

    /// @notice Toggle between zRouter (gas-efficient) and Uniswap Router
    function setUseZRouter(bool _useZRouter) external onlyOwner {
        useZRouter = _useZRouter;
    }

    /// @notice Set Uniswap V3 Factory for auto fee tier discovery
    /// @param _factory Factory address (0x33128a8fC17869897dcE68Ed026d694621f6FDfD on Base)
    function setUniFactory(address _factory) external onlyOwner {
        uniFactory = IUniswapV3Factory(_factory);
    }

    /// @notice Toggle automatic fee tier discovery
    function setAutoFeeTier(bool _autoFeeTier) external onlyOwner {
        autoFeeTier = _autoFeeTier;
    }

    /// @notice Find best fee tier for a token pair (checks liquidity)
    /// @dev Checks 0.01%, 0.05%, 0.3%, 1% fee tiers
    function _findBestFeeTier(address tokenIn, address tokenOut) internal view returns (uint24 bestFee) {
        if (address(uniFactory) == address(0) || !autoFeeTier) {
            return swapPoolFee; // Return default
        }

        uint24[4] memory fees = [uint24(100), uint24(500), uint24(3000), uint24(10000)];
        uint128 bestLiquidity = 0;
        bestFee = swapPoolFee; // Default fallback

        for (uint256 i = 0; i < fees.length; i++) {
            address pool = uniFactory.getPool(tokenIn, tokenOut, fees[i]);
            if (pool != address(0)) {
                try IUniswapV3Pool(pool).liquidity() returns (uint128 liq) {
                    if (liq > bestLiquidity) {
                        bestLiquidity = liq;
                        bestFee = fees[i];
                    }
                } catch {
                    continue;
                }
            }
        }
    }

    function setParameters(
        uint256 _maxSwapPercent,
        uint256 _swapSlippageBps,
        uint256 _depositSlippageBps,
        uint24 _swapPoolFee
    ) external onlyOwner {
        maxSwapPercent = _maxSwapPercent;
        swapSlippageBps = _swapSlippageBps;
        depositSlippageBps = _depositSlippageBps;
        swapPoolFee = _swapPoolFee;

        emit ParametersUpdated(_maxSwapPercent, _swapSlippageBps);
    }

    function setActive(bool _active) external onlyOwner {
        active = _active;
    }

    function initializeApprovals() external onlyOwner {
        CREATOR.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        USDC.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        if (address(charmVault) != address(0)) {
            CREATOR.forceApprove(address(charmVault), type(uint256).max);
            USDC.forceApprove(address(charmVault), type(uint256).max);
        }
        if (address(zRouter) != address(0)) {
            CREATOR.forceApprove(address(zRouter), type(uint256).max);
            USDC.forceApprove(address(zRouter), type(uint256).max);
        }
    }

    // =================================
    // ISTRATEGY INTERFACE
    // =================================

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(CREATOR);
    }

    /**
     * @notice Strategy valuation health check for ERC-4626 deposit/mint gating.
     * @dev MUST NOT revert. If the strategy has any USDC exposure, this requires a
     *      configured and fresh `creatorOracle` price. If there is no USDC exposure,
     *      returns true even if the oracle is unset.
     */
    function isValuationReady() external view override returns (bool) {
        uint256 idleUsdc = USDC.balanceOf(address(this));
        uint256 usdcExposure = idleUsdc;

        // Include USDC exposure inside Charm vault position when present.
        if (address(charmVault) != address(0)) {
            uint256 ourShares;
            uint256 totalShares;

            try charmVault.balanceOf(address(this)) returns (uint256 s) {
                ourShares = s;
            } catch {
                return false;
            }

            try charmVault.totalSupply() returns (uint256 ts) {
                totalShares = ts;
            } catch {
                return false;
            }

            if (totalShares != 0 && ourShares != 0) {
                uint256 total0;
                uint256 total1;
                try charmVault.getTotalAmounts() returns (uint256 a0, uint256 a1) {
                    total0 = a0;
                    total1 = a1;
                } catch {
                    return false;
                }

                bool creatorIsToken0;
                try charmVault.token0() returns (address t0) {
                    creatorIsToken0 = (t0 == address(CREATOR));
                } catch {
                    return false;
                }

                uint256 ourUsdc =
                    creatorIsToken0 ? (total1 * ourShares) / totalShares : (total0 * ourShares) / totalShares;

                usdcExposure += ourUsdc;
            }
        }

        if (usdcExposure == 0) return true;

        ICreatorOracle oracle = creatorOracle;
        if (address(oracle) == address(0)) return false;

        try oracle.isPriceFresh() returns (bool fresh) {
            return fresh;
        } catch {
            return false;
        }
    }

    function getTotalAssets() public view override returns (uint256) {
        uint256 idleCreator = CREATOR.balanceOf(address(this));
        uint256 idleUsdc = USDC.balanceOf(address(this));
        uint256 ourCreator = 0;
        uint256 ourUsdc = 0;

        if (address(charmVault) != address(0)) {
            uint256 ourShares = charmVault.balanceOf(address(this));
            uint256 totalShares = charmVault.totalSupply();

            if (totalShares != 0 && ourShares != 0) {
                (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();

                // Determine which token is CREATOR
                bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);

                ourCreator = creatorIsToken0 ? (total0 * ourShares) / totalShares : (total1 * ourShares) / totalShares;

                ourUsdc = creatorIsToken0 ? (total1 * ourShares) / totalShares : (total0 * ourShares) / totalShares;
            }
        }

        uint256 usdcInCreator = _usdcToCreatorValue(ourUsdc + idleUsdc);
        return ourCreator + idleCreator + usdcInCreator;
    }

    function _usdcToCreatorValue(uint256 usdcAmount) internal view returns (uint256 creatorAmount) {
        if (usdcAmount == 0) return 0;

        ICreatorOracle oracle = creatorOracle;
        if (address(oracle) == address(0)) return 0;

        // Strict: require freshness; if stale/unavailable, return conservative valuation.
        bool fresh;
        try oracle.isPriceFresh() returns (bool ok) {
            fresh = ok;
        } catch {
            return 0;
        }
        if (!fresh) return 0;

        try oracle.getCreatorPrice() returns (int256 priceUsd, uint256) {
            if (priceUsd <= 0) return 0;
            // USDC (1e6) -> USD (1e18): * 1e12, then USD (1e18) -> CREATOR (1e18): *1e18/priceUsd
            // => usdcAmount * 1e30 / priceUsd
            creatorAmount = Math.mulDiv(usdcAmount, 1e30, uint256(priceUsd));
        } catch {
            return 0;
        }
    }

    /**
     * @notice Get manipulation-resistant valuation price (CREATOR per USDC, 1e18).
     * @dev Uses Uniswap V3 TWAP (pool observations), not spot `slot0` (manipulable intra-tx).
     *      If observations are unavailable, returns (0,false). Callers should not silently fall back to spot pricing.
     */
    function _getPoolPriceTWAP(uint32 duration) internal view returns (uint256 creatorPerUsdc, bool ok) {
        if (address(swapPool) == address(0) || duration == 0) return (0, false);

        // Explicitly require enough oracle history for TWAP valuation.
        // If not available, valuation should ignore the USDC leg (safe underestimation).
        (,,, uint16 observationCardinality,,,) = swapPool.slot0();
        if (observationCardinality < 2) return (0, false);

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = duration;
        secondsAgos[1] = 0;

        try swapPool.observe(secondsAgos) returns (int56[] memory tickCumulatives, uint160[] memory) {
            int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
            int56 timeDelta = int56(uint56(duration));

            int56 meanTick = tickDelta / timeDelta;
            // Uniswap V3 standard: round toward negative infinity.
            if (tickDelta < 0 && (tickDelta % timeDelta != 0)) meanTick--;

            // Quote: how much CREATOR for 1 USDC (1e6 base units) -> returns CREATOR units (1e18).
            uint256 quote = _getQuoteAtTick(int24(meanTick), uint128(1e6), address(USDC), address(CREATOR));
            if (quote == 0) return (0, false);
            return (quote, true);
        } catch {
            return (0, false);
        }
    }

    /**
     * @dev Minimal Uniswap V3 OracleLibrary-style quote at tick.
     *      Returns `quoteToken` amount for `baseAmount` of `baseToken`.
     *      Tick is assumed to be for the canonical Uniswap V3 ordering (token0 < token1).
     */
    function _getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        internal
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

    // =================================
    // DEPOSIT WITH SLIPPAGE PROTECTION
    // =================================

    /**
     * @notice Deposit CREATOR tokens (single-sided deposit)
     * @dev Automatically swaps portion to USDC to maintain Charm vault ratio
     * @param amount Amount of CREATOR tokens to deposit
     * @return deposited Actual amount deployed (in CREATOR value)
     */
    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        if (address(charmVault) == address(0)) {
            _returnAllTokens();
            return 0;
        }

        // Pull CREATOR tokens from the vault. `onlyVault` guarantees msg.sender is the trusted vault.
        if (amount > 0) {
            CREATOR.safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 totalCreator = CREATOR.balanceOf(address(this));
        uint256 totalUsdc = USDC.balanceOf(address(this));

        if (totalCreator == 0 && totalUsdc == 0) return 0;

        // Get Charm vault ratio (total0 could be CREATOR or USDC depending on token order)
        (uint256 charm0, uint256 charm1) = charmVault.getTotalAmounts();
        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);

        uint256 charmCreator = creatorIsToken0 ? charm0 : charm1;
        uint256 charmUsdc = creatorIsToken0 ? charm1 : charm0;

        uint256 finalCreator;
        uint256 finalUsdc;

        if (charmCreator > 0 && charmUsdc > 0) {
            // Charm has liquidity - calculate required USDC for our CREATOR
            uint256 usdcNeeded = (totalCreator * charmUsdc) / charmCreator;

            if (totalUsdc >= usdcNeeded) {
                // Have enough USDC - use all CREATOR
                finalCreator = totalCreator;
                finalUsdc = usdcNeeded;
            } else {
                // Need more USDC - swap some CREATOR → USDC
                uint256 usdcDeficit = usdcNeeded - totalUsdc;

                // Limit swap to maxSwapPercent of CREATOR
                uint256 maxSwapCreator = (totalCreator * maxSwapPercent) / 100;
                uint256 creatorToSwap = _calculateCreatorToSwap(usdcDeficit, maxSwapCreator);

                if (creatorToSwap > 0) {
                    uint256 moreUsdc = _swapCreatorToUsdcSafe(creatorToSwap);
                    totalUsdc = totalUsdc + moreUsdc;
                    totalCreator = totalCreator - creatorToSwap;

                    // Recalculate with new balances
                    usdcNeeded = (totalCreator * charmUsdc) / charmCreator;
                    finalCreator = totalCreator;
                    finalUsdc = totalUsdc > usdcNeeded ? usdcNeeded : totalUsdc;
                } else {
                    // Can't swap enough - deposit what we can
                    uint256 creatorUsable = (totalUsdc * charmCreator) / charmUsdc;
                    finalCreator = creatorUsable > totalCreator ? totalCreator : creatorUsable;
                    finalUsdc = totalUsdc;
                }
            }
        } else {
            // Charm empty - deposit 99% CREATOR, 1% USDC
            // Need to swap ~1% CREATOR → USDC
            uint256 creatorToSwap = totalCreator / 100; // 1%

            if (creatorToSwap > 0) {
                uint256 usdcReceived = _swapCreatorToUsdcSafe(creatorToSwap);
                totalUsdc = totalUsdc + usdcReceived;
                totalCreator = totalCreator - creatorToSwap;
            }

            finalCreator = totalCreator;
            finalUsdc = totalUsdc;
        }

        // Deposit to Charm with safety checks
        _depositToCharmSafe(finalCreator, finalUsdc, creatorIsToken0);

        // Keep residual balances in-strategy so strict vault accounting remains stable
        // even when Charm deposit is partially/fully deferred (e.g. out-of-range).
        // Residual tokens remain reflected in getTotalAssets().

        // Canonical vault accounting path requires strategy-reported deposit to match
        // the requested vault allocation amount. The vault enforces this strictly.
        deposited = amount;

        // Update for harvest tracking
        lastTotalAssets = getTotalAssets();

        emit StrategyDeposit(msg.sender, amount, deposited);
    }

    /**
     * @notice Calculate how much CREATOR to swap for needed USDC
     */
    function _calculateCreatorToSwap(uint256 usdcNeeded, uint256 maxCreator) internal view returns (uint256) {
        if (usdcNeeded == 0) return 0;

        // Use TWAP to avoid spot manipulation in quoted swap sizing.
        (uint256 creatorPerUsdc, bool ok) = _getPoolPriceTWAP(twapDuration);
        if (!ok || creatorPerUsdc == 0) return 0;
        uint256 creatorNeeded = (usdcNeeded * creatorPerUsdc) / 1e6; // USDC has 6 decimals

        // Add slippage buffer (3%)
        creatorNeeded = (creatorNeeded * 10300) / 10000;

        return creatorNeeded > maxCreator ? maxCreator : creatorNeeded;
    }

    /**
     * @notice Check if Charm vault is in range for deposits
     */
    function isCharmInRange() public view returns (bool inRange, int24 currentTick, int24 lower, int24 upper) {
        if (address(charmVault) == address(0)) return (false, 0, 0, 0);

        try charmVault.pool() returns (address poolAddr) {
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddr);
            (, currentTick,,,,,) = pool.slot0();

            try charmVault.baseLower() returns (int24 _lower) {
                lower = _lower;
            } catch {
                lower = -887200;
            }

            try charmVault.baseUpper() returns (int24 _upper) {
                upper = _upper;
            } catch {
                upper = 887200;
            }

            inRange = currentTick >= lower && currentTick <= upper;
        } catch {
            inRange = true;
        }
    }

    /**
     * @notice Safe Charm deposit - SINGLE ATOMIC
     * @dev Pre-checks range, uses slippage protection, graceful failure handling
     */
    function _depositToCharmSafe(uint256 creatorAmount, uint256 usdcAmount, bool creatorIsToken0)
        internal
        returns (uint256 shares)
    {
        if (creatorAmount == 0 && usdcAmount == 0) return 0;

        // PRE-CHECK: Is Charm vault in range?
        (bool inRange, int24 currentTick, int24 lower, int24 upper) = isCharmInRange();
        if (!inRange) {
            emit DepositFailed(string(
                    abi.encodePacked(
                        "Out of range: tick ",
                        _int24ToString(currentTick),
                        " not in [",
                        _int24ToString(lower),
                        ",",
                        _int24ToString(upper),
                        "]"
                    )
                ));
            return 0;
        }

        // Calculate min amounts with slippage
        uint256 minCreator = (creatorAmount * (10000 - depositSlippageBps)) / 10000;
        uint256 minUsdc = (usdcAmount * (10000 - depositSlippageBps)) / 10000;

        // Prepare amounts based on token order
        uint256 amount0 = creatorIsToken0 ? creatorAmount : usdcAmount;
        uint256 amount1 = creatorIsToken0 ? usdcAmount : creatorAmount;
        uint256 min0 = creatorIsToken0 ? minCreator : minUsdc;
        uint256 min1 = creatorIsToken0 ? minUsdc : minCreator;

        // SINGLE ATOMIC DEPOSIT
        try charmVault.deposit(amount0, amount1, min0, min1, address(this)) returns (
            uint256 _shares, uint256, uint256
        ) {
            shares = _shares;
        } catch Error(string memory reason) {
            emit DepositFailed(reason);
        } catch (bytes memory lowLevelData) {
            // Try to decode the error for debugging
            if (lowLevelData.length > 0) {
                emit DepositFailed(string(abi.encodePacked("Low-level: ", _bytesToHex(lowLevelData))));
            } else {
                emit DepositFailed("Unknown error");
            }
        }
    }

    /**
     * @notice Convert int24 to string for error messages
     */
    function _int24ToString(int24 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        bool negative = value < 0;
        uint256 absValue = negative ? uint256(uint24(-value)) : uint256(uint24(value));

        bytes memory buffer = new bytes(10);
        uint256 i = buffer.length;
        while (absValue > 0) {
            i--;
            buffer[i] = bytes1(uint8(48 + absValue % 10));
            absValue /= 10;
        }
        if (negative) {
            i--;
            buffer[i] = "-";
        }

        bytes memory result = new bytes(buffer.length - i);
        for (uint256 j = 0; j < result.length; j++) {
            result[j] = buffer[i + j];
        }
        return string(result);
    }

    /**
     * @notice Convert bytes to hex string for error debugging
     */
    function _bytesToHex(bytes memory data) internal pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        uint256 len = data.length > 4 ? 4 : data.length; // Only first 4 bytes (selector)
        bytes memory result = new bytes(len * 2);
        for (uint256 i = 0; i < len; i++) {
            result[i * 2] = hexChars[uint8(data[i]) >> 4];
            result[i * 2 + 1] = hexChars[uint8(data[i]) & 0x0f];
        }
        return string(result);
    }

    /**
     * @notice Swap CREATOR → USDC with slippage protection
     * @dev Uses zRouter if enabled, auto fee tier if enabled
     */
    function _swapCreatorToUsdcSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        // Auto-discover best fee tier if enabled
        uint24 fee = _findBestFeeTier(address(CREATOR), address(USDC));

        // Calculate expected output from TWAP quote, not spot.
        (uint256 creatorPerUsdc, bool ok) = _getPoolPriceTWAP(twapDuration);
        if (!ok || creatorPerUsdc == 0) {
            return 0;
        }
        uint256 expectedOut = (amountIn * 1e6) / creatorPerUsdc; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        // Try zRouter first if enabled (8-18% gas savings)
        if (useZRouter && address(zRouter) != address(0)) {
            try zRouter.swapV3(
                address(this), // recipient
                false, // exact input
                fee,
                address(CREATOR),
                address(USDC),
                amountIn,
                minOut,
                block.timestamp
            ) returns (uint256, uint256 out) {
                amountOut = out;
                emit TokensSwapped(address(CREATOR), address(USDC), amountIn, amountOut);
                return amountOut;
            } catch {
                // Fall through to Uniswap Router
            }
        }

        // Fallback to Uniswap Router
        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(CREATOR),
                tokenOut: address(USDC),
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (
            uint256 out
        ) {
            amountOut = out;
            emit TokensSwapped(address(CREATOR), address(USDC), amountIn, amountOut);
        } catch {
            amountOut = 0;
        }
    }

    // =================================
    // WITHDRAW
    // =================================

    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn) {
        if (address(charmVault) == address(0)) return 0;

        uint256 totalValue = getTotalAssets();
        if (totalValue == 0) return 0;

        uint256 ourShares = charmVault.balanceOf(address(this));
        uint256 sharesToWithdraw = (ourShares * amount) / totalValue;
        if (sharesToWithdraw > ourShares) sharesToWithdraw = ourShares;
        if (sharesToWithdraw == 0) return 0;

        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);

        (uint256 amount0, uint256 amount1) = charmVault.withdraw(sharesToWithdraw, 0, 0, address(this));
        uint256 creatorReceived = creatorIsToken0 ? amount0 : amount1;
        uint256 usdcReceived = creatorIsToken0 ? amount1 : amount0;

        // Convert any USDC back to CREATOR before returning.
        uint256 totalUsdc = USDC.balanceOf(address(this));
        if (usdcReceived > 0 || totalUsdc > 0) {
            creatorReceived += _swapUsdcToCreatorRequired(totalUsdc);
        }

        withdrawn = creatorReceived;
        if (withdrawn > 0) {
            CREATOR.safeTransfer(vault, withdrawn);
        }

        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    /**
     * @notice Swap USDC → CREATOR with slippage protection
     */
    function _swapUsdcToCreatorSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        return _swapUsdcToCreator(amountIn, false);
    }

    function _swapUsdcToCreatorRequired(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        return _swapUsdcToCreator(amountIn, true);
    }

    function _swapUsdcToCreator(uint256 amountIn, bool required) internal returns (uint256 amountOut) {
        (uint256 creatorPerUsdc, bool ok) = _getPoolPriceTWAP(twapDuration);
        if (!ok || creatorPerUsdc == 0) {
            if (required) revert TwapUnavailable();
            return 0;
        }

        uint24 fee = _findBestFeeTier(address(USDC), address(CREATOR));

        uint256 expectedOut = (amountIn * creatorPerUsdc) / 1e6; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        if (useZRouter && address(zRouter) != address(0)) {
            try zRouter.swapV3(
                address(this), // recipient
                false, // exact input
                fee,
                address(USDC),
                address(CREATOR),
                amountIn,
                minOut,
                block.timestamp
            ) returns (uint256, uint256 out) {
                amountOut = out;
                emit TokensSwapped(address(USDC), address(CREATOR), amountIn, amountOut);
                return amountOut;
            } catch {}
        }

        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(USDC),
                tokenOut: address(CREATOR),
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        ) returns (
            uint256 out
        ) {
            amountOut = out;
            emit TokensSwapped(address(USDC), address(CREATOR), amountIn, amountOut);
        } catch {
            if (required) revert RequiredSwapFailed();
            amountOut = 0;
        }
    }

    // =================================
    // HARVEST & REBALANCE
    // =================================

    function harvest() external override onlyVault returns (uint256 profit) {
        uint256 currentTotal = getTotalAssets();

        if (currentTotal > lastTotalAssets) {
            profit = currentTotal - lastTotalAssets;
        }

        lastTotalAssets = currentTotal;
        emit StrategyHarvest(profit);
    }

    function rebalance() external override {
        require(msg.sender == owner() || msg.sender == vault, "Only owner or vault");

        // Charm strategy handles its own rebalancing
        uint256 totalAssets = getTotalAssets();
        emit StrategyRebalanced(totalAssets);
    }

    // =================================
    // EMERGENCY
    // =================================

    function emergencyWithdraw() external override onlyVault returns (uint256 withdrawn) {
        if (address(charmVault) == address(0)) {
            withdrawn = CREATOR.balanceOf(address(this));
            if (withdrawn > 0) {
                CREATOR.safeTransfer(vault, withdrawn);
            }
            emit EmergencyWithdraw(vault, withdrawn);
            return withdrawn;
        }

        uint256 ourShares = charmVault.balanceOf(address(this));
        bool creatorIsToken0 = address(charmVault.token0()) == address(CREATOR);

        if (ourShares > 0) {
            (uint256 amount0, uint256 amount1) = charmVault.withdraw(ourShares, 0, 0, address(this));
            uint256 creatorReceived = creatorIsToken0 ? amount0 : amount1;
            uint256 usdcReceived = creatorIsToken0 ? amount1 : amount0;

            // Swap USDC to CREATOR; emergency path is still strict to avoid stranding.
            uint256 totalUsdc = USDC.balanceOf(address(this));
            if (usdcReceived > 0 || totalUsdc > 0) {
                creatorReceived += _swapUsdcToCreatorRequired(totalUsdc);
            }

            withdrawn = creatorReceived;
        }

        // Send all CREATOR to vault
        uint256 totalCreator = CREATOR.balanceOf(address(this));
        if (totalCreator > 0) {
            CREATOR.safeTransfer(vault, totalCreator);
            withdrawn = totalCreator;
        }

        emit EmergencyWithdraw(vault, withdrawn);
    }

    // =================================
    // HELPERS
    // =================================

    function _returnAllTokens() internal {
        uint256 creatorBal = CREATOR.balanceOf(address(this));
        uint256 usdcBal = USDC.balanceOf(address(this));

        if (creatorBal > 0) CREATOR.safeTransfer(vault, creatorBal);
        if (usdcBal > 0) USDC.safeTransfer(vault, usdcBal);
    }

    function _returnUnusedTokens() internal {
        uint256 creatorBal = CREATOR.balanceOf(address(this));
        uint256 usdcBal = USDC.balanceOf(address(this));

        if (creatorBal > 0 || usdcBal > 0) {
            if (creatorBal > 0) CREATOR.safeTransfer(vault, creatorBal);
            if (usdcBal > 0) USDC.safeTransfer(vault, usdcBal);
            emit UnusedTokensReturned(creatorBal, usdcBal);
        }
    }

    // =================================
    // OWNER EMERGENCY
    // =================================

    function ownerEmergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function ownerEmergencyWithdrawFromCharm() external onlyOwner returns (uint256 amount0, uint256 amount1) {
        if (address(charmVault) == address(0)) return (0, 0);

        uint256 ourShares = charmVault.balanceOf(address(this));
        if (ourShares > 0) {
            (amount0, amount1) = charmVault.withdraw(ourShares, 0, 0, address(this));
        }
    }
}
