// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IApprovedV4HooksRegistry} from "./ApprovedV4HooksRegistry.sol";

import {ICreatorOracle} from "../../../interfaces/ICreatorOracle.sol";
import {V4LiquidityAmounts} from "../../../libraries/V4LiquidityAmounts.sol";

/**
 * @title ConcentratedStrategy
 * @author 0xakita.eth (4626)
 * @notice Concentrated liquidity around current price for maximum capital efficiency
 *
 * @dev STRATEGY (inspired by Charm Finance Alpha Vaults):
 *      - Provides liquidity in a tight range around current price
 *      - Higher capital efficiency = more fees per dollar of liquidity
 *      - Requires active management to stay in range
 *      - Auto-rebalances when price moves out of range
 *
 * @dev REBALANCE GUARDS (from Charm):
 *      1. Time-based: Must wait `period` seconds between rebalances
 *      2. Price movement: Must move at least `minTickMove` ticks
 *      3. TWAP deviation: Current price must be within `maxTwapDeviation` of TWAP
 *      4. Boundary check: Price can't be too close to MIN/MAX tick
 *
 * @dev TWAP PROTECTION:
 *      Prevents flash loan attacks by comparing spot price to time-weighted average
 *
 * @dev INTEGRATION:
 *      - Plugs into CreatorLPManager
 *      - Most capital efficient but highest maintenance
 */

enum StrategyType {
    FullRange,
    LimitOrder,
    Concentrated
}

