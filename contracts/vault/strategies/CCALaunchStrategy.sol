// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {ICreatorOracle} from "../../interfaces/ICreatorOracle.sol";
import {Plan, StrategyPlanner} from "liquidity-launcher/src/libraries/StrategyPlanner.sol";
import {TokenPricing} from "liquidity-launcher/src/libraries/TokenPricing.sol";
import {BasePositionParams, FullRangeParams} from "liquidity-launcher/src/types/PositionTypes.sol";

/**
 * @title ITaxHook
 * @notice Interface for the configurable tax hook
 * @dev Hook address is chain-dependent; configure via `setTaxHook`.
 */
interface ITaxHook {
    function setTaxConfig(
        address token_,
        address counterAsset_,
        address recipient_,
        uint256 taxRate_,
        bool counterIsEth,
        bool enabled_,
        bool lock_
    ) external;
}

/**
 * @title IContinuousClearingAuctionFactory
 * @notice Interface for Uniswap's CCA Factory
 */
interface IContinuousClearingAuctionFactory {
    function initializeDistribution(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address);
}

/**
 * @title IContinuousClearingAuction
 * @notice Interface for individual CCA auctions
 */
interface IContinuousClearingAuction {
    function submitBid(uint256 maxPrice, uint128 amount, address owner, uint256 prevTickPrice, bytes calldata hookData)
        external
        payable
        returns (uint256 bidId);

    // v1.1.0 returns a Checkpoint struct; we don't need return data for our usage.
    function checkpoint() external;
    function exitBid(uint256 bidId) external;
    function claimTokens(uint256 bidId) external;
    function isGraduated() external view returns (bool);
    function sweepCurrency() external;
    function sweepUnsoldTokens() external;

    function clearingPrice() external view returns (uint256);
    function currencyRaised() external view returns (uint256);
    function totalSupply() external view returns (uint128);
    function onTokensReceived() external;
    function startBlock() external view returns (uint64);
    function endBlock() external view returns (uint64);
    function claimBlock() external view returns (uint64);
    function sweepCurrencyBlock() external view returns (uint256);
    function sweepUnsoldTokensBlock() external view returns (uint256);
}

interface IVaultTelemetry {
    function totalAssets() external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * @title CCALaunchStrategy
 * @author 0xakita.eth
 * @notice Fair launch strategy using Uniswap's Continuous Clearing Auction
 *
 * @dev USE CASES:
 *      1. Initial ■AKITA token launch - fair price discovery
 *      2. Creator token fundraise - no sniping, early participants rewarded
 *      3. Periodic fee auctions - sell accumulated fees fairly
 *
 * @dev WHY CCA?
 *      - Official Uniswap mechanism (already deployed on Base)
 *      - Fair price discovery - no timing games
 *      - Early participants get better prices naturally
 *      - No MEV/sandwich attacks
 *      - Graduates to Uniswap V4 pool automatically
 *
 * @dev CCA Factory is chain-specific; configure via `CCA_FACTORY`.
 */
contract CCALaunchStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using StrategyPlanner for *;
    using TokenPricing for uint256;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Uniswap v1.1.0 CCA factory (canonical on Base/Mainnet/Unichain/Sepolia)
    /// @dev See https://github.com/Uniswap/continuous-clearing-auction#deployments
    address public constant UNISWAP_CCA_FACTORY_V110 = 0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5;

    /// @notice Milli-basis points constant
    uint24 public constant MPS = 1e7;
    /// @notice Q96 fixed point scalar (2^96) used by Uniswap pricing
    uint256 public constant Q96 = 2 ** 96;
    /// @notice Basis points denominator.
    uint256 public constant BPS_DENOMINATOR = 10_000;
    /// @notice Auction allocation: 40%
    uint24 public constant AUCTION_SPLIT_MPS = 4_000_000;
    /// @notice Creator vesting allocation: 40%
    uint24 public constant VESTING_SPLIT_MPS = 4_000_000;
    /// @notice LP reserve allocation: 20%
    uint24 public constant LP_RESERVE_SPLIT_MPS = 2_000_000;
    /// @notice Unix epoch (1970-01-01 00:00 UTC) was a Thursday, so weekly boundaries align to Thursday 00:00 UTC.
    uint256 internal constant THURSDAY_EPOCH_SECONDS = 7 days;

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

    struct LifecycleStatus {
        uint8 phase;
        address auction;
        bool isGraduated;
        bool auctionWindowOpen;
        bool claimOpen;
        bool currencySwept;
        bool unsoldSwept;
        bool migrated;
        bool failedFinalized;
        uint64 startBlock;
        uint64 endBlock;
        uint64 claimBlock;
        uint64 migrationBlock;
        uint64 sweepBlock;
        uint256 lpReserveAmount;
        uint256 clearingPrice;
        uint256 currencyRaised;
    }

    // ================================
    // STATE
    // ================================

    /// @notice Token being auctioned (e.g., ■AKITA)
    IERC20 public immutable auctionToken;

    /// @notice Currency to raise (address(0) for ETH)
    address public currency;

    /// @notice Uniswap CCA factory used to create auctions (upgradeable by owner)
    /// @dev Stored in state so we can migrate factory versions without redeploying this strategy.
    address public ccaFactory;

    /// @notice Current active auction (if any)
    address public currentAuction;

    /// @notice Historical auctions
    address[] public pastAuctions;

    /// @notice Funds recipient (vault or treasury)
    address public fundsRecipient;

    /// @notice Unsold tokens recipient
    address public tokensRecipient;

    /// @notice Oracle to configure with V4 pool on graduation
    address public oracle;

    /// @notice V4 PoolManager (configure via `setPoolManager`)
    IPoolManager public poolManager;

    /// @notice Tax hook for the V4 pool (configure via `setTaxHook`)
    address public taxHook;
    /// @notice V4 PositionManager used to mint post-auction LP
    IPositionManager public positionManager;
    /// @notice Recipient of the migrated v4 LP position
    address public positionRecipient;
    /// @notice Operator allowed to sweep residual balances after sweepBlock
    address public operator;

    /// @notice Fee recipient for the tax hook (GaugeController)
    address public feeRecipient;

    /// @notice Tax rate in basis points (690 = 6.9%)
    uint256 public taxRateBps = 690;

    /// @notice Fee tier for V4 pool (default 3000 = 0.3%)
    uint24 public poolFeeTier = 3000;

    /// @notice Tick spacing for V4 pool
    int24 public poolTickSpacing = 60;

    /// @notice Approved addresses that can launch auctions (e.g., VaultActivationBatcher)
    mapping(address => bool) public approvedLaunchers;

