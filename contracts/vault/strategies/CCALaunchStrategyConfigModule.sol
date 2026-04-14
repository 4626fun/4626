// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

contract CCALaunchStrategyConfigModule is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    bytes32 private constant CONFIG_DURATION = "duration";
    bytes32 private constant CONFIG_CLAIM_DELAY = "claimDelay";
    bytes32 private constant CONFIG_BLOCK_TIME = "launchBlockTimeSeconds";
    bytes32 private constant CONFIG_MIGRATION_DELAY = "migrationDelayBlocks";
    bytes32 private constant CONFIG_SWEEP_DELAY = "sweepDelayBlocks";
    bytes32 private constant CONFIG_TICK_SPACING = "tickSpacing";
    bytes32 private constant CONFIG_FLOOR_PRICE = "floorPrice";
    bytes32 private constant CONFIG_LAUNCH_DISCOUNT = "launchDiscountBps";
    bytes32 private constant CONFIG_LAUNCH_TICK_SPACING = "launchTickSpacingBps";
    bytes32 private constant CONFIG_ORACLE_MAX_AGE = "launchOracleMaxAge";
    bytes32 private constant CONFIG_POOL_FEE = "poolFeeTier";
    bytes32 private constant CONFIG_POOL_TICK_SPACING = "poolTickSpacing";

    enum LifecyclePhase {
        Idle,
        AuctionLive,
        AuctionEndedPending,
        ClaimReady,
        PoolInitializing,
        PoolLive,
        LaunchFailed,
        AuctionScheduled
    }

    struct LaunchLifecycle {
        uint64 startBlock;
        uint64 endBlock;
        uint64 claimBlock;
        uint64 migrationBlock;
        uint64 sweepBlock;
        uint256 auctionAmount;
        uint256 lpReserveAmount;
        uint256 launchVaultTotalAssets;
        uint256 launchVaultTotalSupply;
        bool currencySwept;
        bool unsoldSwept;
        bool migrated;
        bool failedFinalized;
    }

    IERC20 public immutable auctionToken;
    address public currency;
    address public ccaFactory;
    address public currentAuction;
    address[] public pastAuctions;
    address public fundsRecipient;
    address public tokensRecipient;
    address public oracle;
    IPoolManager public poolManager;
    address public taxHook;
    IPositionManager public positionManager;
    address public positionRecipient;
    address public operator;
    address public feeRecipient;
    uint256 public taxRateBps;
    uint24 public poolFeeTier;
    int24 public poolTickSpacing;
    mapping(address => bool) public approvedLaunchers;
    address public backingVault;
    LaunchLifecycle public currentLaunch;
    mapping(address => LaunchLifecycle) public launchByAuction;
    LifecyclePhase public phase;
    uint64 public lastSweepBlock;
    uint64 public defaultDuration;
    uint64 public defaultClaimDelay;
    uint64 public launchBlockTimeSeconds;
    uint256 public defaultTickSpacing;
    uint256 public defaultFloorPrice;
    uint16 public launchDiscountBps;
    uint16 public launchTickSpacingBps;
    uint64 public launchOracleMaxAge;
    uint64 public migrationDelayBlocks;
    uint64 public defaultSweepDelayBlocks;
    bool public simpleLaunchEnabled;

    address private immutable _self;

    event ConfigUpdated(bytes32 param, uint256 value);
    event RecipientsUpdated(address fundsRecipient, address tokensRecipient);
    event OracleConfigured(address indexed oracle, address poolManager, address hook);
    event LauncherApproved(address indexed launcher, bool approved);
    event CcaFactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event MigrationConfigUpdated(
        address indexed positionManager,
        address indexed positionRecipient,
        address indexed operator,
        uint64 migrationDelayBlocks,
        uint64 sweepDelayBlocks
    );
    event BackingVaultUpdated(address indexed backingVault);
    event SimpleLaunchToggled(bool enabled);
    event FundsSwept(address indexed auction, uint256 amount);
    event TokensSwept(address indexed auction, uint256 amount);

    error ZeroAddress();
    error InvalidConfig();
    error EthTransferFailed();
    error SweepNotAllowed(uint64 sweepBlock, uint256 currentBlock);
    error NotOperator(address caller, address expected);
    error OnlyDelegateCall();

    constructor(
        address _auctionToken,
        address _currency,
        address _fundsRecipient,
        address _tokensRecipient,
        address _owner
    ) Ownable(_owner) {
        auctionToken = IERC20(_auctionToken);
        currency = _currency;
        fundsRecipient = _fundsRecipient;
        tokensRecipient = _tokensRecipient;
        _self = address(this);
    }

    modifier onlyDelegateCall() {
        if (address(this) == _self) revert OnlyDelegateCall();
        _;
    }

    function setApprovedLauncher(address launcher, bool approved) external onlyDelegateCall onlyOwner {
        if (launcher == address(0)) revert ZeroAddress();
        approvedLaunchers[launcher] = approved;
        emit LauncherApproved(launcher, approved);
    }

    function setCcaFactory(address newFactory) external onlyDelegateCall onlyOwner {
        if (newFactory == address(0)) revert ZeroAddress();
        if (newFactory.code.length == 0) revert InvalidConfig();
        address old = ccaFactory;
        ccaFactory = newFactory;
        emit CcaFactoryUpdated(old, newFactory);
    }

    function setMigrationConfig(
        address _positionManager,
        address _positionRecipient,
        address _operator,
        uint64 _migrationDelayBlocks,
        uint64 _sweepDelayBlocks
    ) external onlyDelegateCall onlyOwner {
        if (_positionRecipient == address(0) || _operator == address(0)) revert ZeroAddress();
        if (_migrationDelayBlocks == 0 || _sweepDelayBlocks == 0) revert InvalidConfig();
        if (_positionManager != address(0) && _positionManager.code.length == 0) revert InvalidConfig();

        positionManager = IPositionManager(_positionManager);
        positionRecipient = _positionRecipient;
        operator = _operator;
        migrationDelayBlocks = _migrationDelayBlocks;
        defaultSweepDelayBlocks = _sweepDelayBlocks;

        emit MigrationConfigUpdated(
            _positionManager, _positionRecipient, _operator, _migrationDelayBlocks, _sweepDelayBlocks
        );
    }

    function setBackingVault(address _backingVault) external onlyDelegateCall onlyOwner {
        backingVault = _backingVault;
        emit BackingVaultUpdated(_backingVault);
    }

    function setSimpleLaunchEnabled(bool enabled) external onlyDelegateCall onlyOwner {
        simpleLaunchEnabled = enabled;
        emit SimpleLaunchToggled(enabled);
    }

    function sweepResidualAuctionToken() external onlyDelegateCall {
        if (msg.sender != operator) revert NotOperator(msg.sender, operator);
        if (block.number < lastSweepBlock) revert SweepNotAllowed(lastSweepBlock, block.number);

        uint256 amount = auctionToken.balanceOf(address(this));
        if (amount == 0) return;
        auctionToken.safeTransfer(operator, amount);
        emit TokensSwept(address(this), amount);
    }

    function sweepResidualCurrency() external onlyDelegateCall {
        if (msg.sender != operator) revert NotOperator(msg.sender, operator);
        if (block.number < lastSweepBlock) revert SweepNotAllowed(lastSweepBlock, block.number);

        if (currency == address(0)) {
            uint256 nativeAmount = address(this).balance;
            if (nativeAmount == 0) return;
            (bool ok,) = payable(operator).call{value: nativeAmount}("");
            if (!ok) revert EthTransferFailed();
            emit FundsSwept(address(this), nativeAmount);
            return;
        }

        uint256 tokenAmount = IERC20(currency).balanceOf(address(this));
        if (tokenAmount == 0) return;
        IERC20(currency).safeTransfer(operator, tokenAmount);
        emit FundsSwept(address(this), tokenAmount);
    }

    function setDefaultDuration(uint64 _duration) external onlyDelegateCall onlyOwner {
        if (_duration == 0) revert InvalidConfig();
        defaultDuration = _duration;
        emit ConfigUpdated(CONFIG_DURATION, _duration);
    }

    function setDefaultClaimDelay(uint64 _delay) external onlyDelegateCall onlyOwner {
        defaultClaimDelay = _delay;
        emit ConfigUpdated(CONFIG_CLAIM_DELAY, _delay);
    }

    function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external onlyDelegateCall onlyOwner {
        if (_secondsPerBlock == 0) revert InvalidConfig();
        launchBlockTimeSeconds = _secondsPerBlock;
        emit ConfigUpdated(CONFIG_BLOCK_TIME, _secondsPerBlock);
    }

    function setMigrationDelayBlocks(uint64 _delay) external onlyDelegateCall onlyOwner {
        if (_delay == 0) revert InvalidConfig();
        migrationDelayBlocks = _delay;
        emit ConfigUpdated(CONFIG_MIGRATION_DELAY, _delay);
    }

    function setDefaultSweepDelayBlocks(uint64 _delay) external onlyDelegateCall onlyOwner {
        if (_delay == 0) revert InvalidConfig();
        defaultSweepDelayBlocks = _delay;
        emit ConfigUpdated(CONFIG_SWEEP_DELAY, _delay);
    }

    function setDefaultTickSpacing(uint256 _spacing) external onlyDelegateCall onlyOwner {
        if (_spacing == 0) revert InvalidConfig();
        defaultTickSpacing = _spacing;
        emit ConfigUpdated(CONFIG_TICK_SPACING, _spacing);
    }

    function setDefaultFloorPrice(uint256 _price) external onlyDelegateCall onlyOwner {
        if (_price == 0) revert InvalidConfig();
        defaultFloorPrice = _price;
        emit ConfigUpdated(CONFIG_FLOOR_PRICE, _price);
    }

    function setLaunchDiscountBps(uint16 _discountBps) external onlyDelegateCall onlyOwner {
        if (_discountBps == 0 || _discountBps > BPS_DENOMINATOR) revert InvalidConfig();
        launchDiscountBps = _discountBps;
        emit ConfigUpdated(CONFIG_LAUNCH_DISCOUNT, _discountBps);
    }

    function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external onlyDelegateCall onlyOwner {
        if (_tickSpacingBps == 0 || _tickSpacingBps > BPS_DENOMINATOR) revert InvalidConfig();
        launchTickSpacingBps = _tickSpacingBps;
        emit ConfigUpdated(CONFIG_LAUNCH_TICK_SPACING, _tickSpacingBps);
    }

    function setLaunchOracleMaxAge(uint64 _maxAge) external onlyDelegateCall onlyOwner {
        if (_maxAge == 0) revert InvalidConfig();
        launchOracleMaxAge = _maxAge;
        emit ConfigUpdated(CONFIG_ORACLE_MAX_AGE, _maxAge);
    }

    function setRecipients(address _fundsRecipient, address _tokensRecipient) external onlyDelegateCall onlyOwner {
        if (_fundsRecipient == address(0) || _tokensRecipient == address(0)) revert ZeroAddress();
        fundsRecipient = _fundsRecipient;
        tokensRecipient = _tokensRecipient;
        emit RecipientsUpdated(_fundsRecipient, _tokensRecipient);
    }

    function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient)
        external
        onlyDelegateCall
        onlyOwner
    {
        oracle = _oracle;
        poolManager = IPoolManager(_poolManager);
        taxHook = _taxHook;
        feeRecipient = _feeRecipient;
        emit OracleConfigured(_oracle, _poolManager, _taxHook);
    }

    function setFeeRecipient(address _feeRecipient) external onlyDelegateCall onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
    }

    function setTaxRate(uint256 _taxRateBps) external onlyDelegateCall onlyOwner {
        if (_taxRateBps > 1000) revert InvalidConfig();
        taxRateBps = _taxRateBps;
    }

    function setPoolFeeTier(uint24 _feeTier) external onlyDelegateCall onlyOwner {
        if (_feeTier > LPFeeLibrary.MAX_LP_FEE) revert InvalidConfig();
        poolFeeTier = _feeTier;
        emit ConfigUpdated(CONFIG_POOL_FEE, _feeTier);
    }

    function setPoolTickSpacing(int24 _tickSpacing) external onlyDelegateCall onlyOwner {
        if (_tickSpacing > TickMath.MAX_TICK_SPACING || _tickSpacing < TickMath.MIN_TICK_SPACING) {
            revert InvalidConfig();
        }
        poolTickSpacing = _tickSpacing;
        emit ConfigUpdated(CONFIG_POOL_TICK_SPACING, uint256(int256(_tickSpacing)));
    }

    function emergencyWithdraw(address token, uint256 amount, address to) external onlyDelegateCall onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    function emergencyWithdrawETH(address payable to) external onlyDelegateCall onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: address(this).balance}("");
        if (!ok) revert EthTransferFailed();
    }
}