contract ConcentratedStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    // =================================
    // CONSTANTS
    // =================================

    uint256 public constant BASIS_POINTS = 10000;
    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;

    /// @notice Slippage tolerance (in bps) for BURN_POSITION min-out amounts during rebalance.
    /// FIX: S-H05 — BURN_POSITION previously passed zero as both min amounts. To defend
    ///      against sandwich attacks in the same block a rebalance lands (TWAP oracles use
    ///      historical data and cannot react within a single tx), the min amounts are now
    ///      derived from the TWAP-implied sqrtPriceX96 with a 1% floor.
    uint256 public constant REBALANCE_BURN_SLIPPAGE_BPS = 100; // 1%

    /// @notice Tighter slippage tolerance (in bps) for BURN_POSITION during full withdraws.
    /// @dev `withdrawAll` is a higher-trust path (onlyLPManager) but still benefits from a
    ///      non-zero min amount so LP manager bugs / compromised keepers cannot silently
    ///      burn against a manipulated pool. Kept at 2% to avoid unnecessary reverts when
    ///      the pool genuinely diverges from TWAP within a block.
    uint256 public constant WITHDRAW_BURN_SLIPPAGE_BPS = 200; // 2%

    // =================================
    // STATE
    // =================================

    /// @notice Creator Coin token
    IERC20 public immutable CREATOR_COIN;

    /// @notice Paired token (WETH)
    IERC20 public immutable PAIRED_TOKEN;

    /// @notice LP Manager that controls this strategy
    address public lpManager;

    /// @notice Uniswap V4 PoolManager (holds all pools)
    IPoolManager public poolManager;

    /// @notice Uniswap V4 pool key (defines currencies/fee/tickSpacing/hooks)
    PoolKey public poolKey;

    /// @notice Uniswap V4 pool id (derived from poolKey)
    PoolId public poolId;

    /// @notice True if CREATOR_COIN is currency0 for poolKey
    bool public creatorIsCurrency0;

    /// @notice Uniswap V4 PositionManager (PosM)
    address public positionManager;

    /// @notice Permit2 contract used by PosM for token pulls into PoolManager
    address public permit2;

    /// @notice Governance-managed hook allowlist for V4 pool configuration.
    IApprovedV4HooksRegistry public immutable hookRegistry;

    /// @notice Tick spacing for the pool
    int24 public tickSpacing = 60;

    /// @notice Optional TWAP oracle for tick-based manipulation resistance.
    /// @dev If maxTwapDeviation > 0 and this is unset, rebalances will revert.
    ICreatorOracle public twapOracle;

    /// @notice Current position
    struct Position {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 tokenId;
    }
    Position public position;

    // =================================
    // REBALANCE PARAMETERS (Charm-style)
    // =================================

    /// @notice Range width in ticks (half width each side)
    int24 public baseThreshold = 500; // ~5% each side

    /// @notice Minimum time between rebalances
    uint32 public period = 1 hours;

    /// @notice Minimum tick movement required to trigger rebalance
    int24 public minTickMove = 10;

    /// @notice Maximum allowed deviation from TWAP (anti-manipulation)
    int24 public maxTwapDeviation = 100;

    /// @notice TWAP duration in seconds
    /// FIX: S-H05 — 60s TWAP is trivially manipulable; 900s is minimum safe window
    uint32 public twapDuration = 900; // 15 minutes

    /// @notice Last rebalance timestamp
    uint256 public lastTimestamp;

    /// @notice Last tick at rebalance
    int24 public lastTick;

    /// @notice Total liquidity
    uint256 public totalLiquidity;

    /// @notice Whether strategy is active
    bool public isActive_ = true;

    /// @notice Emergency mode flag
    bool public isEmergencyMode;

    // =================================
    // EVENTS
    // =================================

    event Deposited(uint256 creatorCoinAmount, uint256 pairedAmount, uint256 liquidity);
    event Withdrawn(uint256 liquidity, uint256 creatorCoinAmount, uint256 pairedAmount);
    event Rebalanced(int24 oldTickLower, int24 oldTickUpper, int24 newTickLower, int24 newTickUpper, int24 tick);
    event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1, uint256 totalSupply);
    event PoolConfigured(
        bytes32 poolId, address poolManager, address positionManager, address permit2, bool creatorIsCurrency0
    );
    event ApprovalsReconfigured(address oldPositionManager, address oldPermit2, address newPositionManager, address newPermit2);
    event ParametersUpdated(
        int24 baseThreshold, uint32 period, int24 minTickMove, int24 maxTwapDeviation, uint32 twapDuration
    );

    // =================================
    // ERRORS
    // =================================

    error NotLPManager();
    error NotActive();
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotConfigured();
    error InsufficientLiquidity();
    error PeriodNotElapsed(); // PE - time check
    error InsufficientTickMove(); // TM - price movement check
    error TwapDeviationTooHigh(); // TP - TWAP check
    error PriceTooCloseToBoundary(); // PB - boundary check
    error InvalidParameters();
    error PoolNotFullyConfigured();
    error TwapOracleNotSet();
    error PoolAlreadyConfigured();
    error InvalidHook(address hook);
    error HookNotApproved(address hook);

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyLPManager() {
        if (msg.sender != lpManager && msg.sender != owner()) revert NotLPManager();
        _;
    }

    modifier whenActive() {
        if (!isActive_ || isEmergencyMode) revert NotActive();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(address _creatorCoin, address _pairedToken, address _lpManager, address _owner, address _hookRegistry)
        Ownable(_owner)
    {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_pairedToken == address(0)) revert ZeroAddress();
        if (_hookRegistry == address(0)) revert ZeroAddress();

        CREATOR_COIN = IERC20(_creatorCoin);
        PAIRED_TOKEN = IERC20(_pairedToken);
        lpManager = _lpManager;
        hookRegistry = IApprovedV4HooksRegistry(_hookRegistry);
    }

    // =================================
    // CONFIGURATION
    // =================================

    function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
        external
        onlyOwner
    {
        if (positionManager != address(0) || permit2 != address(0) || address(poolManager) != address(0)) {
            revert PoolAlreadyConfigured();
        }
        if (_poolManager == address(0)) revert ZeroAddress();
        if (_positionManager == address(0)) revert ZeroAddress();
        if (_permit2 == address(0)) revert ZeroAddress();

        // Validate poolKey currencies match our configured tokens
        address c0 = Currency.unwrap(_poolKey.currency0);
        address c1 = Currency.unwrap(_poolKey.currency1);
        bool _creatorIsCurrency0 = c0 == address(CREATOR_COIN);
        if (!((_creatorIsCurrency0 && c1 == address(PAIRED_TOKEN))
                    || (c0 == address(PAIRED_TOKEN) && c1 == address(CREATOR_COIN)))) revert PoolNotFullyConfigured();
        if (_poolKey.tickSpacing == 0) revert PoolNotFullyConfigured();
        address hook = address(_poolKey.hooks);
        if (hook == address(0)) revert InvalidHook(hook);
        if (!hookRegistry.isHookApproved(hook)) revert HookNotApproved(hook);

        poolManager = IPoolManager(_poolManager);
        positionManager = _positionManager;
        permit2 = _permit2;
        poolKey = _poolKey;
        poolId = _poolKey.toId();
        creatorIsCurrency0 = _creatorIsCurrency0;
        tickSpacing = _poolKey.tickSpacing;

        // Approvals for PosM: token -> Permit2, then Permit2 -> PosM
        CREATOR_COIN.forceApprove(_permit2, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_permit2, type(uint256).max);
        IAllowanceTransfer(_permit2)
            .approve(address(CREATOR_COIN), _positionManager, type(uint160).max, type(uint48).max);
        IAllowanceTransfer(_permit2)
            .approve(address(PAIRED_TOKEN), _positionManager, type(uint160).max, type(uint48).max);

        emit PoolConfigured(PoolId.unwrap(poolId), _poolManager, _positionManager, _permit2, _creatorIsCurrency0);
    }

    /**
     * @notice Rotate Permit2/PosM approval targets and revoke stale approvals.
     * @dev Useful for operator key rotation or explicit approval hygiene.
     */
    function reconfigureApprovals(address _positionManager, address _permit2) external onlyOwner {
        _requireConfigured();
        if (_positionManager == address(0)) revert ZeroAddress();
        if (_permit2 == address(0)) revert ZeroAddress();

        address oldPositionManager = positionManager;
        address oldPermit2 = permit2;

        // Revoke old allowances first so stale pull rights are removed.
        CREATOR_COIN.forceApprove(oldPermit2, 0);
        PAIRED_TOKEN.forceApprove(oldPermit2, 0);
        IAllowanceTransfer(oldPermit2).approve(address(CREATOR_COIN), oldPositionManager, 0, 0);
        IAllowanceTransfer(oldPermit2).approve(address(PAIRED_TOKEN), oldPositionManager, 0, 0);

        positionManager = _positionManager;
        permit2 = _permit2;

        // Re-grant current approval targets.
        CREATOR_COIN.forceApprove(_permit2, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_permit2, type(uint256).max);
        IAllowanceTransfer(_permit2)
            .approve(address(CREATOR_COIN), _positionManager, type(uint160).max, type(uint48).max);
        IAllowanceTransfer(_permit2)
            .approve(address(PAIRED_TOKEN), _positionManager, type(uint160).max, type(uint48).max);

        emit ApprovalsReconfigured(oldPositionManager, oldPermit2, _positionManager, _permit2);
    }

    function setTwapOracle(address _oracle) external onlyOwner {
        twapOracle = ICreatorOracle(_oracle);
    }

    /**
     * @notice Set rebalance parameters (Charm-style)
     * @param _baseThreshold Half of the range width in ticks
     * @param _period Minimum time between rebalances
     * @param _minTickMove Minimum tick movement to trigger rebalance
     * @param _maxTwapDeviation Maximum allowed deviation from TWAP
     * @param _twapDuration TWAP calculation window
     */
    function setRebalanceParameters(
        int24 _baseThreshold,
        uint32 _period,
        int24 _minTickMove,
        int24 _maxTwapDeviation,
        uint32 _twapDuration
    ) external onlyOwner {
        if (_baseThreshold <= 0) revert InvalidParameters();
        if (_baseThreshold > MAX_TICK) revert InvalidParameters();
        if (_baseThreshold % tickSpacing != 0) revert InvalidParameters();
        if (_minTickMove < 0) revert InvalidParameters();
        if (_maxTwapDeviation < 0) revert InvalidParameters();
        if (_twapDuration == 0) revert InvalidParameters();

        baseThreshold = _baseThreshold;
        period = _period;
        minTickMove = _minTickMove;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;

        emit ParametersUpdated(_baseThreshold, _period, _minTickMove, _maxTwapDeviation, _twapDuration);
    }

    // =================================
    // ILPStrategy INTERFACE
    // =================================

    /**
     * @notice Deposit liquidity into concentrated position
     */
    function deposit(uint256 creatorCoinAmount, uint256 pairedAmount)
        external
        nonReentrant
        onlyLPManager
        whenActive
        returns (uint256 liquidity)
    {
        _requireConfigured();
        if (creatorCoinAmount == 0 && pairedAmount == 0) revert ZeroAmount();

        // Pull tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), pairedAmount);
        }

        int24 currentTick = _getCurrentTick();

        // For first deposit, initialize a new range around current price. Subsequent deposits add to existing range.
        int24 tickLower;
        int24 tickUpper;
        if (position.liquidity == 0) {
            (tickLower, tickUpper) = _calculateRange(currentTick);
        } else {
            tickLower = position.tickLower;
            tickUpper = position.tickUpper;
        }

        (uint256 amountCurrency0, uint256 amountCurrency1) =
            creatorIsCurrency0 ? (creatorCoinAmount, pairedAmount) : (pairedAmount, creatorCoinAmount);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        uint128 liq = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amountCurrency0,
            amountCurrency1
        );

        if (liq == 0) return 0;

        if (position.liquidity == 0) {
            uint256 tokenId = IPositionManager(positionManager).nextTokenId();
            _posmMint(tickLower, tickUpper, liq);
            position = Position({tickLower: tickLower, tickUpper: tickUpper, liquidity: liq, tokenId: tokenId});
            lastTimestamp = block.timestamp;
            lastTick = currentTick;
        } else {
            _posmIncrease(position.tokenId, liq);
            position.liquidity += liq;
        }

        totalLiquidity += uint256(liq);
        liquidity = uint256(liq);

        emit Deposited(creatorCoinAmount, pairedAmount, liquidity);
    }

    /**
     * @notice Withdraw liquidity
     */
    function withdraw(uint256 liquidity)
        external
        nonReentrant
        onlyLPManager
        returns (uint256 creatorCoinAmount, uint256 pairedAmount)
    {
        _requireConfigured();
        if (liquidity == 0) revert ZeroAmount();
        if (liquidity > totalLiquidity) revert InsufficientLiquidity();
        uint128 liqToRemove = uint128(liquidity);
        if (liqToRemove > position.liquidity) liqToRemove = position.liquidity;

        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        _posmDecrease(position.tokenId, liqToRemove);

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

        position.liquidity -= liqToRemove;
        totalLiquidity -= uint256(liqToRemove);

        // Transfer tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }

        emit Withdrawn(liquidity, creatorCoinAmount, pairedAmount);
    }

    /**
     * @notice Withdraw all liquidity
     */
    function withdrawAll()
        external
        nonReentrant
        onlyLPManager
        returns (uint256 creatorCoinAmount, uint256 pairedAmount)
    {
        _requireConfigured();
        if (totalLiquidity == 0) return (0, 0);
        uint256 balCreatorBefore = CREATOR_COIN.balanceOf(address(this));
        uint256 balPairedBefore = PAIRED_TOKEN.balanceOf(address(this));

        uint256 tokenId = position.tokenId;
        (uint128 amount0Min, uint128 amount1Min) = _computeBurnMinAmounts(
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            WITHDRAW_BURN_SLIPPAGE_BPS
        );
        _posmBurn(tokenId, amount0Min, amount1Min);

        creatorCoinAmount = CREATOR_COIN.balanceOf(address(this)) - balCreatorBefore;
        pairedAmount = PAIRED_TOKEN.balanceOf(address(this)) - balPairedBefore;

        uint256 liquidity_ = totalLiquidity;
        position.liquidity = 0;
        position.tokenId = 0;
        totalLiquidity = 0;

        // Transfer tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransfer(lpManager, creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransfer(lpManager, pairedAmount);
        }

        emit Withdrawn(liquidity_, creatorCoinAmount, pairedAmount);
    }

    /**
     * @notice Rebalance position (Charm-style with all guards)
     * @dev Checks: time elapsed, price movement, TWAP deviation, boundary
     */
    function rebalance() external onlyLPManager whenActive {
        _requireConfigured();
        if (position.liquidity == 0) return;

        // Run all rebalance checks (reverts if any fail)
        checkCanRebalance();

        int24 currentTick = _getCurrentTick();
        int24 tickFloor = _floor(currentTick);
        int24 tickCeil = tickFloor + tickSpacing;

        // Calculate new range centered on current price
        int24 newTickLower = tickFloor - baseThreshold;
        int24 newTickUpper = tickCeil + baseThreshold;

        int24 oldTickLower = position.tickLower;
        int24 oldTickUpper = position.tickUpper;

        // Emit snapshot before rebalance
        uint256 balance0 = CREATOR_COIN.balanceOf(address(this));
        uint256 balance1 = PAIRED_TOKEN.balanceOf(address(this));
        emit Snapshot(currentTick, balance0, balance1, totalLiquidity);

        // Burn old position, then mint a fresh one at the new range using all available balances.
        uint256 oldTokenId = position.tokenId;
        uint128 oldLiquidity = position.liquidity;

        (uint128 burnAmount0Min, uint128 burnAmount1Min) = _computeBurnMinAmounts(
            position.tickLower,
            position.tickUpper,
            oldLiquidity,
            REBALANCE_BURN_SLIPPAGE_BPS
        );
        _posmBurn(oldTokenId, burnAmount0Min, burnAmount1Min);

        // Compute new liquidity from current balances (fees + principal now sit idle on this contract)
        uint256 creatorBal = CREATOR_COIN.balanceOf(address(this));
        uint256 pairedBal = PAIRED_TOKEN.balanceOf(address(this));

        (uint256 amountCurrency0, uint256 amountCurrency1) =
            creatorIsCurrency0 ? (creatorBal, pairedBal) : (pairedBal, creatorBal);
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        uint128 newLiquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(newTickLower),
            TickMath.getSqrtPriceAtTick(newTickUpper),
            amountCurrency0,
            amountCurrency1
        );

        uint256 newTokenId = 0;
        if (newLiquidity > 0) {
            newTokenId = IPositionManager(positionManager).nextTokenId();
            _posmMint(newTickLower, newTickUpper, newLiquidity);
        }

        totalLiquidity = totalLiquidity - uint256(oldLiquidity) + uint256(newLiquidity);
        position.tickLower = newTickLower;
        position.tickUpper = newTickUpper;
        position.liquidity = newLiquidity;
        position.tokenId = newTokenId;
        lastTimestamp = block.timestamp;
        lastTick = currentTick;

        emit Rebalanced(oldTickLower, oldTickUpper, newTickLower, newTickUpper, currentTick);
    }

    /**
     * @notice Check if rebalance can be executed (Charm-style guards)
     * @dev Reverts with specific error if any check fails
     */
    function checkCanRebalance() public view {
        // 1. Check enough time has passed
        if (block.timestamp < lastTimestamp + period) {
            revert PeriodNotElapsed();
        }

        int24 currentTick = _getCurrentTick();

        // 2. Check price has moved enough
        int24 tickMove = currentTick > lastTick ? currentTick - lastTick : lastTick - currentTick;
        if (lastTimestamp != 0 && tickMove < minTickMove) {
            revert InsufficientTickMove();
        }

        // 3. Check price is near TWAP (anti-manipulation)
        int24 twap = getTwap();
        int24 twapDeviation = currentTick > twap ? currentTick - twap : twap - currentTick;
        if (twapDeviation > maxTwapDeviation) {
            revert TwapDeviationTooHigh();
        }

        // 4. Check price is not too close to boundary
        if (
            currentTick <= MIN_TICK + baseThreshold + tickSpacing
                || currentTick >= MAX_TICK - baseThreshold - tickSpacing
        ) {
            revert PriceTooCloseToBoundary();
        }
    }

    /**
     * @notice Get time-weighted average price (TWAP) in ticks
     * @dev Queries pool's oracle for historical price data
     */
    function getTwap() public view returns (int24) {
        // Allow explicitly disabling TWAP checks by setting maxTwapDeviation == 0.
        if (maxTwapDeviation == 0) return _getCurrentTick();
        if (address(twapOracle) == address(0)) revert TwapOracleNotSet();
        return twapOracle.getTWAPTick(twapDuration);
    }

    /**
     * @notice Get total value
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue) {
        if (address(poolManager) != address(0) && PoolId.unwrap(poolId) != bytes32(0) && position.liquidity > 0) {
            (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
            (uint256 amount0, uint256 amount1) = V4LiquidityAmounts.getAmountsForLiquidity(
                sqrtPriceX96,
                TickMath.getSqrtPriceAtTick(position.tickLower),
                TickMath.getSqrtPriceAtTick(position.tickUpper),
                position.liquidity
            );

            if (creatorIsCurrency0) {
                creatorCoinValue += amount0;
                pairedValue += amount1;
            } else {
                creatorCoinValue += amount1;
                pairedValue += amount0;
            }
        }

        creatorCoinValue += CREATOR_COIN.balanceOf(address(this));
        pairedValue += PAIRED_TOKEN.balanceOf(address(this));
    }

    function getLiquidity() external view returns (uint256) {
        return totalLiquidity;
    }

    function isActive() external view returns (bool) {
        return isActive_ && !isEmergencyMode;
    }

    function strategyType() external pure returns (StrategyType) {
        return StrategyType.Concentrated;
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Check if rebalance would pass all guards
     */
    function canRebalance() external view returns (bool) {
        try this.checkCanRebalance() {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @notice Get current position details
     */
    function getPosition()
        external
        view
        returns (int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 tokenId)
    {
        return (position.tickLower, position.tickUpper, position.liquidity, position.tokenId);
    }

    /**
     * @notice Get rebalance status info
     */
    function getRebalanceInfo()
        external
        view
        returns (
            int24 currentTick,
            int24 twap,
            int24 twapDeviation,
            uint256 timeSinceLastRebalance,
            int24 tickMoveSinceLast,
            bool canRebalanceNow
        )
    {
        currentTick = _getCurrentTick();
        twap = getTwap();
        twapDeviation = currentTick > twap ? currentTick - twap : twap - currentTick;
        timeSinceLastRebalance = block.timestamp - lastTimestamp;
        tickMoveSinceLast = currentTick > lastTick ? currentTick - lastTick : lastTick - currentTick;

        try this.checkCanRebalance() {
            canRebalanceNow = true;
        } catch {
            canRebalanceNow = false;
        }
    }

    // =================================
    // INTERNAL
    // =================================

    function _getCurrentTick() internal view returns (int24) {
        _requireConfigured();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        return tick;
    }

    function _calculateRange(int24 currentTick) internal view returns (int24 tickLower, int24 tickUpper) {
        int24 tickFloor = _floor(currentTick);
        int24 tickCeil = tickFloor + tickSpacing;

        tickLower = tickFloor - baseThreshold;
        tickUpper = tickCeil + baseThreshold;
    }

    /// @dev Rounds tick down towards negative infinity (multiple of tickSpacing)
    function _floor(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _posmMint(int24 tickLower, int24 tickUpper, uint128 liquidityToAdd) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            uint256(liquidityToAdd),
            type(uint128).max,
            type(uint128).max,
            address(this),
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function _posmIncrease(uint256 tokenId, uint128 liquidityToAdd) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.INCREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint256(liquidityToAdd), type(uint128).max, type(uint128).max, bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    function _posmDecrease(uint256 tokenId, uint128 liquidityToRemove) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, uint256(liquidityToRemove), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    /// @dev FIX: S-H05 — Dual defense against pool manipulation during burns:
    ///      (1) `checkCanRebalance()` rejects rebalances when spot deviates from the
    ///          900s TWAP by more than `maxTwapDeviation` (prevents multi-block
    ///          manipulation and stale-price exits).
    ///      (2) `amount0Min` / `amount1Min` are derived from the TWAP-implied
    ///          sqrtPriceX96 with a per-path slippage floor (see
    ///          REBALANCE_BURN_SLIPPAGE_BPS / WITHDRAW_BURN_SLIPPAGE_BPS). This makes
    ///          same-block sandwiching strictly unprofitable because the burn reverts
    ///          if the PoolManager would return less than the TWAP-implied amounts
    ///          net of slippage.
    function _posmBurn(uint256 tokenId, uint128 amount0Min, uint128 amount1Min) internal {
        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.BURN_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(tokenId, amount0Min, amount1Min, bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        IPositionManager(positionManager).modifyLiquidities(abi.encode(actions, params), block.timestamp + 1);
    }

    /// @dev FIX: S-H05 — Compute BURN_POSITION min-out amounts from the TWAP-implied
    ///      sqrtPriceX96 with a bps slippage floor.
    ///
    ///      Returns (0, 0) when:
    ///        - `liquidity == 0` (nothing to burn) — callers still pay for position tracking state.
    ///        - `maxTwapDeviation == 0` (TWAP checks explicitly disabled by governance). In this
    ///          regime the operator has opted out of manipulation protection wholesale and a
    ///          zero min-out preserves pre-fix withdraw behaviour.
    ///
    ///      Reverts with `TwapOracleNotSet()` when:
    ///        - `maxTwapDeviation > 0` (TWAP protection is on) but `twapOracle` is unset.
    ///          This mirrors `getTwap()`'s presence check and surfaces the mis-configuration
    ///          as a clear, named revert on the `withdrawAll` / `rebalance` paths rather than
    ///          letting the raw low-level call to a zero address bubble up. Using a zero min-out
    ///          fallback here is deliberately avoided because that would silently disable the
    ///          S-H05 slippage floor precisely when the operator believes it is on.
    ///
    ///      Otherwise, computes the expected amounts from the TWAP tick and shaves
    ///      `slippageBps` basis points.
    function _computeBurnMinAmounts(
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 slippageBps
    ) internal view returns (uint128 amount0Min, uint128 amount1Min) {
        if (liquidity == 0) {
            return (0, 0);
        }
        if (maxTwapDeviation == 0) {
            // Operator opted out of TWAP protection; retain legacy zero-min behaviour
            // rather than falling back to spot (which would let spot-manipulators set
            // the floor themselves).
            return (0, 0);
        }
        // FIX: S-H05 follow-up — gate the oracle dereference the same way `getTwap()` does
        // so that an unset oracle surfaces as `TwapOracleNotSet()` instead of a raw revert
        // from calling into address(0). Without this, `withdrawAll` (which does not run the
        // TWAP-deviation checks) would DOS on the mis-config state
        // (twapOracle == address(0) && maxTwapDeviation > 0), which was not the case
        // before the S-H05 fix.
        if (address(twapOracle) == address(0)) revert TwapOracleNotSet();

        int24 twapTick = twapOracle.getTWAPTick(twapDuration);
        uint160 twapSqrtPriceX96 = TickMath.getSqrtPriceAtTick(twapTick);

        (uint256 expected0, uint256 expected1) = LiquidityAmounts.getAmountsForLiquidity(
            twapSqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidity
        );

        uint256 scale = BASIS_POINTS - slippageBps;
        uint256 min0 = (expected0 * scale) / BASIS_POINTS;
        uint256 min1 = (expected1 * scale) / BASIS_POINTS;

        // Cast safely. Positions with liquidity fitting uint128 can still produce amounts
        // exceeding uint128 only in extremely wide / imbalanced configurations; cap at
        // type(uint128).max in that (practically unreachable) edge so we never underflow
        // the min-out silently.
        amount0Min = min0 > type(uint128).max ? type(uint128).max : uint128(min0);
        amount1Min = min1 > type(uint128).max ? type(uint128).max : uint128(min1);
    }

    function _calculateLiquidity(
        uint256 creatorCoinAmount,
        uint256 pairedAmount,
        int24, /* tickLower */
        int24 /* tickUpper */
    )
        internal
        pure
        returns (uint256)
    {
        // Simplified - production uses V4 LiquidityAmounts math
        if (creatorCoinAmount == 0 || pairedAmount == 0) {
            return creatorCoinAmount + pairedAmount;
        }
        return _sqrt(creatorCoinAmount * pairedAmount);
    }

    function _calculateAmountsForLiquidity(uint256 liquidity)
        internal
        view
        returns (uint256 creatorCoinAmount, uint256 pairedAmount)
    {
        // Simplified - production queries V4 position
        creatorCoinAmount = liquidity / 2;
        pairedAmount = liquidity / 2;
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // =================================
    // ADMIN
    // =================================

    function setLPManager(address _lpManager) external onlyOwner {
        if (_lpManager == address(0)) revert ZeroAddress();
        lpManager = _lpManager;
    }

    function setActive(bool _active) external onlyOwner {
        isActive_ = _active;
    }

    function enableEmergencyMode() external onlyOwner {
        isEmergencyMode = true;
    }

    function _requireConfigured() internal view {
        if (address(poolManager) == address(0)) revert PoolNotConfigured();
        if (positionManager == address(0)) revert PoolNotConfigured();
        if (permit2 == address(0)) revert PoolNotConfigured();
        if (PoolId.unwrap(poolId) == bytes32(0)) revert PoolNotConfigured();
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 creatorBal = CREATOR_COIN.balanceOf(address(this));
        uint256 pairedBal = PAIRED_TOKEN.balanceOf(address(this));

        if (creatorBal > 0) {
            CREATOR_COIN.safeTransfer(owner(), creatorBal);
        }
        if (pairedBal > 0) {
            PAIRED_TOKEN.safeTransfer(owner(), pairedBal);
        }
    }
}