    /// @notice Optional vault used only for non-blocking launch telemetry.
    address public backingVault;
    /// @notice Latest lifecycle data for the active auction.
    LaunchLifecycle public currentLaunch;
    /// @notice Lifecycle snapshots by auction address.
    mapping(address => LaunchLifecycle) public launchByAuction;
    /// @notice Current phase for API/UI/keeper state machines.
    LifecyclePhase public phase = LifecyclePhase.Idle;
    /// @notice Last sweep block target used for operator residual sweeps.
    uint64 public lastSweepBlock;

    // ================================
    // AUCTION CONFIG
    // ================================

    /// @notice Default auction duration in blocks (~1 week on Base at 2s blocks)
    uint64 public defaultDuration = 302_400; // ~7 days

    /// @notice Default claim delay after auction ends
    uint64 public defaultClaimDelay = 3600; // ~2 hours
    /// @notice Average seconds per block used to convert Thursday UTC boundaries into CCA block schedules.
    uint64 public launchBlockTimeSeconds = 2;

    /// @notice Default tick spacing in Q96 (recommended ~1% of floor price)
    /// @dev In Uniswap CCA, tickSpacing is a *price granularity* in Q96, not an ERC20/ETH amount.
    uint256 public defaultTickSpacing = (Q96 / 1000) / 100; // 1% of 0.001 ETH per token (Q96)

    /// @notice Default floor price in Q96
    /// @dev 0.001 ETH per 1 token => 1 ETH buys 1000 tokens => floorPrice = 0.001 * 2^96 = Q96/1000.
    uint256 public defaultFloorPrice = Q96 / 1000;
    /// @notice Discount applied to oracle-derived floor price for launch (8000 = 80%).
    uint16 public launchDiscountBps = 8000;
    /// @notice Tick spacing (in bps of derived floor) used for CCA launch params (100 = 1%).
    uint16 public launchTickSpacingBps = 100;
    /// @notice Maximum accepted age for oracle prices used at launch.
    uint64 public launchOracleMaxAge = 7200; // 2 hours
    /// @notice Delay from auction end to migration eligibility.
    uint64 public migrationDelayBlocks = 1;
    /// @notice Delay from claim block to operator residual sweep eligibility.
    uint64 public defaultSweepDelayBlocks = 14_400; // ~8 hours on Base @2s blocks
    /// @notice If false, `launchAuctionSimple` is disabled.
    bool public simpleLaunchEnabled;

    // ================================
    // EVENTS
    // ================================

    event AuctionCreated(
        address indexed auction, address indexed token, uint256 totalSupply, uint64 startBlock, uint64 endBlock
    );
    event LifecyclePhaseChanged(address indexed auction, LifecyclePhase phase);
    event FailedAuctionFinalized(address indexed auction, uint256 unsoldTokens);
    event Migrated(address indexed auction, uint160 sqrtPriceX96, uint256 tokenAmount, uint256 currencyAmount);

    event AuctionGraduated(address indexed auction, uint256 currencyRaised, uint256 finalPrice);
    event FundsSwept(address indexed auction, uint256 amount);
    event TokensSwept(address indexed auction, uint256 amount);
    event LaunchPricingResolved(
        address indexed auction,
        uint256 floorPriceQ96,
        uint256 tickSpacingQ96,
        uint256 creatorUsdPrice,
        uint256 ethUsdPrice
    );

    event ConfigUpdated(string param, uint256 value);
    event RecipientsUpdated(address fundsRecipient, address tokensRecipient);
    event OracleConfigured(address indexed oracle, address poolManager, address hook);
    event V4PoolConfigured(address indexed oracle, address token0, address token1);
    event TaxHookConfigured(address indexed token, address indexed recipient, uint256 taxRate);
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

    // ================================
    // ERRORS
    // ================================

    error AuctionAlreadyActive();
    error NoActiveAuction();
    error AuctionNotGraduated();
    error AuctionStillLive(uint64 endBlock, uint256 currentBlock);
    error AuctionNotFailed();
    error MigrationNotReady(uint64 migrationBlock, uint256 currentBlock);
    error MigrationConfigMissing();
    error CurrencyBalanceTooLow(uint256 needed, uint256 available);
    error LpReserveTooLow(uint256 requiredReserve, uint256 availableBalance);
    error SweepNotAllowed(uint64 sweepBlock, uint256 currentBlock);
    error NotOperator(address caller, address expected);
    error LaunchOracleNotConfigured();
    error UnsupportedLaunchCurrency(address currency);
    error LaunchOracleInvalidPrice(int256 creatorUsdPrice, int256 ethUsdPrice);
    error LaunchOracleStale(uint256 creatorTimestamp, uint256 ethTimestamp, uint64 maxAge, uint256 currentTimestamp);
    error LaunchFloorTooLow(uint256 rawFloorPriceQ96, uint256 tickSpacingQ96);
    error SimpleLaunchDisabled();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidConfig();
    error Unauthorized();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Create CCA launch strategy
     * @param _auctionToken Token to auction (e.g., ■AKITA)
     * @param _currency Currency to raise (address(0) for ETH, or USDC/WETH)
     * @param _fundsRecipient Where to send raised funds
     * @param _tokensRecipient Where to send unsold tokens
     * @param _owner Strategy owner
     */
    constructor(
        address _auctionToken,
        address _currency,
        address _fundsRecipient,
        address _tokensRecipient,
        address _owner
    ) Ownable(_owner) {
        if (_auctionToken == address(0)) revert ZeroAddress();
        if (_fundsRecipient == address(0)) revert ZeroAddress();
        if (_tokensRecipient == address(0)) revert ZeroAddress();

        auctionToken = IERC20(_auctionToken);
        currency = _currency;
        fundsRecipient = _fundsRecipient;
        tokensRecipient = _tokensRecipient;

        // Default to Uniswap's v1.1.0 factory deployment.
        ccaFactory = UNISWAP_CCA_FACTORY_V110;
        positionRecipient = _owner;
        operator = _owner;
        simpleLaunchEnabled = false;
    }

    // ================================
    // MODIFIERS
    // ================================

