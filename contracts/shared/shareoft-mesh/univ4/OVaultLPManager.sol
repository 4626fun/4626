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
import {IApprovedV4HooksRegistry} from "@4626/shared/shareoft-mesh/univ4/ApprovedV4HooksRegistry.sol";

import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";
import {V4LiquidityAmounts} from "@4626/shared/libraries/uniswap/V4LiquidityAmounts.sol";

/**
 * @title OVaultLPManager
 * @notice Share-mesh Uniswap V4 LP orchestrator for ShareOFT paired with native ETH or WETH.
 * @dev Manages three internal positions (full range, base, limit). Not a vault strategy sleeve.
 */
contract OVaultLPManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    int24 public constant MIN_TICK = -887272;
    int24 public constant MAX_TICK = 887272;
    uint256 public constant PRECISION = 1e6;

    IERC20 public immutable ASSET;
    /// @notice Paired token address; `address(0)` means native ETH.
    address public immutable pairedToken;
    bool public immutable pairedIsNative;

    IPoolManager public poolManager;
    PoolKey public poolKey;
    PoolId public poolId;
    bool public assetIsCurrency0;
    address public positionManager;
    address public permit2;
    IApprovedV4HooksRegistry public immutable hookRegistry;
    address public vault;
    int24 public tickSpacing;
    IOracle4626 public twapOracle;

    struct PositionInfo {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint256 tokenId;
    }

    PositionInfo public fullRangePosition;
    PositionInfo public basePosition;
    PositionInfo public limitPosition;

    uint24 public fullRangeWeight = 400000;
    int24 public baseThreshold = 500;
    int24 public limitThreshold = 100;
    uint32 public period = 1 hours;
    int24 public minTickMove = 10;
    int24 public maxTwapDeviation = 100;
    uint32 public twapDuration = 900;
    uint256 public lastTimestamp;
    int24 public lastTick;
    uint256 public maxRebalanceSlippageBps = 500;

    uint256 public accruedFees0;
    uint256 public accruedFees1;
    address public feeRecipient;
    mapping(address => bool) public isManager;

    event Deposit(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Withdraw(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Rebalanced(int24 tick, uint256 balance0, uint256 balance1);
    event SeedRebalanced(int24 tick, uint256 balance0, uint256 balance1);
    event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1);
    event FeesCollected(uint256 fees0, uint256 fees1);
    event ParametersUpdated(uint24 fullRangeWeight, int24 baseThreshold, int24 limitThreshold);
    event PoolConfigured(
        bytes32 poolId, address poolManager, address positionManager, address permit2, bool assetIsCurrency0
    );
    event ApprovalsReconfigured(address oldPositionManager, address oldPermit2, address newPositionManager, address newPermit2);

    error NotVault();
    error NotManager();
    error ZeroAddress();
    error ZeroAmount();
    error PoolNotConfigured();
    error PeriodNotElapsed();
    error InsufficientTickMove();
    error TwapDeviationTooHigh();
    error PriceTooCloseToBoundary();
    error InvalidParameters();
    error PositionManagerNotSet();
    error Permit2NotSet();
    error InvalidPoolKey();
    error TwapOracleNotSet();
    error PoolAlreadyConfigured();
    error InvalidHook(address hook);
    error HookNotApproved(address hook);
    error RebalanceSlippageExceeded(uint256 valueBefore, uint256 valueAfter);
    error PositionsNotEmpty();

    modifier onlyVault() {
        if (msg.sender != vault && msg.sender != owner()) revert NotVault();
        _;
    }

    modifier onlyManager() {
        if (!isManager[msg.sender] && msg.sender != owner()) revert NotManager();
        _;
    }

    receive() external payable {}

    constructor(address _asset, address _pairedToken, address _vault, address _owner, address _hookRegistry)
        Ownable(_owner)
    {
        if (_asset == address(0)) revert ZeroAddress();
        if (_hookRegistry == address(0)) revert ZeroAddress();

        ASSET = IERC20(_asset);
        pairedToken = _pairedToken;
        pairedIsNative = _pairedToken == address(0);
        vault = _vault;
        hookRegistry = IApprovedV4HooksRegistry(_hookRegistry);
    }

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

        address c0 = Currency.unwrap(_poolKey.currency0);
        address c1 = Currency.unwrap(_poolKey.currency1);
        bool _assetIsCurrency0 = c0 == address(ASSET);
        if (pairedIsNative) {
            if (!((_assetIsCurrency0 && c1 == address(0)) || (c0 == address(0) && c1 == address(ASSET)))) {
                revert InvalidPoolKey();
            }
        } else if (!((_assetIsCurrency0 && c1 == pairedToken) || (c0 == pairedToken && c1 == address(ASSET)))) {
            revert InvalidPoolKey();
        }
        if (_poolKey.tickSpacing == 0) revert InvalidPoolKey();
        address hook = address(_poolKey.hooks);
        if (hook == address(0)) revert InvalidHook(hook);
        if (!hookRegistry.isHookApproved(hook)) revert HookNotApproved(hook);

        poolManager = IPoolManager(_poolManager);
        positionManager = _positionManager;
        permit2 = _permit2;
        poolKey = _poolKey;
        poolId = _poolKey.toId();
        assetIsCurrency0 = _assetIsCurrency0;
        tickSpacing = _poolKey.tickSpacing;

        fullRangePosition.tickLower = (MIN_TICK / tickSpacing) * tickSpacing;
        fullRangePosition.tickUpper = (MAX_TICK / tickSpacing) * tickSpacing;

        ASSET.forceApprove(_permit2, type(uint256).max);
        IAllowanceTransfer(_permit2).approve(address(ASSET), _positionManager, type(uint160).max, type(uint48).max);
        if (!pairedIsNative) {
            IERC20(pairedToken).forceApprove(_permit2, type(uint256).max);
            IAllowanceTransfer(_permit2).approve(pairedToken, _positionManager, type(uint160).max, type(uint48).max);
        }

        emit PoolConfigured(PoolId.unwrap(poolId), _poolManager, _positionManager, _permit2, _assetIsCurrency0);
    }

    function reconfigureApprovals(address _positionManager, address _permit2) external onlyOwner {
        _requireConfigured();
        if (_positionManager == address(0)) revert ZeroAddress();
        if (_permit2 == address(0)) revert ZeroAddress();

        address oldPositionManager = positionManager;
        address oldPermit2 = permit2;

        ASSET.forceApprove(oldPermit2, 0);
        IAllowanceTransfer(oldPermit2).approve(address(ASSET), oldPositionManager, 0, 0);
        if (!pairedIsNative) {
            IERC20(pairedToken).forceApprove(oldPermit2, 0);
            IAllowanceTransfer(oldPermit2).approve(pairedToken, oldPositionManager, 0, 0);
        }

        positionManager = _positionManager;
        permit2 = _permit2;

        ASSET.forceApprove(_permit2, type(uint256).max);
        IAllowanceTransfer(_permit2).approve(address(ASSET), _positionManager, type(uint160).max, type(uint48).max);
        if (!pairedIsNative) {
            IERC20(pairedToken).forceApprove(_permit2, type(uint256).max);
            IAllowanceTransfer(_permit2).approve(pairedToken, _positionManager, type(uint160).max, type(uint48).max);
        }

        emit ApprovalsReconfigured(oldPositionManager, oldPermit2, _positionManager, _permit2);
    }

    function setTwapOracle(address _oracle) external onlyOwner {
        twapOracle = IOracle4626(_oracle);
    }

    function setParameters(
        uint24 _fullRangeWeight,
        int24 _baseThreshold,
        int24 _limitThreshold,
        uint32 _period,
        int24 _minTickMove,
        int24 _maxTwapDeviation,
        uint32 _twapDuration
    ) external onlyOwner {
        if (_fullRangeWeight > PRECISION) revert InvalidParameters();
        if (_baseThreshold <= 0 || _baseThreshold > MAX_TICK) revert InvalidParameters();
        if (_limitThreshold <= 0 || _limitThreshold > MAX_TICK) revert InvalidParameters();
        if (tickSpacing != 0) {
            if (_baseThreshold % tickSpacing != 0) revert InvalidParameters();
            if (_limitThreshold % tickSpacing != 0) revert InvalidParameters();
        }
        if (_minTickMove < 0) revert InvalidParameters();
        if (_maxTwapDeviation < 0) revert InvalidParameters();
        if (_twapDuration == 0) revert InvalidParameters();

        fullRangeWeight = _fullRangeWeight;
        baseThreshold = _baseThreshold;
        limitThreshold = _limitThreshold;
        period = _period;
        minTickMove = _minTickMove;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;

        emit ParametersUpdated(_fullRangeWeight, _baseThreshold, _limitThreshold);
    }

    function deposit(uint256 amount0, uint256 amount1)
        external
        payable
        nonReentrant
        onlyVault
        returns (uint256 totalLiquidity)
    {
        if (amount0 == 0 && amount1 == 0 && msg.value == 0) revert ZeroAmount();

        if (amount0 > 0) {
            ASSET.safeTransferFrom(msg.sender, address(this), amount0);
        }
        if (pairedIsNative) {
            if (amount1 > 0 && msg.value != amount1) revert InvalidParameters();
        } else if (amount1 > 0) {
            IERC20(pairedToken).safeTransferFrom(msg.sender, address(this), amount1);
        }

        totalLiquidity = _estimateLiquidity(amount0, amount1 == 0 ? msg.value : amount1);
        emit Deposit(msg.sender, amount0, amount1 == 0 ? msg.value : amount1, totalLiquidity);
    }

    function withdraw(uint256 shares, uint256 totalShares)
        external
        nonReentrant
        onlyVault
        returns (uint256 amount0, uint256 amount1)
    {
        if (shares == 0) revert ZeroAmount();

        (uint256 full0, uint256 full1) = _burnLiquidityShare(fullRangePosition, shares, totalShares);
        (uint256 base0, uint256 base1) = _burnLiquidityShare(basePosition, shares, totalShares);
        (uint256 limit0, uint256 limit1) = _burnLiquidityShare(limitPosition, shares, totalShares);

        uint256 idle0 = (getBalance0() * shares) / totalShares;
        uint256 idle1 = (getBalance1() * shares) / totalShares;

        amount0 = full0 + base0 + limit0 + idle0;
        amount1 = full1 + base1 + limit1 + idle1;

        if (amount0 > 0) ASSET.safeTransfer(vault, amount0);
        _transferPaired(vault, amount1);

        emit Withdraw(msg.sender, amount0, amount1, shares);
    }

    function rebalance() external nonReentrant onlyManager {
        _requireConfigured();
        checkCanRebalance();
        _executeRebalance(false);
    }

    function seedRebalance() external nonReentrant onlyManager {
        _requireConfigured();
        if (!_positionsEmpty()) revert PositionsNotEmpty();
        _executeRebalance(true);
    }

    function checkCanRebalance() public view {
        if (block.timestamp < lastTimestamp + period) revert PeriodNotElapsed();

        int24 tick = _getCurrentTick();
        int24 tickMove = tick > lastTick ? tick - lastTick : lastTick - tick;
        if (lastTimestamp != 0 && tickMove < minTickMove) revert InsufficientTickMove();

        int24 twap = getTwap();
        int24 deviation = tick > twap ? tick - twap : twap - tick;
        if (deviation > maxTwapDeviation) revert TwapDeviationTooHigh();

        int24 maxThreshold = baseThreshold > limitThreshold ? baseThreshold : limitThreshold;
        if (tick <= MIN_TICK + maxThreshold + tickSpacing || tick >= MAX_TICK - maxThreshold - tickSpacing) {
            revert PriceTooCloseToBoundary();
        }
    }

    function getTwap() public view returns (int24) {
        if (maxTwapDeviation == 0) return _getCurrentTick();
        if (address(twapOracle) == address(0)) revert TwapOracleNotSet();
        return twapOracle.getTWAPTick(twapDuration);
    }

    function getTotalAmounts() public view returns (uint256 total0, uint256 total1) {
        (uint256 full0, uint256 full1) = _getPositionAmounts(fullRangePosition);
        (uint256 base0, uint256 base1) = _getPositionAmounts(basePosition);
        (uint256 limit0, uint256 limit1) = _getPositionAmounts(limitPosition);

        total0 = getBalance0() + full0 + base0 + limit0;
        total1 = getBalance1() + full1 + base1 + limit1;
    }

    function getBalance0() public view returns (uint256) {
        return ASSET.balanceOf(address(this)) - accruedFees0;
    }

    function getBalance1() public view returns (uint256) {
        return _pairedBalance() - accruedFees1;
    }

    function canRebalance() external view returns (bool) {
        try this.checkCanRebalance() {
            return true;
        } catch {
            return false;
        }
    }

    function getPositions()
        external
        view
        returns (PositionInfo memory fullRange, PositionInfo memory base, PositionInfo memory limit)
    {
        return (fullRangePosition, basePosition, limitPosition);
    }

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
    }

    function setManager(address _manager, bool _status) external onlyOwner {
        isManager[_manager] = _status;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    function collectFees() external {
        if (feeRecipient == address(0)) return;

        uint256 fees0 = accruedFees0;
        uint256 fees1 = accruedFees1;
        accruedFees0 = 0;
        accruedFees1 = 0;

        if (fees0 > 0) ASSET.safeTransfer(feeRecipient, fees0);
        _transferPaired(feeRecipient, fees1);

        emit FeesCollected(fees0, fees1);
    }

    function emergencyWithdraw() external onlyOwner {
        _burnAndCollect(fullRangePosition);
        _burnAndCollect(basePosition);
        _burnAndCollect(limitPosition);

        uint256 bal0 = ASSET.balanceOf(address(this));
        uint256 bal1 = _pairedBalance();

        if (bal0 > 0) ASSET.safeTransfer(vault, bal0);
        _transferPaired(vault, bal1);
    }

    function _executeRebalance(bool isSeed) internal {
        uint256 valueBefore0 = ASSET.balanceOf(address(this));

        _burnAndCollect(fullRangePosition);
        _burnAndCollect(basePosition);
        _burnAndCollect(limitPosition);

        int24 tick = _getCurrentTick();
        int24 tickFloor = _floor(tick);
        int24 tickCeil = tickFloor + tickSpacing;

        int24 _baseLower = tickFloor - baseThreshold;
        int24 _baseUpper = tickCeil + baseThreshold;
        int24 _bidLower = tickFloor - limitThreshold;
        int24 _bidUpper = tickFloor;
        int24 _askLower = tickCeil;
        int24 _askUpper = tickCeil + limitThreshold;

        uint256 balance0 = getBalance0();
        uint256 balance1 = getBalance1();
        emit Snapshot(tick, balance0, balance1);

        {
            uint128 maxFullLiquidity =
                _liquidityForAmounts(fullRangePosition.tickLower, fullRangePosition.tickUpper, balance0, balance1);
            uint128 fullLiquidity = uint128((uint256(maxFullLiquidity) * fullRangeWeight) / PRECISION);
            _mintLiquidity(fullRangePosition, fullLiquidity);
        }

        balance0 = getBalance0();
        balance1 = getBalance1();
        {
            uint128 baseLiquidity = _liquidityForAmounts(_baseLower, _baseUpper, balance0, balance1);
            basePosition.tickLower = _baseLower;
            basePosition.tickUpper = _baseUpper;
            _mintLiquidity(basePosition, baseLiquidity);
        }

        balance0 = getBalance0();
        balance1 = getBalance1();
        {
            uint128 bidLiquidity = _liquidityForAmounts(_bidLower, _bidUpper, balance0, balance1);
            uint128 askLiquidity = _liquidityForAmounts(_askLower, _askUpper, balance0, balance1);

            if (bidLiquidity > askLiquidity) {
                limitPosition.tickLower = _bidLower;
                limitPosition.tickUpper = _bidUpper;
                _mintLiquidity(limitPosition, bidLiquidity);
            } else {
                limitPosition.tickLower = _askLower;
                limitPosition.tickUpper = _askUpper;
                _mintLiquidity(limitPosition, askLiquidity);
            }
        }

        lastTimestamp = block.timestamp;
        lastTick = tick;

        uint256 valueAfter0 = ASSET.balanceOf(address(this));
        if (valueBefore0 > 0) {
            uint256 maxLoss = (valueBefore0 * maxRebalanceSlippageBps) / 10_000;
            if (valueAfter0 + maxLoss < valueBefore0) {
                revert RebalanceSlippageExceeded(valueBefore0, valueAfter0);
            }
        }

        if (isSeed) {
            emit SeedRebalanced(tick, getBalance0(), getBalance1());
        } else {
            emit Rebalanced(tick, getBalance0(), getBalance1());
        }
    }

    function _positionsEmpty() internal view returns (bool) {
        return fullRangePosition.liquidity == 0 && basePosition.liquidity == 0 && limitPosition.liquidity == 0;
    }

    function _pairedBalance() internal view returns (uint256) {
        if (pairedIsNative) return address(this).balance;
        return IERC20(pairedToken).balanceOf(address(this));
    }

    function _transferPaired(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (pairedIsNative) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "ETH_TRANSFER_FAILED");
        } else {
            IERC20(pairedToken).safeTransfer(to, amount);
        }
    }

    function _getCurrentTick() internal view returns (int24) {
        if (address(poolManager) == address(0)) return 0;
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        return tick;
    }

    function _floor(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _mintLiquidity(PositionInfo storage pos, uint128 liquidity) internal {
        if (liquidity == 0) return;
        _requireConfigured();

        uint256 tokenId = IPositionManager(positionManager).nextTokenId();

        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.MINT_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            poolKey,
            pos.tickLower,
            pos.tickUpper,
            uint256(liquidity),
            type(uint128).max,
            type(uint128).max,
            address(this),
            bytes("")
        );
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        uint256 nativeValue = pairedIsNative ? address(this).balance : 0;
        IPositionManager(positionManager).modifyLiquidities{value: nativeValue}(
            abi.encode(actions, params), block.timestamp + 1
        );

        pos.tokenId = tokenId;
        pos.liquidity = liquidity;
    }

    function _burnAndCollect(PositionInfo storage pos) internal returns (uint256 amount0, uint256 amount1) {
        if (pos.liquidity == 0) return (0, 0);
        _requireConfigured();

        uint256 balAssetBefore = ASSET.balanceOf(address(this));
        uint256 balPairedBefore = _pairedBalance();

        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.BURN_POSITION));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(pos.tokenId, uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        uint256 nativeValue = pairedIsNative ? address(this).balance : 0;
        IPositionManager(positionManager).modifyLiquidities{value: nativeValue}(
            abi.encode(actions, params), block.timestamp + 1
        );

        amount0 = ASSET.balanceOf(address(this)) - balAssetBefore;
        amount1 = _pairedBalance() - balPairedBefore;

        pos.liquidity = 0;
        pos.tokenId = 0;
    }

    function _burnLiquidityShare(PositionInfo storage pos, uint256 shares, uint256 totalShares)
        internal
        returns (uint256 amount0, uint256 amount1)
    {
        if (pos.liquidity == 0) return (0, 0);

        uint128 liquidityToBurn = uint128((uint256(pos.liquidity) * shares) / totalShares);
        if (liquidityToBurn == 0) return (0, 0);

        _requireConfigured();

        uint256 balAssetBefore = ASSET.balanceOf(address(this));
        uint256 balPairedBefore = _pairedBalance();

        bytes memory actions = new bytes(3);
        actions[0] = bytes1(uint8(Actions.DECREASE_LIQUIDITY));
        actions[1] = bytes1(uint8(Actions.CLOSE_CURRENCY));
        actions[2] = bytes1(uint8(Actions.CLOSE_CURRENCY));

        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(pos.tokenId, uint256(liquidityToBurn), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(poolKey.currency0);
        params[2] = abi.encode(poolKey.currency1);

        uint256 nativeValue = pairedIsNative ? address(this).balance : 0;
        IPositionManager(positionManager).modifyLiquidities{value: nativeValue}(
            abi.encode(actions, params), block.timestamp + 1
        );

        amount0 = ASSET.balanceOf(address(this)) - balAssetBefore;
        amount1 = _pairedBalance() - balPairedBefore;
        pos.liquidity -= liquidityToBurn;
    }

    function _getPositionAmounts(PositionInfo storage pos) internal view returns (uint256 amount0, uint256 amount1) {
        if (pos.liquidity == 0) return (0, 0);
        if (address(poolManager) == address(0)) return (0, 0);

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        (uint256 amountCurrency0, uint256 amountCurrency1) = V4LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(pos.tickLower),
            TickMath.getSqrtPriceAtTick(pos.tickUpper),
            pos.liquidity
        );

        if (assetIsCurrency0) return (amountCurrency0, amountCurrency1);
        return (amountCurrency1, amountCurrency0);
    }

    function _liquidityForAmounts(int24 tickLower, int24 tickUpper, uint256 amount0, uint256 amount1)
        internal
        view
        returns (uint128)
    {
        if (address(poolManager) == address(0)) return 0;

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        uint160 sqrtPriceAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        (uint256 amountCurrency0, uint256 amountCurrency1) =
            assetIsCurrency0 ? (amount0, amount1) : (amount1, amount0);
        return LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, amountCurrency0, amountCurrency1
        );
    }

    function _requireConfigured() internal view {
        if (address(poolManager) == address(0)) revert PoolNotConfigured();
        if (positionManager == address(0)) revert PositionManagerNotSet();
        if (permit2 == address(0)) revert Permit2NotSet();
        if (tickSpacing == 0) revert PoolNotConfigured();
    }

    function _estimateLiquidity(uint256 amount0, uint256 amount1) internal pure returns (uint256) {
        if (amount0 == 0 || amount1 == 0) return amount0 + amount1;
        return _sqrt(amount0 * amount1);
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
}
