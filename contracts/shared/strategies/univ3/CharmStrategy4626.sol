// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IUniswapV3Factory} from "@4626/shared/interfaces/uniswap/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "@4626/shared/interfaces/uniswap/IUniswapV3Pool.sol";
import {TickMathCompat} from "@4626/shared/libraries/uniswap/TickMathCompat.sol";
import {IAjnaPool} from "@4626/shared/interfaces/external/IAjnaPool.sol";
import "@4626/shared/interfaces/strategies/IStrategy.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";
import {IStrategyValuation} from "@4626/shared/interfaces/strategies/IStrategyValuation.sol";

/**
 * @title CharmStrategy4626
 * @author 0xakita.eth
 * @notice Charm vault strategy adapter for ASSET/USDC.
 * @dev Asset lane specific yield strategy (asset oracles/tokens). General IStrategy interface allows adaptation for agent/other ecosystems. Base strategies in shared/strategies/ are lane-agnostic.
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
    function rebalance() external;
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

// Interfaces imported from v3-core and interfaces/IStrategy.sol

contract CharmStrategy4626 is IStrategy, IStrategyValuation, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct AjnaDebtState {
        bool readable;
        uint256 debtAsset;
        uint256 collateralUsdc;
    }

    // =================================
    // STATE VARIABLES
    // =================================

    /// @dev Default TWAP window used for valuation (share pricing).
    uint32 internal constant DEFAULT_TWAP_DURATION = 1800; // 30 minutes
    uint32 public constant MIN_TWAP_DURATION = 60; // 1 minute
    uint32 public constant MAX_TWAP_DURATION = 1 days;

    address public immutable vault; // lane vault
    IERC20 public immutable ASSET; // lane vault asset token (asset coin or agent token)
    IERC20 public immutable USDC; // USDC (quote token)
    ISwapRouter public immutable UNISWAP_ROUTER;

    ICharmVault public charmVault;
    IUniswapV3Pool public swapPool; // ASSET/USDC pool for pricing

    /// @notice Lane oracle (asset in this case) used for valuation inside `getTotalAssets()`.
    /// @dev This is intentionally distinct from Uniswap TWAP used for swap sizing/slippage.
    IOracle4626 public assetOracle;

    /// @notice TWAP window (seconds) used for valuation inside `getTotalAssets()`.
    /// @dev This impacts ERC-4626 share pricing via the lane vault's totalAssets().
    uint32 public twapDuration = DEFAULT_TWAP_DURATION;

    /// @notice Uniswap V3 Factory for auto fee tier discovery
    /// @dev Base: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD
    IUniswapV3Factory public uniFactory;
    bool public autoFeeTier = false;

    /// @notice Optional Ajna ERC20 pool used as ASSET borrow backstop against USDC collateral.
    IAjnaPool public ajnaPool;
    bool public ajnaBorrowEnabled;
    uint256 public ajnaMaxDebt = type(uint256).max;
    uint256 public ajnaMaxBorrowPerWithdraw = type(uint256).max;
    uint256 public ajnaMinCollateralRatioBps = 12_500; // 125% minimum collateral ratio target
    uint256 public ajnaBorrowLimitIndex; // 0 => auto-resolve from oracle TWAP bucket
    uint256 public ajnaRepayLimitIndex; // 0 => auto-resolve from oracle TWAP bucket

    uint256 internal constant AJNA_WAD = 1e18;
    uint256 internal constant USDC_TO_AJNA_WAD = 1e12;
    uint256 internal constant AJNA_MIN_BUCKET_INDEX = 1;
    uint256 internal constant AJNA_MAX_BUCKET_INDEX = 7_388;
    uint256 internal constant AJNA_APPROX_BUCKET_STEP_BPS = 50; // Ajna ~0.5% price steps

    /// @notice Configurable parameters
    uint256 public maxSwapPercent = 5; // Max 5% ASSET → USDC (99/1 ratio)
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
    event UnusedTokensReturned(uint256 baseAmount, uint256 usdcAmount);
    event ParametersUpdated(uint256 maxSwapPercent, uint256 swapSlippageBps);
    event TwapDurationUpdated(uint32 oldDuration, uint32 newDuration);
    event LaneOracleUpdated(address indexed oldOracle, address indexed newOracle);
    event AjnaPoolUpdated(address indexed oldPool, address indexed newPool);
    event AjnaBorrowConfigUpdated(
        bool enabled,
        uint256 maxDebt,
        uint256 maxBorrowPerWithdraw,
        uint256 minCollateralRatioBps,
        uint256 borrowLimitIndex,
        uint256 repayLimitIndex
    );
    event AjnaBorrowed(uint256 requestedBase, uint256 borrowedBase, uint256 pledgedUsdc);
    event AjnaRepaid(uint256 repaidBase, uint256 collateralPulledUsdc);

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
    error InvalidCollateralRatioBps(uint256 ratioBps);
    error InvalidAjnaLimitIndex(uint256 limitIndex);
    error InvalidAjnaPool(address expectedQuote, address actualQuote, address expectedCollateral, address actualCollateral);
    error AjnaPositionOpen(uint256 debtBase, uint256 collateralUsdc);
    error WithdrawLiquidityUnavailable(uint256 requested, uint256 available);

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
        address _baseToken,
        address _usdc,
        address _uniswapRouter,
        address _charmVault,
        address _swapPool,
        address _owner
    ) Ownable(_owner) {
        if (_vault == address(0) || _baseToken == address(0) || _usdc == address(0) || _uniswapRouter == address(0)) {
            revert ZeroAddress();
        }

        vault = _vault;
        ASSET = IERC20(_baseToken);
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

    function setAssetOracle(address _assetOracle) external onlyOwner {
        address old = address(assetOracle);
        assetOracle = IOracle4626(_assetOracle);
        emit LaneOracleUpdated(old, _assetOracle);
    }

    function setTwapDuration(uint32 _twapDuration) external onlyOwner {
        if (_twapDuration < MIN_TWAP_DURATION || _twapDuration > MAX_TWAP_DURATION) {
            revert InvalidTwapDuration(_twapDuration);
        }
        uint32 old = twapDuration;
        twapDuration = _twapDuration;
        emit TwapDurationUpdated(old, _twapDuration);
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

    function setAjnaPool(address _ajnaPool) external onlyOwner {
        address oldPool = address(ajnaPool);
        if (oldPool != address(0)) {
            AjnaDebtState memory state = _readAjnaDebtState();
            if (!state.readable || state.debtAsset != 0 || state.collateralUsdc != 0) {
                revert AjnaPositionOpen(state.debtAsset, state.collateralUsdc);
            }
        }

        if (oldPool != address(0)) {
            ASSET.forceApprove(oldPool, 0);
            USDC.forceApprove(oldPool, 0);
        }

        if (_ajnaPool == address(0)) {
            ajnaPool = IAjnaPool(address(0));
            emit AjnaPoolUpdated(oldPool, address(0));
            return;
        }

        IAjnaPool pool = IAjnaPool(_ajnaPool);
        address quote = pool.quoteTokenAddress();
        address collateral = pool.collateralAddress();
        if (quote != address(ASSET) || collateral != address(USDC)) {
            revert InvalidAjnaPool(address(ASSET), quote, address(USDC), collateral);
        }

        ajnaPool = pool;
        ASSET.forceApprove(_ajnaPool, type(uint256).max);
        USDC.forceApprove(_ajnaPool, type(uint256).max);
        emit AjnaPoolUpdated(oldPool, _ajnaPool);
    }

    function setAjnaBorrowConfig(
        bool _enabled,
        uint256 _maxDebt,
        uint256 _maxBorrowPerWithdraw,
        uint256 _minCollateralRatioBps,
        uint256 _borrowLimitIndex,
        uint256 _repayLimitIndex
    ) external onlyOwner {
        if (_minCollateralRatioBps < 10_000) {
            revert InvalidCollateralRatioBps(_minCollateralRatioBps);
        }
        if (_borrowLimitIndex > AJNA_MAX_BUCKET_INDEX) {
            revert InvalidAjnaLimitIndex(_borrowLimitIndex);
        }
        if (_repayLimitIndex > AJNA_MAX_BUCKET_INDEX) {
            revert InvalidAjnaLimitIndex(_repayLimitIndex);
        }

        ajnaBorrowEnabled = _enabled;
        ajnaMaxDebt = _maxDebt;
        ajnaMaxBorrowPerWithdraw = _maxBorrowPerWithdraw;
        ajnaMinCollateralRatioBps = _minCollateralRatioBps;
        ajnaBorrowLimitIndex = _borrowLimitIndex;
        ajnaRepayLimitIndex = _repayLimitIndex;

        emit AjnaBorrowConfigUpdated(
            _enabled, _maxDebt, _maxBorrowPerWithdraw, _minCollateralRatioBps, _borrowLimitIndex, _repayLimitIndex
        );
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
        ASSET.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        USDC.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        if (address(charmVault) != address(0)) {
            ASSET.forceApprove(address(charmVault), type(uint256).max);
            USDC.forceApprove(address(charmVault), type(uint256).max);
        }
        if (address(ajnaPool) != address(0)) {
            ASSET.forceApprove(address(ajnaPool), type(uint256).max);
            USDC.forceApprove(address(ajnaPool), type(uint256).max);
        }
    }

    // =================================
    // ISTRATEGY INTERFACE
    // =================================

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return address(ASSET);
    }

    /**
     * @notice Strategy valuation health check for ERC-4626 deposit/mint gating.
     * @dev MUST NOT revert. Any USDC exposure (idle/charm/Ajna collateral) requires a
     *      fresh lane-oracle (IOracle4626) price. Ajna debt state must be readable and above the
     *      configured collateral ratio threshold when debt is outstanding.
     */
    function isValuationReady() external view override returns (bool) {
        (, uint256 charmUsdc, bool charmReadable) = _getCharmExposure();
        if (!charmReadable) return false;

        AjnaDebtState memory ajnaState = _readAjnaDebtState();
        if (!ajnaState.readable) return false;
        if (ajnaState.debtAsset > ajnaMaxDebt) return false;

        uint256 usdcExposure = USDC.balanceOf(address(this)) + charmUsdc + ajnaState.collateralUsdc;
        bool needsOracle = usdcExposure > 0 || ajnaState.debtAsset > 0;
        if (!needsOracle) return true;

        (uint256 priceUsd, bool priceReady) = _getFreshAssetPrice();
        if (!priceReady) return false;

        if (ajnaState.debtAsset > 0) {
            uint256 collateralValueAsset = _usdcToAssetValueWithPrice(ajnaState.collateralUsdc, priceUsd);
            uint256 collateralRatioBps = _computeCollateralRatioBps(collateralValueAsset, ajnaState.debtAsset);
            if (collateralRatioBps < ajnaMinCollateralRatioBps) return false;
        }

        return true;
    }

    function getAjnaPosition()
        external
        view
        returns (
            bool configured,
            bool readable,
            uint256 debtAsset,
            uint256 collateralUsdc,
            uint256 collateralRatioBps
        )
    {
        configured = address(ajnaPool) != address(0);
        AjnaDebtState memory state = _readAjnaDebtState();
        readable = state.readable;
        debtAsset = state.debtAsset;
        collateralUsdc = state.collateralUsdc;

        if (!state.readable || state.debtAsset == 0) {
            collateralRatioBps = state.debtAsset == 0 ? type(uint256).max : 0;
            return (configured, readable, debtAsset, collateralUsdc, collateralRatioBps);
        }

        (uint256 priceUsd, bool priceReady) = _getFreshAssetPrice();
        if (!priceReady) return (configured, readable, debtAsset, collateralUsdc, 0);

        uint256 collateralValueAsset = _usdcToAssetValueWithPrice(state.collateralUsdc, priceUsd);
        collateralRatioBps = _computeCollateralRatioBps(collateralValueAsset, state.debtAsset);
    }

    function getTotalAssets() public view override returns (uint256) {
        uint256 idleAsset = ASSET.balanceOf(address(this));
        uint256 idleUsdc = USDC.balanceOf(address(this));

        (uint256 charmAsset, uint256 charmUsdc, bool charmReadable) = _getCharmExposure();
        if (!charmReadable) {
            charmAsset = 0;
            charmUsdc = 0;
        }

        AjnaDebtState memory ajnaState = _readAjnaDebtState();
        if (!ajnaState.readable) {
            // Debt state is unknown: fail closed to avoid overstating equity.
            return 0;
        }

        uint256 grossAsset = idleAsset + charmAsset;
        uint256 usdcInAsset = _usdcToAssetValue(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
        uint256 grossAssetValue = grossAsset + usdcInAsset;

        if (ajnaState.debtAsset >= grossAssetValue) return 0;
        return grossAssetValue - ajnaState.debtAsset;
    }

    function _getCharmExposure() internal view returns (uint256 assetAmount, uint256 usdcAmount, bool readable) {
        if (address(charmVault) == address(0)) return (0, 0, true);

        uint256 ourShares;
        uint256 totalShares;

        try charmVault.balanceOf(address(this)) returns (uint256 s) {
            ourShares = s;
        } catch {
            return (0, 0, false);
        }

        try charmVault.totalSupply() returns (uint256 ts) {
            totalShares = ts;
        } catch {
            return (0, 0, false);
        }

        if (ourShares == 0 || totalShares == 0) return (0, 0, true);

        uint256 total0;
        uint256 total1;
        try charmVault.getTotalAmounts() returns (uint256 a0, uint256 a1) {
            total0 = a0;
            total1 = a1;
        } catch {
            return (0, 0, false);
        }

        bool assetIsToken0;
        try charmVault.token0() returns (address t0) {
            assetIsToken0 = (t0 == address(ASSET));
        } catch {
            return (0, 0, false);
        }

        assetAmount = assetIsToken0 ? (total0 * ourShares) / totalShares : (total1 * ourShares) / totalShares;
        usdcAmount = assetIsToken0 ? (total1 * ourShares) / totalShares : (total0 * ourShares) / totalShares;
        readable = true;
    }

    function _readAjnaDebtState() internal view returns (AjnaDebtState memory state) {
        IAjnaPool pool = ajnaPool;
        if (address(pool) == address(0)) {
            state.readable = true;
            return state;
        }

        uint256 t0Debt;
        uint256 collateralWad;
        try pool.borrowerInfo(address(this)) returns (uint256 t0Debt_, uint256 collateral_, uint256) {
            t0Debt = t0Debt_;
            collateralWad = collateral_;
        } catch {
            return state;
        }

        uint256 inflator;
        try pool.inflatorInfo() returns (uint256 inflator_, uint256) {
            inflator = inflator_;
        } catch {
            return state;
        }
        if (inflator == 0) return state;

        state.readable = true;
        state.debtAsset = t0Debt == 0 ? 0 : Math.mulDiv(t0Debt, inflator, AJNA_WAD, Math.Rounding.Ceil);
        state.collateralUsdc = collateralWad / USDC_TO_AJNA_WAD;
    }

    function _getFreshAssetPrice() internal view returns (uint256 priceUsd, bool fresh) {
        IOracle4626 oracle = assetOracle;
        if (address(oracle) == address(0)) return (0, false);

        try oracle.isPriceFresh() returns (bool ok) {
            fresh = ok;
        } catch {
            return (0, false);
        }
        if (!fresh) return (0, false);

        try oracle.getAssetPrice() returns (int256 priceUsdSigned, uint256) {
            if (priceUsdSigned <= 0) return (0, false);
            return (uint256(priceUsdSigned), true);
        } catch {
            return (0, false);
        }
    }

    function _usdcToAssetValue(uint256 usdcAmount) internal view returns (uint256 assetAmount) {
        if (usdcAmount == 0) return 0;

        (uint256 priceUsd, bool fresh) = _getFreshAssetPrice();
        if (!fresh) return 0;
        return _usdcToAssetValueWithPrice(usdcAmount, priceUsd);
    }

    function _usdcToAssetValueWithPrice(uint256 usdcAmount, uint256 assetPriceUsd) internal pure returns (uint256) {
        if (usdcAmount == 0 || assetPriceUsd == 0) return 0;
        // USDC (1e6) -> USD (1e18): *1e12, then USD (1e18) -> ASSET (1e18): *1e18/price
        // => usdcAmount * 1e30 / assetPriceUsd
        return Math.mulDiv(usdcAmount, 1e30, assetPriceUsd);
    }

    function _computeCollateralRatioBps(uint256 collateralValueAsset, uint256 debtAsset) internal pure returns (uint256) {
        if (debtAsset == 0) return type(uint256).max;
        return Math.mulDiv(collateralValueAsset, 10_000, debtAsset);
    }

    /**
     * @notice Get manipulation-resistant valuation price (ASSET per USDC, 1e18).
     * @dev Uses Uniswap V3 TWAP (pool observations), not spot `slot0` (manipulable intra-tx).
     *      If observations are unavailable, returns (0,false). Callers should not silently fall back to spot pricing.
     */
    function _getPoolPriceTWAP(uint32 duration) internal view returns (uint256 assetPerUsdc, bool ok) {
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

            // Quote: how much ASSET for 1 USDC (1e6 base units) -> returns ASSET units (1e18).
            uint256 quote = _getQuoteAtTick(int24(meanTick), uint128(1e6), address(USDC), address(ASSET));
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
     * @notice Deposit ASSET tokens (single-sided deposit)
     * @dev Automatically swaps portion to USDC to maintain Charm vault ratio
     * @param amount Amount of ASSET tokens to deposit
     * @return deposited Actual amount deployed (in ASSET value)
     */
    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        if (address(charmVault) == address(0)) {
            _returnAllTokens();
            return 0;
        }

        // Pull ASSET tokens from the vault. `onlyVault` guarantees msg.sender is the trusted vault.
        if (amount > 0) {
            ASSET.safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 totalAsset = ASSET.balanceOf(address(this));
        uint256 totalUsdc = USDC.balanceOf(address(this));

        // Deposit-side policy: repay Ajna ASSET debt first, then allocate remaining
        // ASSET/USDC to Charm. Any collateral released by repay increases USDC leg.
        (uint256 repaidAsset,) = _repayAjnaDebtWithAsset(totalAsset);
        if (repaidAsset > 0) {
            totalAsset = ASSET.balanceOf(address(this));
            totalUsdc = USDC.balanceOf(address(this));
        }

        if (totalAsset == 0 && totalUsdc == 0) return 0;

        // Get Charm vault ratio (total0 could be ASSET or USDC depending on token order)
        (uint256 charm0, uint256 charm1) = charmVault.getTotalAmounts();
        bool assetIsToken0 = address(charmVault.token0()) == address(ASSET);

        uint256 charmAsset = assetIsToken0 ? charm0 : charm1;
        uint256 charmUsdc = assetIsToken0 ? charm1 : charm0;

        uint256 finalAsset;
        uint256 finalUsdc;

        if (charmAsset > 0 && charmUsdc > 0) {
            // Charm has liquidity - calculate required USDC for our ASSET
            uint256 usdcNeeded = (totalAsset * charmUsdc) / charmAsset;

            if (totalUsdc >= usdcNeeded) {
                // Have enough USDC - use all ASSET
                finalAsset = totalAsset;
                finalUsdc = usdcNeeded;
            } else {
                // Need more USDC - swap some ASSET → USDC
                uint256 usdcDeficit = usdcNeeded - totalUsdc;

                // Limit swap to maxSwapPercent of ASSET
                uint256 maxSwapAsset = (totalAsset * maxSwapPercent) / 100;
                uint256 assetToSwap = _calculateAssetToSwap(usdcDeficit, maxSwapAsset);

                if (assetToSwap > 0) {
                    // Refresh balances from storage after attempting the swap.
                    // In bootstrap/no-liquidity phases the swap can be skipped or revert-safe,
                    // and we must not assume `assetToSwap` was actually spent.
                    _swapAssetToUsdcSafe(assetToSwap);
                    totalAsset = ASSET.balanceOf(address(this));
                    totalUsdc = USDC.balanceOf(address(this));

                    // Recalculate with new balances
                    usdcNeeded = (totalAsset * charmUsdc) / charmAsset;
                    finalAsset = totalAsset;
                    finalUsdc = totalUsdc > usdcNeeded ? usdcNeeded : totalUsdc;
                } else {
                    // Can't swap enough - deposit what we can
                    uint256 assetUsable = (totalUsdc * charmAsset) / charmUsdc;
                    finalAsset = assetUsable > totalAsset ? totalAsset : assetUsable;
                    finalUsdc = totalUsdc;
                }
            }
        } else {
            // Charm empty - deposit 99% ASSET, 1% USDC
            // Attempt to swap ~1% ASSET → USDC for bootstrap seeding.
            uint256 assetToSwap = totalAsset / 100; // 1%

            if (assetToSwap > 0) {
                // Bootstrap can have zero V3 liquidity and no TWAP history yet.
                // Re-read actual balances instead of assuming a successful swap.
                _swapAssetToUsdcSafe(assetToSwap);
                totalAsset = ASSET.balanceOf(address(this));
                totalUsdc = USDC.balanceOf(address(this));
            }

            // Enforce bootstrap intent: do not seed an initial one-sided ASSET position.
            // If no USDC leg is available yet, defer Charm deposit and keep assets idle.
            if (totalAsset > 0 && totalUsdc == 0) {
                emit DepositFailed("Bootstrap deferred: require USDC leg for initial 99/1 seed");
                finalAsset = 0;
                finalUsdc = 0;
            } else {
                finalAsset = totalAsset;
                finalUsdc = totalUsdc;
            }
        }

        // Deposit to Charm with safety checks
        _depositToCharmSafe(finalAsset, finalUsdc, assetIsToken0);

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
     * @notice Calculate how much ASSET to swap for needed USDC
     */
    function _calculateAssetToSwap(uint256 usdcNeeded, uint256 maxAsset) internal view returns (uint256) {
        if (usdcNeeded == 0) return 0;

        // Use TWAP to avoid spot manipulation in quoted swap sizing.
        (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(twapDuration);
        if (!ok || assetPerUsdc == 0) return 0;
        uint256 assetNeeded = (usdcNeeded * assetPerUsdc) / 1e6; // USDC has 6 decimals

        // Add slippage buffer (3%)
        assetNeeded = (assetNeeded * 10300) / 10000;

        return assetNeeded > maxAsset ? maxAsset : assetNeeded;
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
    function _depositToCharmSafe(uint256 assetAmount, uint256 usdcAmount, bool assetIsToken0)
        internal
        returns (uint256 shares)
    {
        if (assetAmount == 0 && usdcAmount == 0) return 0;

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
        uint256 minAsset = (assetAmount * (10000 - depositSlippageBps)) / 10000;
        uint256 minUsdc = (usdcAmount * (10000 - depositSlippageBps)) / 10000;

        // Prepare amounts based on token order
        uint256 amount0 = assetIsToken0 ? assetAmount : usdcAmount;
        uint256 amount1 = assetIsToken0 ? usdcAmount : assetAmount;
        uint256 min0 = assetIsToken0 ? minAsset : minUsdc;
        uint256 min1 = assetIsToken0 ? minUsdc : minAsset;

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
     * @notice Swap ASSET → USDC with slippage protection
     * @dev Uses Uniswap V3 router with optional auto fee tier discovery.
     */
    function _swapAssetToUsdcSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        // Auto-discover best fee tier if enabled
        uint24 fee = _findBestFeeTier(address(ASSET), address(USDC));

        // Calculate expected output from TWAP quote, not spot.
        (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(twapDuration);
        if (!ok || assetPerUsdc == 0) {
            return 0;
        }
        uint256 expectedOut = (amountIn * 1e6) / assetPerUsdc; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(ASSET),
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
            emit TokensSwapped(address(ASSET), address(USDC), amountIn, amountOut);
        } catch {
            amountOut = 0;
        }
    }

    // =================================
    // WITHDRAW
    // =================================

    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn) {
        if (amount == 0) return 0;

        uint256 totalValue = getTotalAssets();
        if (totalValue == 0) return 0;

        if (address(charmVault) != address(0)) {
            uint256 ourShares = charmVault.balanceOf(address(this));
            // FIX: S-M01 — use Charm vault's own getTotalAmounts for accurate share conversion
            // instead of (ourShares * amount) / totalValue which conflates strategy-level
            // and Charm-level accounting
            (uint256 charm0, uint256 charm1) = charmVault.getTotalAmounts();
            uint256 charmTotal = charm0 + charm1;
            uint256 sharesToWithdraw = charmTotal > 0
                ? (ourShares * amount) / charmTotal
                : ourShares;
            if (sharesToWithdraw > ourShares) sharesToWithdraw = ourShares;

            if (sharesToWithdraw > 0) {
                charmVault.withdraw(sharesToWithdraw, 0, 0, address(this));
            }
        }

        uint256 availableAsset = ASSET.balanceOf(address(this));
        if (availableAsset < amount) {
            uint256 assetNeeded = amount - availableAsset;

            // Ajna-first: borrow ASSET against available USDC collateral.
            _tryAjnaBorrow(assetNeeded);
            availableAsset = ASSET.balanceOf(address(this));

            // Swap fallback for any residual deficit.
            if (availableAsset < amount) {
                uint256 totalUsdc = USDC.balanceOf(address(this));
                if (totalUsdc > 0) {
                    _swapUsdcToAssetSafe(totalUsdc);
                    availableAsset = ASSET.balanceOf(address(this));
                }
            }
        }

        if (availableAsset < amount) revert WithdrawLiquidityUnavailable(amount, availableAsset);

        ASSET.safeTransfer(vault, amount);
        withdrawn = amount;

        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    /**
     * @notice Swap USDC → ASSET with slippage protection
     */
    function _swapUsdcToAssetSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        return _swapUsdcToAsset(amountIn, false);
    }

    function _swapUsdcToAssetRequired(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        return _swapUsdcToAsset(amountIn, true);
    }

    function _swapUsdcToAsset(uint256 amountIn, bool required) internal returns (uint256 amountOut) {
        (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(twapDuration);
        if (!ok || assetPerUsdc == 0) {
            if (required) revert TwapUnavailable();
            return 0;
        }

        uint24 fee = _findBestFeeTier(address(USDC), address(ASSET));

        uint256 expectedOut = (amountIn * assetPerUsdc) / 1e6; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(USDC),
                tokenOut: address(ASSET),
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
            emit TokensSwapped(address(USDC), address(ASSET), amountIn, amountOut);
        } catch {
            if (required) revert RequiredSwapFailed();
            amountOut = 0;
        }
    }

    function _tryAjnaBorrow(uint256 assetNeeded) internal returns (uint256 borrowed) {
        if (!ajnaBorrowEnabled || assetNeeded == 0) return 0;

        IAjnaPool pool = ajnaPool;
        if (address(pool) == address(0)) return 0;

        AjnaDebtState memory state = _readAjnaDebtState();
        if (!state.readable || state.debtAsset >= ajnaMaxDebt) return 0;

        uint256 usdcAvailable = USDC.balanceOf(address(this));

        (uint256 priceUsd, bool priceReady) = _getFreshAssetPrice();
        if (!priceReady) return 0;

        uint256 debtCapacity = ajnaMaxDebt - state.debtAsset;
        uint256 existingCollateralAsset = _usdcToAssetValueWithPrice(state.collateralUsdc, priceUsd);
        uint256 totalCollateralAsset = existingCollateralAsset + _usdcToAssetValueWithPrice(usdcAvailable, priceUsd);
        uint256 maxTotalDebtFromCollateral = Math.mulDiv(totalCollateralAsset, 10_000, ajnaMinCollateralRatioBps);
        if (maxTotalDebtFromCollateral <= state.debtAsset) return 0;
        uint256 maxBorrowByCollateral = maxTotalDebtFromCollateral - state.debtAsset;

        uint256 borrowTarget = assetNeeded;
        if (borrowTarget > ajnaMaxBorrowPerWithdraw) borrowTarget = ajnaMaxBorrowPerWithdraw;
        if (borrowTarget > debtCapacity) borrowTarget = debtCapacity;
        if (borrowTarget > maxBorrowByCollateral) borrowTarget = maxBorrowByCollateral;
        if (borrowTarget == 0) return 0;

        uint256 newDebt = state.debtAsset + borrowTarget;
        uint256 requiredTotalCollateralAsset = Math.mulDiv(newDebt, ajnaMinCollateralRatioBps, 10_000, Math.Rounding.Ceil);
        uint256 additionalCollateralAssetNeeded =
            requiredTotalCollateralAsset > existingCollateralAsset ? requiredTotalCollateralAsset - existingCollateralAsset : 0;
        uint256 collateralToPledgeUsdc =
            additionalCollateralAssetNeeded == 0 ? 0 : _assetToUsdcAmountWithPrice(additionalCollateralAssetNeeded, priceUsd);
        if (collateralToPledgeUsdc > usdcAvailable) {
            collateralToPledgeUsdc = usdcAvailable;
        }

        uint256 actualTotalCollateralAsset =
            existingCollateralAsset + _usdcToAssetValueWithPrice(collateralToPledgeUsdc, priceUsd);
        uint256 maxDebtFromActualCollateral = Math.mulDiv(actualTotalCollateralAsset, 10_000, ajnaMinCollateralRatioBps);
        if (maxDebtFromActualCollateral <= state.debtAsset) return 0;
        uint256 maxBorrowFromActualCollateral = maxDebtFromActualCollateral - state.debtAsset;
        if (borrowTarget > maxBorrowFromActualCollateral) {
            borrowTarget = maxBorrowFromActualCollateral;
            if (borrowTarget == 0) return 0;
        }

        uint256 assetBefore = ASSET.balanceOf(address(this));
        uint256 usdcBefore = USDC.balanceOf(address(this));
        uint256 borrowLimitIndex = _resolveAjnaLimitIndex(true);

        try pool.drawDebt(address(this), borrowTarget, borrowLimitIndex, _usdcToAjnaWad(collateralToPledgeUsdc)) {
            uint256 assetAfter = ASSET.balanceOf(address(this));
            if (assetAfter > assetBefore) {
                borrowed = assetAfter - assetBefore;
                uint256 usdcAfter = USDC.balanceOf(address(this));
                uint256 pledgedUsdc = usdcBefore > usdcAfter ? usdcBefore - usdcAfter : 0;
                emit AjnaBorrowed(borrowTarget, borrowed, pledgedUsdc);
            }
        } catch {
            return 0;
        }
    }

    function _repayAjnaDebtWithAsset(uint256 availableAsset)
        internal
        returns (uint256 repaid, uint256 collateralPulledUsdc)
    {
        if (availableAsset == 0) return (0, 0);

        IAjnaPool pool = ajnaPool;
        if (address(pool) == address(0)) return (0, 0);

        AjnaDebtState memory state = _readAjnaDebtState();
        if (!state.readable || state.debtAsset == 0) return (0, 0);

        uint256 repayTarget = availableAsset > state.debtAsset ? state.debtAsset : availableAsset;
        if (repayTarget == 0) return (0, 0);

        uint256 collateralToPullWad;
        if (state.collateralUsdc > 0 && state.debtAsset > 0) {
            uint256 proportionalCollateralUsdc = Math.mulDiv(state.collateralUsdc, repayTarget, state.debtAsset);
            collateralToPullWad = _usdcToAjnaWad(proportionalCollateralUsdc);
        }

        uint256 usdcBefore = USDC.balanceOf(address(this));
        uint256 repayLimitIndex = _resolveAjnaLimitIndex(false);
        try pool.repayDebt(address(this), repayTarget, collateralToPullWad, address(this), repayLimitIndex) returns (
            uint256 amountRepaid
        ) {
            repaid = amountRepaid;
            uint256 usdcAfter = USDC.balanceOf(address(this));
            collateralPulledUsdc = usdcAfter > usdcBefore ? usdcAfter - usdcBefore : 0;
            if (repaid > 0 || collateralPulledUsdc > 0) {
                emit AjnaRepaid(repaid, collateralPulledUsdc);
            }
        } catch {
            return (0, 0);
        }
    }

    function _usdcToAjnaWad(uint256 usdcAmount) internal pure returns (uint256) {
        return usdcAmount * USDC_TO_AJNA_WAD;
    }

    /**
     * @notice Resolve Ajna draw/repay limit index.
     * @dev Configured non-zero index is used as-is (clamped); 0 enables oracle-driven auto mode:
     *      base bucket from the lane oracle's V3 TWAP helper + conservative collateral-ratio buffer.
     */
    function _resolveAjnaLimitIndex(bool forBorrow) internal view returns (uint256 limitIndex) {
        uint256 configured = forBorrow ? ajnaBorrowLimitIndex : ajnaRepayLimitIndex;
        if (configured != 0) return _clampAjnaBucketIndex(configured);

        uint256 oracleBucket = _oracleSuggestedAjnaBucket();
        if (oracleBucket == 0) return AJNA_MAX_BUCKET_INDEX;

        uint256 extraCollateralBps =
            ajnaMinCollateralRatioBps > 10_000 ? ajnaMinCollateralRatioBps - 10_000 : 0;
        uint256 safetySteps = Math.ceilDiv(extraCollateralBps, AJNA_APPROX_BUCKET_STEP_BPS);
        return _clampAjnaBucketIndex(oracleBucket + safetySteps);
    }

    function _oracleSuggestedAjnaBucket() internal view returns (uint256 bucketIndex) {
        IOracle4626 oracle = assetOracle;
        if (address(oracle) == address(0)) return 0;

        try oracle.getAjnaBucketFromV3TWAP(twapDuration) returns (uint256 suggested) {
            bucketIndex = _clampAjnaBucketIndex(suggested);
        } catch {
            bucketIndex = 0;
        }
    }

    function _clampAjnaBucketIndex(uint256 index) internal pure returns (uint256) {
        if (index < AJNA_MIN_BUCKET_INDEX) return AJNA_MIN_BUCKET_INDEX;
        if (index > AJNA_MAX_BUCKET_INDEX) return AJNA_MAX_BUCKET_INDEX;
        return index;
    }

    function _assetToUsdcAmountWithPrice(uint256 assetAmount, uint256 assetPriceUsd)
        internal
        pure
        returns (uint256)
    {
        if (assetAmount == 0 || assetPriceUsd == 0) return 0;
        // Inverse of _usdcToAssetValueWithPrice:
        // asset = usdc * 1e30 / price  => usdc = asset * price / 1e30
        return Math.mulDiv(assetAmount, assetPriceUsd, 1e30, Math.Rounding.Ceil);
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

        // FIX: S-H04 — trigger actual Charm vault rebalance with slippage post-check
        uint256 totalBefore = getTotalAssets();
        if (address(charmVault) != address(0)) {
            charmVault.rebalance();
        }
        uint256 totalAfter = getTotalAssets();
        // Enforce maximum slippage loss during rebalance
        uint256 maxLoss = (totalBefore * depositSlippageBps) / 10000;
        require(totalAfter + maxLoss >= totalBefore, "Rebalance slippage exceeded");

        emit StrategyRebalanced(totalAfter);
    }

    // =================================
    // EMERGENCY
    // =================================

    function emergencyWithdraw() external override onlyVault returns (uint256 withdrawn) {
        if (address(charmVault) == address(0)) {
            withdrawn = ASSET.balanceOf(address(this));
            if (withdrawn > 0) {
                ASSET.safeTransfer(vault, withdrawn);
            }
            emit EmergencyWithdraw(vault, withdrawn);
            return withdrawn;
        }

        uint256 ourShares = charmVault.balanceOf(address(this));
        bool assetIsToken0 = address(charmVault.token0()) == address(ASSET);

        if (ourShares > 0) {
            (uint256 amount0, uint256 amount1) = charmVault.withdraw(ourShares, 0, 0, address(this));
            uint256 assetReceived = assetIsToken0 ? amount0 : amount1;
            uint256 usdcReceived = assetIsToken0 ? amount1 : amount0;

            // Swap USDC to ASSET; emergency path is still strict to avoid stranding.
            uint256 totalUsdc = USDC.balanceOf(address(this));
            if (usdcReceived > 0 || totalUsdc > 0) {
                assetReceived += _swapUsdcToAssetRequired(totalUsdc);
            }

            withdrawn = assetReceived;
        }

        // Send all ASSET to vault
        uint256 totalAsset = ASSET.balanceOf(address(this));
        if (totalAsset > 0) {
            ASSET.safeTransfer(vault, totalAsset);
            withdrawn = totalAsset;
        }

        emit EmergencyWithdraw(vault, withdrawn);
    }

    // =================================
    // HELPERS
    // =================================

    function _returnAllTokens() internal {
        uint256 assetBal = ASSET.balanceOf(address(this));
        uint256 usdcBal = USDC.balanceOf(address(this));

        if (assetBal > 0) ASSET.safeTransfer(vault, assetBal);
        if (usdcBal > 0) USDC.safeTransfer(vault, usdcBal);
    }

    function _returnUnusedTokens() internal {
        uint256 assetBal = ASSET.balanceOf(address(this));
        uint256 usdcBal = USDC.balanceOf(address(this));

        if (assetBal > 0 || usdcBal > 0) {
            if (assetBal > 0) ASSET.safeTransfer(vault, assetBal);
            if (usdcBal > 0) USDC.safeTransfer(vault, usdcBal);
            emit UnusedTokensReturned(assetBal, usdcBal);
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