    /**
     * @notice Only owner or approved launchers can call
     */
    modifier onlyApprovedOrOwner() {
        if (msg.sender != owner() && !approvedLaunchers[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    // ================================
    // APPROVED LAUNCHERS
    // ================================

    /**
     * @notice Approve or revoke launcher permissions
     * @param launcher Address to approve (e.g., VaultActivationBatcher)
     * @param approved Whether to approve or revoke
     * @dev Only owner can manage approved launchers
     */
    function setApprovedLauncher(address launcher, bool approved) external onlyOwner {
        if (launcher == address(0)) revert ZeroAddress();
        approvedLaunchers[launcher] = approved;
        emit LauncherApproved(launcher, approved);
    }

    /**
     * @notice Update the Uniswap CCA factory address used for deployments.
     * @dev Allows migrating to newer Uniswap factory deployments without redeploying this strategy.
     */
    function setCcaFactory(address newFactory) external onlyOwner {
        if (newFactory == address(0)) revert ZeroAddress();
        // Basic sanity: ensure it's a contract (avoids accidental EOA config).
        if (newFactory.code.length == 0) revert InvalidConfig();

        address old = ccaFactory;
        ccaFactory = newFactory;
        emit CcaFactoryUpdated(old, newFactory);
    }

    /**
     * @notice Configure migration path (position manager + recipients + delays).
     * @dev Position manager may be set to zero during bootstrapping, but migrate() will revert until set.
     */
    function setMigrationConfig(
        address _positionManager,
        address _positionRecipient,
        address _operator,
        uint64 _migrationDelayBlocks,
        uint64 _sweepDelayBlocks
    ) external onlyOwner {
        if (_positionRecipient == address(0) || _operator == address(0)) revert ZeroAddress();
        if (_migrationDelayBlocks == 0) revert InvalidConfig();
        if (_sweepDelayBlocks == 0) revert InvalidConfig();
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

    /**
     * @notice Configure optional backing-vault telemetry source.
     * @dev This is non-blocking visibility only; no auction/migration gates depend on it.
     */
    function setBackingVault(address _backingVault) external onlyOwner {
        backingVault = _backingVault;
        emit BackingVaultUpdated(_backingVault);
    }

    /**
     * @notice Enable or disable simplified launch path.
     */
    function setSimpleLaunchEnabled(bool enabled) external onlyOwner {
        simpleLaunchEnabled = enabled;
        emit SimpleLaunchToggled(enabled);
    }

    // ================================
    // LAUNCH AUCTION
    // ================================

    /**
     * @dev Internal shared implementation for launching an auction.
     * IMPORTANT: Do NOT call the external entrypoint via `this.launchAuction(...)` from within the contract.
     * That changes `msg.sender` (breaks auth) and also trips ReentrancyGuard (both entrypoints are nonReentrant).
     */
    function _launchAuctionInternal(uint256 amount, uint256 lpReserveAmount, uint128 requiredRaise)
        internal
        returns (address auction)
    {
        _archiveIfFinished();
        if (amount == 0) revert ZeroAmount();

        // Schedule launches on the next Thursday 00:00 UTC weekly epoch.
        uint64 startBlock = _deriveScheduledStartBlock();
        uint64 endBlock = startBlock + defaultDuration;
        uint64 claimBlock = endBlock + defaultClaimDelay;
        uint64 migrationBlock = endBlock + migrationDelayBlocks;
        uint64 sweepBlock = claimBlock + defaultSweepDelayBlocks;

        // Strict launch policy: always use the strategy-owned schedule so
        // callers cannot accidentally deploy unsafe issuance curves.
        bytes memory auctionSteps = _createUniswapSafeDefaultSteps(defaultDuration);
        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice) =
            _deriveLaunchPricing();

        // Build auction parameters
        bytes memory configData = _encodeAuctionParams(
            floorPriceQ96, tickSpacingQ96, requiredRaise, startBlock, endBlock, claimBlock, auctionSteps
        );

        // Transfer tokens to this contract for auction inventory.
        auctionToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 availableBalance = auctionToken.balanceOf(address(this));
        if (availableBalance < amount + lpReserveAmount) {
            revert LpReserveTooLow(lpReserveAmount, availableBalance > amount ? availableBalance - amount : 0);
        }

        // Approve factory to pull tokens
        auctionToken.forceApprove(ccaFactory, amount);

        // Create auction via factory
        // NOTE: Uniswap's verified Base deployment expects a `bytes32 salt` parameter.
        // We derive a deterministic salt from the config to avoid collisions.
        bytes32 salt = keccak256(abi.encode(address(auctionToken), amount, configData));
        auction = IContinuousClearingAuctionFactory(ccaFactory)
            .initializeDistribution(address(auctionToken), amount, configData, salt);

        // CCA requires explicit funding + callback before bids/checkpoints become active.
        auctionToken.safeTransfer(auction, amount);
        IContinuousClearingAuction(auction).onTokensReceived();

        currentAuction = auction;
        currentLaunch = LaunchLifecycle({
            startBlock: startBlock,
            endBlock: endBlock,
            claimBlock: claimBlock,
            migrationBlock: migrationBlock,
            sweepBlock: sweepBlock,
            auctionAmount: amount,
            lpReserveAmount: lpReserveAmount,
            launchVaultTotalAssets: 0,
            launchVaultTotalSupply: 0,
            currencySwept: false,
            unsoldSwept: false,
            migrated: false,
            failedFinalized: false
        });
        _snapshotBackingTelemetry();
        _persistLifecycleSnapshot();
        lastSweepBlock = sweepBlock;
        _setPhase(block.number < startBlock ? LifecyclePhase.AuctionScheduled : LifecyclePhase.AuctionLive);

        emit AuctionCreated(auction, address(auctionToken), amount, startBlock, endBlock);
        emit LaunchPricingResolved(auction, floorPriceQ96, tickSpacingQ96, creatorUsdPrice, ethUsdPrice);
    }

    /**
     * @notice Launch a new CCA auction for token distribution
     * @param amount Amount of tokens to auction
     * @param floorPrice Deprecated. Ignored; launch floor is derived onchain from oracle data.
     * @param requiredRaise Minimum currency to raise for graduation
     * @param auctionSteps Deprecated. Ignored in favor of strategy-enforced safe schedule.
     */
    function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
        external
        onlyApprovedOrOwner
        nonReentrant
        returns (address auction)
    {
        // Keep ABI compatibility while enforcing strategy-owned schedule.
        floorPrice;
        auctionSteps;
        return _launchAuctionInternal(amount, 0, requiredRaise);
    }

    /**
     * @notice Launch auction with explicit LP reserve metadata (for 40/40/20 batch flows).
     * @dev `lpReserveAmount` is expected to remain in the strategy for post-auction migration.
     */
    function launchAuctionWithReserve(
        uint256 amount,
        uint256 lpReserveAmount,
        uint256 floorPrice,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external onlyApprovedOrOwner nonReentrant returns (address auction) {
        floorPrice;
        auctionSteps;
        return _launchAuctionInternal(amount, lpReserveAmount, requiredRaise);
    }

    /**
     * @notice Launch auction with default parameters
     * @param amount Amount of tokens to auction
     * @param requiredRaise Minimum currency to raise
     */
    function launchAuctionSimple(uint256 amount, uint128 requiredRaise)
        external
        onlyApprovedOrOwner
        nonReentrant
        returns (address auction)
    {
        if (!simpleLaunchEnabled) revert SimpleLaunchDisabled();
        // Forward to internal implementation (preserves msg.sender and nonReentrant semantics).
        // Price is still derived onchain from oracle inputs.
        return _launchAuctionInternal(amount, 0, requiredRaise);
    }

    // ================================
    // AUCTION MANAGEMENT
    // ================================

    /**
     * @notice Checkpoint the current auction
     * @dev Can be called by anyone, updates price discovery
     */
    function checkpoint() external {
        if (currentAuction == address(0)) revert NoActiveAuction();
        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        auction.checkpoint();
        _setPhase(_derivePhase(auction.isGraduated(), currentLaunch));
    }

    /**
     * @notice Sweep raised currency after auction graduates.
     * @dev This only settles auction funds. Pool migration is performed by `migrate()`.
     */
    function sweepCurrency() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();
        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        auction.checkpoint();
        if (!auction.isGraduated()) revert AuctionNotGraduated();

        uint256 raised = auction.currencyRaised();
        uint256 finalPrice = auction.clearingPrice();

        auction.sweepCurrency();
        currentLaunch.currencySwept = true;
        _persistLifecycleSnapshot();
        _setPhase(LifecyclePhase.ClaimReady);

        emit AuctionGraduated(currentAuction, raised, finalPrice);
        emit FundsSwept(currentAuction, raised);
    }

    /**
     * @notice Finalize a failed auction and unblock relaunchs.
     * @dev Sweeps unsold auction tokens and clears active auction pointers.
     */
    function finalizeFailedAuction() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();
        if (block.number <= currentLaunch.endBlock) revert AuctionStillLive(currentLaunch.endBlock, block.number);

        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        auction.checkpoint();
        if (auction.isGraduated()) revert AuctionNotFailed();

        uint256 unsold = auctionToken.balanceOf(currentAuction);
        auction.sweepUnsoldTokens();
        currentLaunch.unsoldSwept = true;
        currentLaunch.failedFinalized = true;
        _persistLifecycleSnapshot();

        address archivedAuction = currentAuction;
        launchByAuction[archivedAuction] = currentLaunch;
        pastAuctions.push(archivedAuction);
        currentAuction = address(0);
        delete currentLaunch;
        _setPhase(LifecyclePhase.LaunchFailed);

        emit TokensSwept(archivedAuction, unsold);
        emit FailedAuctionFinalized(archivedAuction, unsold);
    }

    /**
     * @notice Migrate graduated CCA liquidity into a Uniswap v4 LP position.
     */
    function migrate() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();
        if (address(positionManager) == address(0) || address(poolManager) == address(0) || taxHook == address(0)) {
            revert MigrationConfigMissing();
        }
        if (currentLaunch.migrated) revert InvalidConfig();
        if (!currentLaunch.currencySwept) revert MigrationConfigMissing();
        if (block.number < currentLaunch.migrationBlock) {
            revert MigrationNotReady(currentLaunch.migrationBlock, block.number);
        }

        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        auction.checkpoint();
        if (!auction.isGraduated()) revert AuctionNotGraduated();

        uint256 currencyAmountRaw = auction.currencyRaised();
        if (currencyAmountRaw > type(uint128).max) revert InvalidConfig();
        if (currencyAmountRaw == 0) revert ZeroAmount();

        uint256 availableCurrency = _currencyBalance(address(this));
        if (availableCurrency < currencyAmountRaw) {
            revert CurrencyBalanceTooLow(currencyAmountRaw, availableCurrency);
        }

        uint256 reserveRaw = currentLaunch.lpReserveAmount;
        if (reserveRaw == 0 || reserveRaw > type(uint128).max) revert InvalidConfig();

        uint128 reserveSupply = uint128(reserveRaw);
        uint128 currencyAmount = uint128(currencyAmountRaw);
        bool currencyIsCurrency0 = currency < address(auctionToken);

        uint256 priceX192 = auction.clearingPrice().convertToPriceX192(currencyIsCurrency0);
        uint160 sqrtPriceX96 = priceX192.convertToSqrtPriceX96();

        (uint128 fullRangeTokenAmount, uint128 fullRangeCurrencyAmount) =
            priceX192.calculateAmounts(currencyAmount, currencyIsCurrency0, reserveSupply);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(TickMath.minUsableTick(poolTickSpacing)),
            TickMath.getSqrtPriceAtTick(TickMath.maxUsableTick(poolTickSpacing)),
            currencyIsCurrency0 ? fullRangeCurrencyAmount : fullRangeTokenAmount,
            currencyIsCurrency0 ? fullRangeTokenAmount : fullRangeCurrencyAmount
        );

        PoolKey memory key = _buildPoolKey();
        _setPhase(LifecyclePhase.PoolInitializing);
        poolManager.initialize(key, sqrtPriceX96);

        Plan memory plan = StrategyPlanner.init();
        BasePositionParams memory baseParams = BasePositionParams({
            currency: currency,
            poolToken: address(auctionToken),
            poolLPFee: poolFeeTier,
            poolTickSpacing: poolTickSpacing,
            initialSqrtPriceX96: sqrtPriceX96,
            liquidity: liquidity,
            positionRecipient: positionRecipient,
            hooks: IHooks(taxHook)
        });

        plan = plan.planFullRangePosition(
            baseParams, FullRangeParams({tokenAmount: fullRangeTokenAmount, currencyAmount: fullRangeCurrencyAmount})
        );
        plan = plan.planTakePair(baseParams);
        bytes memory encodedPlan = plan.encode();

        Currency.wrap(address(auctionToken)).transfer(address(positionManager), fullRangeTokenAmount);
        if (currency == address(0)) {
            positionManager.modifyLiquidities{value: fullRangeCurrencyAmount}(encodedPlan, block.timestamp);
        } else {
            IERC20(currency).safeTransfer(address(positionManager), fullRangeCurrencyAmount);
            positionManager.modifyLiquidities(encodedPlan, block.timestamp);
        }

        currentLaunch.migrated = true;
        _persistLifecycleSnapshot();
        _configureOracleV4Pool();
        _setPhase(LifecyclePhase.PoolLive);

        emit Migrated(currentAuction, sqrtPriceX96, fullRangeTokenAmount, fullRangeCurrencyAmount);
    }

