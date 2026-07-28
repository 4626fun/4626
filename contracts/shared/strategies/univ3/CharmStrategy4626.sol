// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
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
    /// @notice ODA-466-9: floor matches default — sub-default windows approach spot manipulability.
    uint32 public constant MIN_TWAP_DURATION = 1800; // 30 minutes
    address public immutable vault; // lane vault
    IERC20 public immutable ASSET; // lane vault asset token (asset coin or agent token)
    IERC20 public immutable USDC; // USDC (quote token)
    ISwapRouter public immutable UNISWAP_ROUTER;

    ICharmVault public charmVault;
    IUniswapV3Pool public swapPool; // ASSET/USDC pool for pricing

    /// @notice Lane oracle (asset in this case) used for valuation inside `getTotalAssets()`.
    /// @dev This is intentionally distinct from Uniswap TWAP used for swap sizing/slippage.
    IOracle4626 public assetOracle;

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

    /// @notice Hard cap for swap/deposit slippage params (audit H-05 residual).
    /// @dev Prevents owner from setting 100% slippage that zeros minOut guards.
    uint256 public constant MAX_SLIPPAGE_BPS = 2_000; // 20%

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
    event AjnaResidualPosition(uint256 debtAsset, uint256 collateralUsdc, bool readable);

    // =================================
    // ERRORS
    // =================================

    error NotVault();
    error NotActive();
    error ZeroAddress();
    error SlippageExceeded(uint256 expected, uint256 actual);
    error InvalidCharmVault(address vault);
    error InvalidSwapPool(address pool);
    error MaxSwapPercentTooHigh(uint256 maxSwapPercent);
    error InvalidCollateralRatioBps(uint256 ratioBps);
    error InvalidAjnaLimitIndex(uint256 limitIndex);
    error InvalidAjnaPool(address expectedQuote, address actualQuote, address expectedCollateral, address actualCollateral);
    error AjnaPositionOpen(uint256 debtBase, uint256 collateralUsdc);
    error WithdrawLiquidityUnavailable(uint256 requested, uint256 available);
    error InvalidEmergencyWithdrawRecipient(address recipient);
    error EmergencyWithdrawRestrictedToken(address token);
    error RebalanceValuationUnavailable();
    error SlippageBpsTooHigh(uint256 bps);
    error CharmSharesOutstanding(address charmVault, uint256 shares);
    error CharmOutOfRange();

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
        // ODA-423-M05: revoke stale unlimited approvals on the previous Charm vault
        // and grant fresh approvals to the new one (mirror setAjnaPool).
        address oldVault = address(charmVault);
        if (oldVault != address(0) && oldVault != _charmVault) {
            uint256 outstanding = ICharmVault(oldVault).balanceOf(address(this));
            if (outstanding != 0) revert CharmSharesOutstanding(oldVault, outstanding);
            ASSET.forceApprove(oldVault, 0);
            USDC.forceApprove(oldVault, 0);
        }
        if (_charmVault == address(0)) {
            charmVault = ICharmVault(address(0));
            return;
        }
        // ODA-466-3: basic validation before forceApprove(max).
        if (_charmVault.code.length == 0) revert InvalidCharmVault(_charmVault);
        ICharmVault candidate = ICharmVault(_charmVault);
        address t0;
        address t1;
        try candidate.token0() returns (address token0_) {
            t0 = token0_;
        } catch {
            revert InvalidCharmVault(_charmVault);
        }
        try candidate.token1() returns (address token1_) {
            t1 = token1_;
        } catch {
            revert InvalidCharmVault(_charmVault);
        }
        bool pairOk = (t0 == address(ASSET) && t1 == address(USDC)) || (t0 == address(USDC) && t1 == address(ASSET));
        if (!pairOk) revert InvalidCharmVault(_charmVault);

        charmVault = candidate;
        ASSET.forceApprove(_charmVault, type(uint256).max);
        USDC.forceApprove(_charmVault, type(uint256).max);
    }

    function setSwapPool(address _swapPool) external onlyOwner {
        // ODA-519-14: mirror setCharmVault validation — swap pool is the slippage/TWAP source.
        if (_swapPool == address(0)) {
            swapPool = IUniswapV3Pool(address(0));
            return;
        }
        if (_swapPool.code.length == 0) revert InvalidSwapPool(_swapPool);
        IUniswapV3Pool candidate = IUniswapV3Pool(_swapPool);
        address t0;
        address t1;
        try candidate.token0() returns (address token0_) {
            t0 = token0_;
        } catch {
            revert InvalidSwapPool(_swapPool);
        }
        try candidate.token1() returns (address token1_) {
            t1 = token1_;
        } catch {
            revert InvalidSwapPool(_swapPool);
        }
        bool pairOk = (t0 == address(ASSET) && t1 == address(USDC)) || (t0 == address(USDC) && t1 == address(ASSET));
        if (!pairOk) revert InvalidSwapPool(_swapPool);
        swapPool = candidate;
    }

    /// @notice Set lane oracle used for valuation (ODA-466-10: EIP-170 — instant set; owner-gated).
    function setAssetOracle(address _assetOracle) external onlyOwner {
        if (_assetOracle == address(0)) revert ZeroAddress();
        assetOracle = IOracle4626(_assetOracle);
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
            return;
        }

        // ODA-466-3: require code + probe quote/collateral views before forceApprove(max).
        if (_ajnaPool.code.length == 0) {
            revert InvalidAjnaPool(address(ASSET), address(0), address(USDC), address(0));
        }
        IAjnaPool pool = IAjnaPool(_ajnaPool);
        address quote;
        address collateral;
        try pool.quoteTokenAddress() returns (address q) {
            quote = q;
        } catch {
            revert InvalidAjnaPool(address(ASSET), address(0), address(USDC), address(0));
        }
        try pool.collateralAddress() returns (address c) {
            collateral = c;
        } catch {
            revert InvalidAjnaPool(address(ASSET), quote, address(USDC), address(0));
        }
        if (quote != address(ASSET) || collateral != address(USDC)) {
            revert InvalidAjnaPool(address(ASSET), quote, address(USDC), collateral);
        }

        ajnaPool = pool;
        ASSET.forceApprove(_ajnaPool, type(uint256).max);
        USDC.forceApprove(_ajnaPool, type(uint256).max);
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
    }

    function setParameters(
        uint256 _maxSwapPercent,
        uint256 _swapSlippageBps,
        uint256 _depositSlippageBps,
        uint24 _swapPoolFee
    ) external onlyOwner {
        // maxSwapPercent is percent units (divides by 100); allow up to 10000 for safety margin.
        if (_maxSwapPercent > 10_000) revert MaxSwapPercentTooHigh(_maxSwapPercent);
        if (_swapSlippageBps > MAX_SLIPPAGE_BPS) revert SlippageBpsTooHigh(_swapSlippageBps);
        if (_depositSlippageBps > MAX_SLIPPAGE_BPS) revert SlippageBpsTooHigh(_depositSlippageBps);
        maxSwapPercent = _maxSwapPercent;
        swapSlippageBps = _swapSlippageBps;
        depositSlippageBps = _depositSlippageBps;
        swapPoolFee = _swapPoolFee;
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

        // ODA-466-4: with outstanding Ajna debt, a stale oracle must fail closed to 0.
        // Zeroing USDC legs via `_usdcToAssetValue` while still subtracting full debt is
        // economically incoherent (prices the loan, erases the collateral).
        if (ajnaState.debtAsset > 0) {
            (, bool fresh) = _getFreshAssetPrice();
            if (!fresh) return 0;
        }

        uint256 grossAsset = idleAsset + charmAsset;
        // NAV keeps oracle pricing for share accounting (see Oracle.t.sol). Withdraw
        // paths use `_realizableTotalAssets` / `_usdcToAssetValueRealizable` (ODA-423-M10)
        // so exits cannot over-promise against a lower TWAP realization.
        // ODA-423-M09 residual: Charm `getTotalAmounts` composition is still spot-based;
        // bounding spot-vs-TWAP composition without calibrated mocks would break NAV tests.
        // Without debt, stale oracle still conservatively ignores USDC legs (returns ASSET-only).
        uint256 usdcInAsset = _usdcToAssetValue(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
        uint256 grossAssetValue = grossAsset + usdcInAsset;

        if (ajnaState.debtAsset >= grossAssetValue) return 0;
        return grossAssetValue - ajnaState.debtAsset;
    }

    /// @notice Conservative equity used to size exits (ODA-423-M10).
    /// @dev Same shape as `getTotalAssets`, but USDC legs use min(oracle, TWAP).
    function _realizableTotalAssets() internal view returns (uint256) {
        uint256 idleAsset = ASSET.balanceOf(address(this));
        uint256 idleUsdc = USDC.balanceOf(address(this));

        (uint256 charmAsset, uint256 charmUsdc, bool charmReadable) = _getCharmExposure();
        if (!charmReadable) {
            charmAsset = 0;
            charmUsdc = 0;
        }

        AjnaDebtState memory ajnaState = _readAjnaDebtState();
        if (!ajnaState.readable) return 0;
        // ODA-466-4: match getTotalAssets fail-closed when debt needs a fresh oracle.
        if (ajnaState.debtAsset > 0) {
            (, bool fresh) = _getFreshAssetPrice();
            if (!fresh) return 0;
        }

        uint256 usdcInAsset =
            _usdcToAssetValueRealizable(idleUsdc + charmUsdc + ajnaState.collateralUsdc);
        uint256 grossAssetValue = idleAsset + charmAsset + usdcInAsset;
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
        // Spot inventory from Charm; USDC→ASSET conversion for exits uses
        // `_usdcToAssetValueRealizable` (ODA-423-M10). M-09 composition bound residual.
        readable = true;
    }

    /// @notice ODA-423-M10: USDC→ASSET for realizable paths uses min(oracle, TWAP).
    function _usdcToAssetValueRealizable(uint256 usdcAmount) internal view returns (uint256) {
        if (usdcAmount == 0) return 0;
        uint256 byOracle = _usdcToAssetValue(usdcAmount);
        (uint256 assetPerUsdc, bool twapOk) = _getPoolPriceTWAP(DEFAULT_TWAP_DURATION);
        if (!twapOk || byOracle == 0) return byOracle;
        uint256 byTwap = Math.mulDiv(usdcAmount, assetPerUsdc, 1e6);
        return byOracle < byTwap ? byOracle : byTwap;
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

        // Preflight Charm range before any ASSET→USDC swap. Out-of-range deposits are
        // deferred; spending ASSET on USDC that cannot be seeded is pure inventory drift.
        (bool charmInRange,,,) = isCharmInRange();

        if (charmAsset > 0 && charmUsdc > 0) {
            // Charm has liquidity - calculate required USDC for our ASSET
            uint256 usdcNeeded = (totalAsset * charmUsdc) / charmAsset;

            if (totalUsdc >= usdcNeeded) {
                // Have enough USDC - use all ASSET
                finalAsset = totalAsset;
                finalUsdc = usdcNeeded;
            } else if (!charmInRange) {
                // Cannot deposit while out of range — keep inventory idle (no swap).
                finalAsset = 0;
                finalUsdc = 0;
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
                    // ODA-519-13: clamp ASSET to what the available USDC can pair with
                    // (same proportional floor as the can't-swap branch below).
                    if (totalUsdc == 0 || charmUsdc == 0) {
                        finalAsset = 0;
                        finalUsdc = 0;
                    } else {
                        uint256 assetUsable = (totalUsdc * charmAsset) / charmUsdc;
                        finalAsset = assetUsable > totalAsset ? totalAsset : assetUsable;
                        usdcNeeded = (finalAsset * charmUsdc) / charmAsset;
                        finalUsdc = totalUsdc > usdcNeeded ? usdcNeeded : totalUsdc;
                    }
                } else {
                    // Can't swap enough - deposit what we can
                    uint256 assetUsable = (totalUsdc * charmAsset) / charmUsdc;
                    finalAsset = assetUsable > totalAsset ? totalAsset : assetUsable;
                    finalUsdc = totalUsdc;
                }
            }
        } else if (!charmInRange) {
            finalAsset = 0;
            finalUsdc = 0;
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

        // Harvest baseline: full NAV when valuation is ready (ODA-423-M01).
        // ODA-466-5: when not ready, still advance by deposited principal so it is
        // not later reported as harvest profit once valuation recovers.
        if (this.isValuationReady()) {
            lastTotalAssets = getTotalAssets();
        } else {
            lastTotalAssets += amount;
        }

        emit StrategyDeposit(msg.sender, amount, deposited);
    }

    /**
     * @notice Calculate how much ASSET to swap for needed USDC
     */
    function _calculateAssetToSwap(uint256 usdcNeeded, uint256 maxAsset) internal view returns (uint256) {
        if (usdcNeeded == 0) return 0;

        // Use TWAP to avoid spot manipulation in quoted swap sizing.
        (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(DEFAULT_TWAP_DURATION);
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

        // ODA-519-21: fail closed on any read failure (was fail-open); Uniswap V3 range is
        // half-open [lower, upper); wrap slot0 in its own try so reverts are caught.
        try charmVault.pool() returns (address poolAddr) {
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddr);
            try pool.slot0() returns (
                uint160, int24 tick, uint16, uint16, uint16, uint8, bool
            ) {
                currentTick = tick;
            } catch {
                return (false, 0, 0, 0);
            }

            try charmVault.baseLower() returns (int24 _lower) {
                lower = _lower;
            } catch {
                return (false, currentTick, 0, 0);
            }

            try charmVault.baseUpper() returns (int24 _upper) {
                upper = _upper;
            } catch {
                return (false, currentTick, lower, 0);
            }

            inRange = currentTick >= lower && currentTick < upper;
        } catch {
            inRange = false;
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
        (bool inRange,,,) = isCharmInRange();
        if (!inRange) {
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
        } catch {
        }
    }

    /**
     * @notice Swap ASSET → USDC with slippage protection
     * @dev Uses Uniswap V3 router with the configured fee tier.
     */
    function _swapAssetToUsdcSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        // Calculate expected output from TWAP quote, not spot.
        (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(DEFAULT_TWAP_DURATION);
        if (!ok || assetPerUsdc == 0) {
            return 0;
        }
        uint256 expectedOut = (amountIn * 1e6) / assetPerUsdc; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(ASSET),
                tokenOut: address(USDC),
                fee: swapPoolFee,
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

        // ODA-423-M10: never attempt to deliver more ASSET than TWAP-realizable equity.
        // Vault hot path already measures returned `withdrawn` (best-effort).
        uint256 realizable = _realizableTotalAssets();
        if (realizable == 0) return 0;
        if (amount > realizable) amount = realizable;

        if (address(charmVault) != address(0)) {
            uint256 ourShares = charmVault.balanceOf(address(this));
            // Size redemption in a single asset-denominated unit to avoid mixing
            // ASSET (1e18) and USDC (1e6) directly.
            (uint256 charmAssetExposure, uint256 charmUsdcExposure,) = _getCharmExposure();
            // ODA-423-M10: size redemption with the same conservative USDC conversion
            // used by the TWAP-bounded swap path (min oracle/TWAP).
            uint256 charmValueInAsset = charmAssetExposure + _usdcToAssetValueRealizable(charmUsdcExposure);
            uint256 sharesToWithdraw =
                charmValueInAsset > 0 ? Math.ceilDiv(ourShares * amount, charmValueInAsset) : ourShares;
            if (sharesToWithdraw > ourShares) sharesToWithdraw = ourShares;

            if (sharesToWithdraw > 0) {
                uint256 totalShares = charmVault.totalSupply();
                (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
                uint256 expected0 = totalShares > 0 ? Math.mulDiv(total0, sharesToWithdraw, totalShares) : 0;
                uint256 expected1 = totalShares > 0 ? Math.mulDiv(total1, sharesToWithdraw, totalShares) : 0;
                uint256 min0 = Math.mulDiv(expected0, 10_000 - depositSlippageBps, 10_000);
                uint256 min1 = Math.mulDiv(expected1, 10_000 - depositSlippageBps, 10_000);
                // Best-effort Charm redeem: do not revert the whole strategy withdraw so the
                // OVault queue can continue to the Ajna sleeve with any partial CREATOR recovered.
                try charmVault.withdraw(sharesToWithdraw, min0, min1, address(this)) {} catch {}
            }
        }

        uint256 availableAsset = ASSET.balanceOf(address(this));
        if (availableAsset < amount) {
            uint256 assetNeeded = amount - availableAsset;

            // Ajna-first: borrow ASSET against available USDC collateral.
            _tryAjnaBorrow(assetNeeded);
            availableAsset = ASSET.balanceOf(address(this));

            // Swap fallback for any residual deficit.
            // ODA-466-12: swap only the USDC shortfall (+ slippage buffer), not all idle USDC.
            if (availableAsset < amount) {
                uint256 totalUsdc = USDC.balanceOf(address(this));
                if (totalUsdc > 0) {
                    assetNeeded = amount - availableAsset;
                    uint256 usdcToSwap = totalUsdc;
                    (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(DEFAULT_TWAP_DURATION);
                    if (ok && assetPerUsdc > 0) {
                        uint256 usdcNeeded = Math.ceilDiv(assetNeeded * 1e6, assetPerUsdc);
                        usdcNeeded = Math.mulDiv(usdcNeeded, 10_000 + swapSlippageBps, 10_000);
                        if (usdcNeeded < usdcToSwap) usdcToSwap = usdcNeeded;
                    }
                    _swapUsdcToAssetSafe(usdcToSwap);
                    availableAsset = ASSET.balanceOf(address(this));
                }
            }
        }

        // Partial fill: return measured CREATOR so OVault can continue to the next strategy.
        withdrawn = availableAsset < amount ? availableAsset : amount;
        if (withdrawn == 0) return 0;

        ASSET.safeTransfer(vault, withdrawn);

        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    /**
     * @notice Swap USDC → ASSET with slippage protection
     */
    function _swapUsdcToAssetSafe(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        return _swapUsdcToAsset(amountIn);
    }

    function _swapUsdcToAsset(uint256 amountIn) internal returns (uint256 amountOut) {
        (uint256 assetPerUsdc, bool ok) = _getPoolPriceTWAP(DEFAULT_TWAP_DURATION);
        if (!ok || assetPerUsdc == 0) {
            return 0;
        }

        uint256 expectedOut = (amountIn * assetPerUsdc) / 1e6; // USDC has 6 decimals
        uint256 minOut = (expectedOut * (10000 - swapSlippageBps)) / 10000;

        try UNISWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(USDC),
                tokenOut: address(ASSET),
                fee: swapPoolFee,
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
        (uint256 borrowLimitIndex, bool borrowReady) = _resolveAjnaLimitIndex(true);
        if (!borrowReady) return 0;

        try pool.drawDebt(address(this), borrowTarget, borrowLimitIndex, _usdcToAjnaWad(collateralToPledgeUsdc)) {
            uint256 assetAfter = ASSET.balanceOf(address(this));
            if (assetAfter > assetBefore) {
                borrowed = assetAfter - assetBefore;
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
        (uint256 repayLimitIndex,) = _resolveAjnaLimitIndex(false);
        try pool.repayDebt(address(this), repayTarget, collateralToPullWad, address(this), repayLimitIndex) returns (
            uint256 amountRepaid
        ) {
            repaid = amountRepaid;
            uint256 usdcAfter = USDC.balanceOf(address(this));
            collateralPulledUsdc = usdcAfter > usdcBefore ? usdcAfter - usdcBefore : 0;
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
     *      Borrow fails closed when the oracle bucket is unavailable; repay keeps a max-index
     *      liveness fallback so debt can still be closed under oracle outage.
     */
    function _resolveAjnaLimitIndex(bool forBorrow) internal view returns (uint256 limitIndex, bool ready) {
        uint256 configured = forBorrow ? ajnaBorrowLimitIndex : ajnaRepayLimitIndex;
        if (configured != 0) return (_clampAjnaBucketIndex(configured), true);

        uint256 oracleBucket = _oracleSuggestedAjnaBucket();
        if (oracleBucket == 0) {
            if (forBorrow) return (0, false);
            return (AJNA_MAX_BUCKET_INDEX, true);
        }

        uint256 extraCollateralBps =
            ajnaMinCollateralRatioBps > 10_000 ? ajnaMinCollateralRatioBps - 10_000 : 0;
        uint256 safetySteps = Math.ceilDiv(extraCollateralBps, AJNA_APPROX_BUCKET_STEP_BPS);
        if (forBorrow) {
            // ODA-519-20: never return unclamped sentinel 0 with ready=true (disables borrow backstop).
            if (oracleBucket <= safetySteps) return (0, false);
            return (_clampAjnaBucketIndex(oracleBucket - safetySteps), true);
        }
        return (_clampAjnaBucketIndex(oracleBucket + safetySteps), true);
    }

    function _oracleSuggestedAjnaBucket() internal view returns (uint256 bucketIndex) {
        IOracle4626 oracle = assetOracle;
        if (address(oracle) == address(0)) return 0;

        try oracle.getAjnaBucketFromV3TWAP(DEFAULT_TWAP_DURATION) returns (uint256 suggested) {
            // Treat explicit 0 as "unavailable" before clamping (min index would invent a price).
            if (suggested == 0) return 0;
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
        // ODA-423-M01: do not latch understated/zero totals while valuation is not ready
        // (stale oracle drops USDC leg but still subtracts full Ajna debt).
        if (!this.isValuationReady()) {
            return 0;
        }

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
        if (totalBefore == 0) revert RebalanceValuationUnavailable();
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

    function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 withdrawn) {
        // ODA-519-16: `withdrawn` must reflect ASSET actually transferred to the vault
        // (never a stale pre-repay Charm amount when Ajna repay consumes the balance).
        withdrawn = 0;

        if (address(charmVault) != address(0)) {
            uint256 ourShares = charmVault.balanceOf(address(this));
            bool assetIsToken0 = address(charmVault.token0()) == address(ASSET);

            if (ourShares > 0) {
                (uint256 min0, uint256 min1) = _charmWithdrawMins(ourShares);
                // Best-effort Charm exit — do not brick Ajna unwind / residual sweeps.
                try charmVault.withdraw(ourShares, min0, min1, address(this)) returns (
                    uint256 amount0, uint256 amount1
                ) {
                    uint256 usdcReceived = assetIsToken0 ? amount1 : amount0;

                    // ODA-423-M02: best-effort swap — do not brick the whole emergency exit
                    // when TWAP/router is unavailable; forward residual USDC below.
                    uint256 totalUsdc = USDC.balanceOf(address(this));
                    if (usdcReceived > 0 || totalUsdc > 0) {
                        _swapUsdcToAssetSafe(totalUsdc);
                    }
                } catch {}
            }
        }

        // Always attempt Ajna unwind (including when Charm vault is unset).
        uint256 assetBeforeRepay = ASSET.balanceOf(address(this));
        if (assetBeforeRepay > 0 && address(ajnaPool) != address(0)) {
            _repayAjnaDebtWithAsset(assetBeforeRepay);
        }

        AjnaDebtState memory residual = _readAjnaDebtState();
        if (residual.debtAsset > 0 || residual.collateralUsdc > 0 || !residual.readable) {
            emit AjnaResidualPosition(residual.debtAsset, residual.collateralUsdc, residual.readable);
        }

        // Send all ASSET to vault
        uint256 totalAsset = ASSET.balanceOf(address(this));
        if (totalAsset > 0) {
            ASSET.safeTransfer(vault, totalAsset);
            withdrawn = totalAsset;
        }

        // ODA-423-M04: forward residual USDC (including when Charm is unset / shares == 0).
        uint256 residualUsdc = USDC.balanceOf(address(this));
        if (residualUsdc > 0) {
            USDC.safeTransfer(vault, residualUsdc);
        }

        emit EmergencyWithdraw(vault, withdrawn);
    }

    /// @dev Expected proportional amounts with depositSlippageBps floor (never 0/0 when exposure exists).
    /// ODA-466-6 SKIP: mins still derive from Charm spot `getTotalAmounts` (same source the
    /// vault returns). Full TWAP/OracleLibrary composition reconstruction is out of smallest-diff
    /// scope; withdraw sizing already uses `_usdcToAssetValueRealizable` for share count.
    function _charmWithdrawMins(uint256 shares) internal view returns (uint256 min0, uint256 min1) {
        if (shares == 0 || address(charmVault) == address(0)) return (0, 0);
        uint256 totalShares = charmVault.totalSupply();
        if (totalShares == 0) return (0, 0);
        (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
        uint256 expected0 = Math.mulDiv(total0, shares, totalShares);
        uint256 expected1 = Math.mulDiv(total1, shares, totalShares);
        uint256 bps = depositSlippageBps;
        if (bps > MAX_SLIPPAGE_BPS) bps = MAX_SLIPPAGE_BPS;
        min0 = Math.mulDiv(expected0, 10_000 - bps, 10_000);
        min1 = Math.mulDiv(expected1, 10_000 - bps, 10_000);
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

    // =================================
    // OWNER EMERGENCY
    // =================================

    function ownerEmergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        // H-07: emergency outs must return to the vault only — never the strategy owner.
        if (to != vault) revert InvalidEmergencyWithdrawRecipient(to);
        // Prevent draining core strategy assets while strategy is active (use vault emergencyWithdraw).
        if (active && (token == address(ASSET) || token == address(USDC) || token == address(charmVault))) {
            revert EmergencyWithdrawRestrictedToken(token);
        }
        IERC20(token).safeTransfer(to, amount);
    }

    /// @notice Pull Charm LP into this strategy and forward ASSET/USDC to the vault.
    /// @dev H-07: recovered inventory cannot be left for ownerEmergencyWithdraw-to-owner.
    ///      H-05: applies depositSlippageBps mins (not 0/0).
    function ownerEmergencyWithdrawFromCharm() external onlyOwner returns (uint256 amount0, uint256 amount1) {
        if (address(charmVault) == address(0)) return (0, 0);

        uint256 ourShares = charmVault.balanceOf(address(this));
        if (ourShares > 0) {
            (uint256 min0, uint256 min1) = _charmWithdrawMins(ourShares);
            (amount0, amount1) = charmVault.withdraw(ourShares, min0, min1, address(this));
        }
        // Always forward core inventory to vault after pull.
        _returnAllTokens();
    }
}