    /**
     * @notice Configure oracle with V4 pool details
     * @dev Called automatically on graduation if oracle is set
     */
    function _configureOracleV4Pool() internal {
        if (oracle == address(0) || address(poolManager) == address(0) || taxHook == address(0)) revert ZeroAddress();
        PoolKey memory poolKey = _buildPoolKey();

        // Configure oracle (Chainlink-style price uses V4 TWAP × Chainlink ETH/USD)
        bool creatorIsToken0 = Currency.unwrap(poolKey.currency0) == address(auctionToken);
        ICreatorOracle(oracle).setV4Pool(address(poolManager), poolKey, creatorIsToken0);

        emit V4PoolConfigured(oracle, Currency.unwrap(poolKey.currency0), Currency.unwrap(poolKey.currency1));
    }

    /**
     * @notice Get the calldata for configuring the tax hook
     * @dev Returns the exact bytes to call on the tax hook (for ERC-4337 batching)
     *      Token owner must call: taxHook.call(getTaxHookCalldata())
     * @return target The tax hook address to call
     * @return data The calldata for setTaxConfig
     */
    function getTaxHookCalldata() external view returns (address target, bytes memory data) {
        target = taxHook;
        data = abi.encodeWithSelector(
            ITaxHook.setTaxConfig.selector,
            address(auctionToken), // The ■TOKEN
            currency, // Counter asset (address(0) for ETH)
            feeRecipient, // GaugeController receives fees
            taxRateBps, // 690 = 6.9%
            currency == address(0), // counterIsEth
            true, // enabled
            false // don't lock (allow changes)
        );
    }

    /**
     * @notice Get all calldata needed for completion flow (sweep + migrate + configure hook)
     * @dev Returns array of calls for ERC-4337 batching:
     *      1. sweepCurrency() on this strategy
     *      2. migrate() on this strategy
     *      3. setTaxConfig() on the tax hook (requires token owner)
     * @return targets Array of addresses to call
     * @return calldatas Array of calldata for each call
     */
    function getCompleteAuctionCalldata() external view returns (address[] memory targets, bytes[] memory calldatas) {
        targets = new address[](3);
        calldatas = new bytes[](3);

        // Call 1: sweepCurrency on this strategy
        targets[0] = address(this);
        calldatas[0] = abi.encodeWithSelector(this.sweepCurrency.selector);

        // Call 2: migrate on this strategy
        targets[1] = address(this);
        calldatas[1] = abi.encodeWithSelector(this.migrate.selector);

        // Call 3: setTaxConfig on the tax hook
        targets[2] = taxHook;
        calldatas[2] = abi.encodeWithSelector(
            ITaxHook.setTaxConfig.selector,
            address(auctionToken),
            currency,
            feeRecipient,
            taxRateBps,
            currency == address(0),
            true,
            false
        );
    }

    /**
     * @notice Manually configure oracle V4 pool (if not done on graduation)
     */
    function configureOracleV4Pool() external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        if (address(poolManager) == address(0)) revert ZeroAddress();
        _configureOracleV4Pool();
    }

    /**
     * @notice Sweep unsold tokens after auction ends
     */
    function sweepUnsoldTokens() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();

        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        auction.checkpoint();
        bool graduated = auction.isGraduated();

        uint256 unsold = auctionToken.balanceOf(currentAuction);
        auction.sweepUnsoldTokens();
        currentLaunch.unsoldSwept = true;
        _persistLifecycleSnapshot();

        emit TokensSwept(currentAuction, unsold);

        // Failed auction path: clear active pointer to unblock relaunch.
        if (!graduated) {
            currentLaunch.failedFinalized = true;
            _persistLifecycleSnapshot();
            address archivedAuction = currentAuction;
            launchByAuction[archivedAuction] = currentLaunch;
            pastAuctions.push(archivedAuction);
            currentAuction = address(0);
            delete currentLaunch;
            _setPhase(LifecyclePhase.LaunchFailed);
            emit FailedAuctionFinalized(archivedAuction, unsold);
        }
    }

    /**
     * @notice Sweep residual auction token balance after sweep window.
     */
    function sweepResidualAuctionToken() external nonReentrant {
        _requireOperatorSweep();
        uint256 amount = auctionToken.balanceOf(address(this));
        if (amount == 0) return;
        auctionToken.safeTransfer(operator, amount);
        emit TokensSwept(address(this), amount);
    }

    /**
     * @notice Sweep residual raised currency balance after sweep window.
     */
    function sweepResidualCurrency() external nonReentrant {
        _requireOperatorSweep();
        uint256 amount = _currencyBalance(address(this));
        if (amount == 0) return;

        if (currency == address(0)) {
            (bool ok,) = payable(operator).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(currency).safeTransfer(operator, amount);
        }
        emit FundsSwept(address(this), amount);
    }

    // ================================
    // INTERNAL HELPERS
    // ================================

    function _archiveIfFinished() internal {
        if (currentAuction == address(0)) return;

        bool launchCleared = currentLaunch.failedFinalized || currentLaunch.migrated;
        if (!launchCleared) {
            // Graduated launches must migrate before a new launch can begin.
            // Failed launches must be finalized to clear current auction pointers.
            revert AuctionAlreadyActive();
        }

        launchByAuction[currentAuction] = currentLaunch;
        pastAuctions.push(currentAuction);
        currentAuction = address(0);
        delete currentLaunch;
        _setPhase(LifecyclePhase.Idle);
    }

    function _setPhase(LifecyclePhase newPhase) internal {
        phase = newPhase;
        emit LifecyclePhaseChanged(currentAuction, newPhase);
    }

    function _derivePhase(bool isGraduated, LaunchLifecycle memory launchData) internal view returns (LifecyclePhase) {
        if (currentAuction == address(0)) return LifecyclePhase.Idle;
        if (launchData.failedFinalized) return LifecyclePhase.LaunchFailed;
        if (launchData.migrated) return LifecyclePhase.PoolLive;
        if (launchData.currencySwept) return LifecyclePhase.ClaimReady;
        if (block.number < launchData.startBlock) return LifecyclePhase.AuctionScheduled;
        if (isGraduated) return LifecyclePhase.AuctionEndedPending;
        if (block.number <= launchData.endBlock) return LifecyclePhase.AuctionLive;
        return LifecyclePhase.AuctionEndedPending;
    }

    function _persistLifecycleSnapshot() internal {
        if (currentAuction == address(0)) return;
        launchByAuction[currentAuction] = currentLaunch;
    }

    function _snapshotBackingTelemetry() internal {
        if (backingVault == address(0)) return;
        try IVaultTelemetry(backingVault).totalAssets() returns (uint256 assets) {
            currentLaunch.launchVaultTotalAssets = assets;
        } catch {}
        try IVaultTelemetry(backingVault).totalSupply() returns (uint256 supply) {
            currentLaunch.launchVaultTotalSupply = supply;
        } catch {}
    }

    function _deriveScheduledStartBlock() internal view returns (uint64 startBlock) {
        uint256 nextThursdayStartTimestamp = _nextThursdayStartTimestamp(block.timestamp);
        uint256 deltaBlocks;
        if (nextThursdayStartTimestamp > block.timestamp) {
            deltaBlocks = Math.ceilDiv(nextThursdayStartTimestamp - block.timestamp, uint256(launchBlockTimeSeconds));
        }
        if (deltaBlocks == 0) deltaBlocks = 1;
        startBlock = uint64(block.number + deltaBlocks);
    }

    function _nextThursdayStartTimestamp(uint256 currentTimestamp) internal pure returns (uint256) {
        uint256 remainder = currentTimestamp % THURSDAY_EPOCH_SECONDS;
        if (remainder == 0) return currentTimestamp;
        return currentTimestamp + (THURSDAY_EPOCH_SECONDS - remainder);
    }

    function _deriveLaunchPricing()
        internal
        view
        returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice)
    {
        if (oracle == address(0)) revert LaunchOracleNotConfigured();
        if (currency != address(0)) revert UnsupportedLaunchCurrency(currency);

        (int256 creatorUsdSigned, uint256 creatorTimestamp) = ICreatorOracle(oracle).getCreatorPrice();
        (int256 ethUsdSigned, uint256 ethTimestamp) = ICreatorOracle(oracle).getEthPrice();

        if (creatorUsdSigned <= 0 || ethUsdSigned <= 0) {
            revert LaunchOracleInvalidPrice(creatorUsdSigned, ethUsdSigned);
        }

        if (
            creatorTimestamp == 0 || ethTimestamp == 0 || creatorTimestamp > block.timestamp
                || ethTimestamp > block.timestamp || block.timestamp - creatorTimestamp > launchOracleMaxAge
                || block.timestamp - ethTimestamp > launchOracleMaxAge
        ) {
            revert LaunchOracleStale(creatorTimestamp, ethTimestamp, launchOracleMaxAge, block.timestamp);
        }

        creatorUsdPrice = uint256(creatorUsdSigned);
        ethUsdPrice = uint256(ethUsdSigned);

        uint256 discountedCreatorUsd = Math.mulDiv(creatorUsdPrice, uint256(launchDiscountBps), BPS_DENOMINATOR);
        uint256 rawFloorPriceQ96 = Math.mulDiv(discountedCreatorUsd, Q96, ethUsdPrice);

        tickSpacingQ96 = _deriveLaunchTickSpacing(rawFloorPriceQ96);
        floorPriceQ96 = (rawFloorPriceQ96 / tickSpacingQ96) * tickSpacingQ96;
        if (floorPriceQ96 == 0) revert LaunchFloorTooLow(rawFloorPriceQ96, tickSpacingQ96);
    }

    function _deriveLaunchTickSpacing(uint256 floorPriceQ96) internal view returns (uint256 tickSpacingQ96) {
        tickSpacingQ96 = Math.mulDiv(floorPriceQ96, uint256(launchTickSpacingBps), BPS_DENOMINATOR);
        if (tickSpacingQ96 < 2) tickSpacingQ96 = 2;
    }

    function _currencyBalance(address holder) internal view returns (uint256) {
        if (currency == address(0)) return holder.balance;
        return IERC20(currency).balanceOf(holder);
    }

    function _requireOperatorSweep() internal view {
        if (msg.sender != operator) revert NotOperator(msg.sender, operator);
        if (block.number < lastSweepBlock) revert SweepNotAllowed(lastSweepBlock, block.number);
    }

    function _buildPoolKey() internal view returns (PoolKey memory key) {
        // ETH (address(0)) naturally sorts first as token0 in V4.
        bool currencyIsToken0 = currency < address(auctionToken);
        key = PoolKey({
            currency0: Currency.wrap(currencyIsToken0 ? currency : address(auctionToken)),
            currency1: Currency.wrap(currencyIsToken0 ? address(auctionToken) : currency),
            fee: poolFeeTier,
            tickSpacing: poolTickSpacing,
            hooks: IHooks(taxHook)
        });
    }

    /**
     * @notice Encode auction parameters for CCA factory
     */
    function _encodeAuctionParams(
        uint256 floorPrice,
        uint256 tickSpacingQ96,
        uint128 requiredRaise,
        uint64 startBlock,
        uint64 endBlock,
        uint64 claimBlock,
        bytes memory auctionSteps
    ) internal view returns (bytes memory) {
        // AuctionParameters struct encoding
        return abi.encode(
            currency, // currency (address(0) for ETH)
            tokensRecipient, // tokensRecipient
            fundsRecipient, // fundsRecipient
            startBlock, // startBlock
            endBlock, // endBlock
            claimBlock, // claimBlock
            tickSpacingQ96, // tickSpacing
            address(0), // validationHook (none for now)
            floorPrice, // floorPrice
            requiredRaise, // requiredCurrencyRaised
            auctionSteps // auctionStepsData
        );
    }

    /**
     * @notice Create linear auction steps (sell evenly over time)
     * @param duration Total duration in blocks
     */
    function _createLinearSteps(uint64 duration) internal pure returns (bytes memory) {
        // Single step: sell 100% of tokens evenly over duration
        // mps = MPS (100% = 10,000,000 mps over entire duration)
        uint24 mpsPerBlock = uint24(MPS / duration);

        // Pack: HIGH 24 bits = mps, LOW 40 bits = blockDelta
        // StepLib.parse() expects: mps = uint24(bytes3(data)), blockDelta = uint40(uint64(data))
        bytes8 packed = bytes8((uint64(mpsPerBlock) << 40) | uint64(duration));

        return abi.encodePacked(packed);
    }

    /**
     * @notice Create accelerating auction steps (sell more towards end)
     * @dev Rewards early participants more
     */
    function _createAcceleratingSteps(uint64 duration) internal pure returns (bytes memory) {
        // Three phases: 20% in first half, 30% in third quarter, 50% in last quarter
        uint64 phase1Duration = duration / 2;
        uint64 phase2Duration = duration / 4;
        uint64 phase3Duration = duration - phase1Duration - phase2Duration;

        // Use uint256 for intermediate calculations to avoid overflow
        uint256 mpsValue = uint256(MPS);

        // Pack format: HIGH 24 bits = mps, LOW 40 bits = blockDelta
        // StepLib.parse() expects: mps = uint24(bytes3(data)), blockDelta = uint40(uint64(data))

        // Phase 1: 20% over 50% of time = slow
        uint24 mps1 = uint24((mpsValue * 2000) / 10000 / phase1Duration); // 20% / phase1
        bytes8 packed1 = bytes8((uint64(mps1) << 40) | uint64(phase1Duration));

        // Phase 2: 30% over 25% of time = medium
        uint24 mps2 = uint24((mpsValue * 3000) / 10000 / phase2Duration);
        bytes8 packed2 = bytes8((uint64(mps2) << 40) | uint64(phase2Duration));

        // Phase 3: 50% over 25% of time = fast
        uint24 mps3 = uint24((mpsValue * 5000) / 10000 / phase3Duration);
        bytes8 packed3 = bytes8((uint64(mps3) << 40) | uint64(phase3Duration));

        return abi.encodePacked(packed1, packed2, packed3);
    }

    /**
     * @notice Create a Uniswap-safe default schedule.
     * @dev Uniswap recommends the final block sells a significant amount of tokens because
     *      the final clearing price is used to initialize downstream liquidity.
     *      We allocate 20% over the first half, 45% over the middle, and the remainder in the final block.
     */
    function _createUniswapSafeDefaultSteps(uint64 duration) internal pure returns (bytes memory) {
        // For very short auctions, fall back to linear to avoid zero-length phases.
        if (duration <= 2) return _createLinearSteps(duration);

        // Reserve the final block for a large issuance.
        uint64 lastBlock = 1;
        uint64 phase1Blocks = duration / 2; // ~50%
        uint64 phase2Blocks = duration - phase1Blocks - lastBlock;
        if (phase1Blocks == 0 || phase2Blocks == 0) return _createLinearSteps(duration);

        // Compute per-block issuance (mps) for phase 1 and 2 using floor division.
        // Then allocate the exact remainder to the final block so total issuance = 100%.
        uint24 phase1Total = 2_000_000; // 20% of 1e7
        uint24 phase2Total = 4_500_000; // 45% of 1e7

        uint24 mps1 = uint24(uint256(phase1Total) / uint256(phase1Blocks));
        uint24 mps2 = uint24(uint256(phase2Total) / uint256(phase2Blocks));

        uint256 issued1 = uint256(mps1) * uint256(phase1Blocks);
        uint256 issued2 = uint256(mps2) * uint256(phase2Blocks);
        uint24 mps3 = uint24(MPS - uint24(issued1 + issued2)); // remainder (includes rounding slack)

        // Pack format: HIGH 24 bits = mps, LOW 40 bits = blockDelta
        // StepLib.parse() expects: mps = uint24(bytes3(data)), blockDelta = uint40(uint64(data))
        bytes8 packed1 = bytes8((uint64(mps1) << 40) | uint64(phase1Blocks));
        bytes8 packed2 = bytes8((uint64(mps2) << 40) | uint64(phase2Blocks));
        bytes8 packed3 = bytes8((uint64(mps3) << 40) | uint64(lastBlock));

        return abi.encodePacked(packed1, packed2, packed3);
    }

    // ================================
    // ADMIN
    // ================================

    /**
     * @notice Update default auction duration
     */
    function setDefaultDuration(uint64 _duration) external onlyOwner {
        if (_duration == 0) revert InvalidConfig();
        defaultDuration = _duration;
        emit ConfigUpdated("duration", _duration);
    }

    /**
     * @notice Update default claim delay
     */
    function setDefaultClaimDelay(uint64 _delay) external onlyOwner {
        defaultClaimDelay = _delay;
        emit ConfigUpdated("claimDelay", _delay);
    }

    /**
     * @notice Update the block-time estimate used for Thursday UTC launch alignment.
     */
    function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external onlyOwner {
        if (_secondsPerBlock == 0) revert InvalidConfig();
        launchBlockTimeSeconds = _secondsPerBlock;
        emit ConfigUpdated("launchBlockTimeSeconds", _secondsPerBlock);
    }

    /**
     * @notice Update migration delay after auction end.
     */
    function setMigrationDelayBlocks(uint64 _delay) external onlyOwner {
        if (_delay == 0) revert InvalidConfig();
        migrationDelayBlocks = _delay;
        emit ConfigUpdated("migrationDelayBlocks", _delay);
    }

    /**
     * @notice Update default post-claim sweep delay.
     */
    function setDefaultSweepDelayBlocks(uint64 _delay) external onlyOwner {
        if (_delay == 0) revert InvalidConfig();
        defaultSweepDelayBlocks = _delay;
        emit ConfigUpdated("sweepDelayBlocks", _delay);
    }

    /**
     * @notice Update default tick spacing
     */
    function setDefaultTickSpacing(uint256 _spacing) external onlyOwner {
        if (_spacing == 0) revert InvalidConfig();
        defaultTickSpacing = _spacing;
        emit ConfigUpdated("tickSpacing", _spacing);
    }

    /**
     * @notice Update default floor price
     * @dev Legacy fallback value retained for backwards compatibility. Launch flow derives floor onchain.
     */
    function setDefaultFloorPrice(uint256 _price) external onlyOwner {
        if (_price == 0) revert InvalidConfig();
        defaultFloorPrice = _price;
        emit ConfigUpdated("floorPrice", _price);
    }

    /**
     * @notice Update launch floor discount applied to oracle price.
     * @param _discountBps Discount in bps (10000 = 100%, 8000 = 80%).
     */
    function setLaunchDiscountBps(uint16 _discountBps) external onlyOwner {
        if (_discountBps == 0 || _discountBps > BPS_DENOMINATOR) revert InvalidConfig();
        launchDiscountBps = _discountBps;
        emit ConfigUpdated("launchDiscountBps", _discountBps);
    }

    /**
     * @notice Update launch tick spacing (as bps of derived launch floor).
     * @param _tickSpacingBps Tick spacing bps (100 = 1%).
     */
    function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external onlyOwner {
        if (_tickSpacingBps == 0 || _tickSpacingBps > BPS_DENOMINATOR) revert InvalidConfig();
        launchTickSpacingBps = _tickSpacingBps;
        emit ConfigUpdated("launchTickSpacingBps", _tickSpacingBps);
    }

    /**
     * @notice Update maximum accepted oracle staleness for launch pricing.
     */
    function setLaunchOracleMaxAge(uint64 _maxAge) external onlyOwner {
        if (_maxAge == 0) revert InvalidConfig();
        launchOracleMaxAge = _maxAge;
        emit ConfigUpdated("launchOracleMaxAge", _maxAge);
    }

    /**
     * @notice Update fund recipients
     */
    function setRecipients(address _fundsRecipient, address _tokensRecipient) external onlyOwner {
        if (_fundsRecipient == address(0)) revert ZeroAddress();
        if (_tokensRecipient == address(0)) revert ZeroAddress();
        fundsRecipient = _fundsRecipient;
        tokensRecipient = _tokensRecipient;
        emit RecipientsUpdated(_fundsRecipient, _tokensRecipient);
    }

    /**
     * @notice Configure oracle for V4 pool setup on graduation
     * @param _oracle Oracle address to configure
     * @param _poolManager V4 PoolManager address
     * @param _taxHook Tax hook address for the pool
     * @param _feeRecipient GaugeController to receive 6.9% trade fees
     */
    function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient)
        external
        onlyOwner
    {
        oracle = _oracle;
        poolManager = IPoolManager(_poolManager);
        taxHook = _taxHook;
        feeRecipient = _feeRecipient;
        emit OracleConfigured(_oracle, _poolManager, _taxHook);
    }

    /**
     * @notice Update fee recipient (GaugeController)
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Update tax rate
     * @param _taxRateBps Tax rate in basis points (690 = 6.9%)
     */
    function setTaxRate(uint256 _taxRateBps) external onlyOwner {
        if (_taxRateBps > 1000) revert("Tax too high"); // Max 10%
        taxRateBps = _taxRateBps;
    }

    /**
     * @notice Update V4 pool fee tier
     * @param _feeTier Fee in hundredths of bips (3000 = 0.3%)
     */
    function setPoolFeeTier(uint24 _feeTier) external onlyOwner {
        if (_feeTier > LPFeeLibrary.MAX_LP_FEE) revert InvalidConfig();
        poolFeeTier = _feeTier;
        emit ConfigUpdated("poolFeeTier", _feeTier);
    }

    /**
     * @notice Update V4 pool tick spacing
     * @param _tickSpacing Tick spacing for the pool
     */
    function setPoolTickSpacing(int24 _tickSpacing) external onlyOwner {
        if (_tickSpacing > TickMath.MAX_TICK_SPACING || _tickSpacing < TickMath.MIN_TICK_SPACING) {
            revert InvalidConfig();
        }
        poolTickSpacing = _tickSpacing;
        emit ConfigUpdated("poolTickSpacing", uint256(int256(_tickSpacing)));
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Preview onchain launch pricing derived from oracle data.
     * @dev Reverts when oracle data is missing/stale/invalid.
     */
    function previewLaunchPricing()
        external
        view
        returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice)
    {
        return _deriveLaunchPricing();
    }

    /**
     * @notice Get current auction status
     */
    function getAuctionStatus()
        external
        view
        returns (address auction, bool isActive, bool isGraduated, uint256 clearingPrice, uint256 currencyRaised)
    {
        auction = currentAuction;
        if (auction == address(0)) {
            return (address(0), false, false, 0, 0);
        }

        IContinuousClearingAuction cca = IContinuousClearingAuction(auction);
        isGraduated = cca.isGraduated();
        bool auctionWindowOpen = block.number >= currentLaunch.startBlock && block.number <= currentLaunch.endBlock;
        isActive = auctionWindowOpen && !currentLaunch.migrated && !currentLaunch.failedFinalized;
        clearingPrice = cca.clearingPrice();
        currencyRaised = cca.currencyRaised();
    }

    /**
     * @notice Returns richer lifecycle status for keepers and frontend state machines.
     */
    function getLifecycleStatus() external view returns (LifecycleStatus memory status) {
        status.phase = uint8(phase);
        status.auction = currentAuction;
        if (status.auction == address(0)) {
            return status;
        }

        LaunchLifecycle memory launchData = currentLaunch;
        IContinuousClearingAuction cca = IContinuousClearingAuction(status.auction);
        status.isGraduated = cca.isGraduated();
        status.auctionWindowOpen = block.number >= launchData.startBlock && block.number <= launchData.endBlock;
        status.claimOpen = block.number >= launchData.claimBlock;
        status.currencySwept = launchData.currencySwept;
        status.unsoldSwept = launchData.unsoldSwept;
        status.migrated = launchData.migrated;
        status.failedFinalized = launchData.failedFinalized;
        status.startBlock = launchData.startBlock;
        status.endBlock = launchData.endBlock;
        status.claimBlock = launchData.claimBlock;
        status.migrationBlock = launchData.migrationBlock;
        status.sweepBlock = launchData.sweepBlock;
        status.lpReserveAmount = launchData.lpReserveAmount;
        status.clearingPrice = cca.clearingPrice();
        status.currencyRaised = cca.currencyRaised();
        status.phase = uint8(_derivePhase(status.isGraduated, launchData));
    }

    /**
     * @notice Non-blocking backing telemetry for share-economics visibility.
     */
    function getBackingTelemetry()
        external
        view
        returns (
            address vault,
            uint256 launchTotalAssets,
            uint256 launchTotalSupply,
            uint256 currentTotalAssets,
            uint256 currentTotalSupply,
            int256 assetsDelta,
            int256 supplyDelta
        )
    {
        vault = backingVault;
        launchTotalAssets = currentLaunch.launchVaultTotalAssets;
        launchTotalSupply = currentLaunch.launchVaultTotalSupply;

        if (vault != address(0)) {
            try IVaultTelemetry(vault).totalAssets() returns (uint256 assets) {
                currentTotalAssets = assets;
            } catch {}
            try IVaultTelemetry(vault).totalSupply() returns (uint256 supply) {
                currentTotalSupply = supply;
            } catch {}
        }

        if (currentTotalAssets <= uint256(type(int256).max) && launchTotalAssets <= uint256(type(int256).max)) {
            assetsDelta = int256(currentTotalAssets) - int256(launchTotalAssets);
        }
        if (currentTotalSupply <= uint256(type(int256).max) && launchTotalSupply <= uint256(type(int256).max)) {
            supplyDelta = int256(currentTotalSupply) - int256(launchTotalSupply);
        }
    }

    /**
     * @notice Get all past auctions
     */
    function getPastAuctions() external view returns (address[] memory) {
        return pastAuctions;
    }

    /**
     * @notice Get auction count
     */
    function auctionCount() external view returns (uint256) {
        uint256 count = pastAuctions.length;
        if (currentAuction != address(0)) count++;
        return count;
    }

    // ================================
    // EMERGENCY
    // ================================

    /**
     * @notice Emergency withdraw tokens stuck in strategy
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Emergency withdraw ETH
     */
    function emergencyWithdrawETH(address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: address(this).balance}("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {}
}
