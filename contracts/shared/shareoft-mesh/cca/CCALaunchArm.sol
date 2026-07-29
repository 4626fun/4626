// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

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
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";
import {CCALaunchArmConfigModule} from "@4626/shared/shareoft-mesh/cca/CCALaunchArmConfigModule.sol";
import {CCALaunchArmEncodingHelper} from "@4626/shared/shareoft-mesh/cca/CCALaunchArmEncodingHelper.sol";
import {TokenPricing} from "liquidity-launcher/src/libraries/TokenPricing.sol";

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
 * @notice Interface for Uniswap's CCA Factory (v1.x entrypoint)
 */
interface IContinuousClearingAuctionFactory {
    function initializeDistribution(address token, uint256 amount, bytes calldata configData, bytes32 salt)
        external
        returns (address);
}

/**
 * @title IContinuousClearingAuctionFactoryV2
 * @notice Interface for Uniswap's CCA Factory v2.x (`create` replaces `initializeDistribution`).
 * @dev AuctionParameters encoding is unchanged between v1.1.0 and v2.1.0, but v2.x restricts
 *      sweepCurrency/sweepUnsoldTokens to the configured recipients — launch recipients must
 *      therefore remain this strategy (the default batcher wiring).
 */
interface IContinuousClearingAuctionFactoryV2 {
    function create(address token, uint256 amount, bytes calldata configData, bytes32 salt)
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
 * @title CCALaunchArm
 * @author 0xakita.eth
 * @notice Fair launch strategy using Uniswap's Continuous Clearing Auction
 *
 * @dev USE CASES:
 *      1. Initial ■AKITA token launch - fair price discovery
 *      2. Lane token fundraise - no sniping, early participants rewarded
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
 *
 * @dev Used for creator lane launches primarily. Shared deploy make it adaptable for agent, creator, and future ecosystems.
 *      Vault share allocation is enforced by DeploymentBatcher.
 */
contract CCALaunchArm is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using TokenPricing for uint256;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Uniswap v1.1.0 CCA factory (canonical on Base/Mainnet/Unichain/Sepolia)
    /// @dev See https://github.com/Uniswap/continuous-clearing-auction#deployments
    address public constant UNISWAP_CCA_FACTORY_V110 = 0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5;

    /// @notice Uniswap v2.1.0 CCA factory (recommended production version; includes Arbitrum/Orbit fix)
    address public constant UNISWAP_CCA_FACTORY_V210 = 0x000000001F26a0044BaA66024e7b6599c61963F8;

    /// @dev ArbSys precompile (address(100)) — present on Arbitrum/Orbit chains (Arbitrum One, Robinhood Chain).
    ///      Uniswap CCA v2.x schedules auctions against `arbBlockNumber()` on these chains via
    ///      BlockNumberish, so this strategy must gate its lifecycle in the same block domain.
    address private constant ARB_SYS_ADDRESS = address(100);
    /// @dev Function selector for ArbSys.arbBlockNumber() (nitro-precompile-interfaces ArbSys.sol).
    bytes4 private constant ARB_BLOCK_NUMBER_SELECTOR = 0xa3b1b31d;

    /// @notice Milli-basis points constant
    uint24 public constant MPS = 1e7;
    /// @notice Q96 fixed point scalar (2^96) used by Uniswap pricing
    uint256 public constant Q96 = 2 ** 96;
    /// @notice Basis points denominator.
    uint256 public constant BPS_DENOMINATOR = 10_000;
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
        bool lpManagerSeeded;
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
    /// @notice Share-mesh LP manager wired post-auction for three-position liquidity.
    address public lpManager;
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
    /// @dev FIX: AUDIT-2026-07-01-L06 — fee recipient is locked after the first launch.
    bool public feeRecipientLocked;
    /// @notice When true, `ccaFactory` is a Uniswap CCA v2.x deployment called via `create`.
    /// @dev Storage append only — must stay slot-aligned with CCALaunchArmConfigModule.
    bool public ccaFactoryV2;
    /// @notice Blocks per second for Thursday-epoch scheduling on sub-second chains (0 = use seconds-per-block).
    /// @dev E.g. 4 on Arbitrum (~250ms), 10 on Robinhood Chain (~100ms). Storage append only.
    uint64 public launchBlocksPerSecond;
    address private immutable _configModule;
    /// @dev Whether this chain exposes the ArbSys precompile (detected once at construction).
    bool private immutable _useArbSys;
    CCALaunchArmEncodingHelper private immutable _encodingHelper;

    // ================================
    // EVENTS
    // ================================

    event AuctionCreated(
        address indexed auction, address indexed token, uint256 totalSupply, uint64 startBlock, uint64 endBlock
    );
    event LifecyclePhaseChanged(address indexed auction, LifecyclePhase phase);
    event FailedAuctionFinalized(address indexed auction, uint256 unsoldTokens);
    event Migrated(address indexed auction, uint160 sqrtPriceX96, uint256 tokenAmount, uint256 currencyAmount);
    /// @notice Emitted when migrate uses a non-primary fee/tick after primary pool grief (H-04).
    event MigrationPoolKeyRotated(uint24 fee, int24 tickSpacing, uint160 sqrtPriceX96);

    event AuctionGraduated(address indexed auction, uint256 currencyRaised, uint256 finalPrice);
    event FundsSwept(address indexed auction, uint256 amount);
    event TokensSwept(address indexed auction, uint256 amount);
    event LaunchPricingResolved(
        address indexed auction,
        uint256 floorPriceQ96,
        uint256 tickSpacingQ96,
        uint256 assetUsdPrice,
        uint256 ethUsdPrice
    );

    event ConfigUpdated(bytes32 param, uint256 value);
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
    event LpManagerUpdated(address indexed lpManager);
    event LpManagerSeeded(address indexed lpManager, uint256 shareAmount, uint256 currencyAmount);

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
    error LpManagerNotSet();
    error LpManagerAlreadySet();
    error LpManagerAlreadySeeded();
    error CurrencyBalanceTooLow(uint256 needed, uint256 available);
    error LpReserveTooLow(uint256 requiredReserve, uint256 availableBalance);
    error SweepNotAllowed(uint64 sweepBlock, uint256 currentBlock);
    error NotOperator(address caller, address expected);
    error LaunchOracleNotConfigured();
    error UnsupportedLaunchCurrency(address currency);
    error LaunchOracleInvalidPrice(int256 assetUsdPrice, int256 ethUsdPrice);
    error LaunchOracleStale(uint256 assetTimestamp, uint256 ethTimestamp, uint64 maxAge, uint256 currentTimestamp);
    error LaunchFloorTooLow(uint256 rawFloorPriceQ96, uint256 tickSpacingQ96);
    error SimpleLaunchDisabled();
    /// @dev ArbSys staticcall failed after construction-time detection (should never happen on a live Orbit chain).
    error BlockNumberishUnavailable();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidConfig();
    error Unauthorized();
    error EthTransferFailed();
    // FIX: H-02 — migrate deadline / slippage protection
    error MigrationSqrtPriceMismatch(uint160 expected, uint160 actual);
    /// @dev AUDIT-2026-07-08-H04: all candidate fee/tick keys were griefed at wrong prices.
    error MigrationPoolUnavailable(uint160 expectedSqrtPriceX96);

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
        _useArbSys = _detectArbSys();

        // Default to Uniswap's v1.1.0 factory deployment.
        ccaFactory = UNISWAP_CCA_FACTORY_V110;
        positionRecipient = _owner;
        operator = _owner;
        simpleLaunchEnabled = false;
        _configModule = address(
            new CCALaunchArmConfigModule(_auctionToken, _currency, _fundsRecipient, _tokensRecipient, _owner)
        );
        _encodingHelper = new CCALaunchArmEncodingHelper();
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

    function _delegateConfig() internal {
        (bool ok, bytes memory data) = _configModule.delegatecall(msg.data);
        if (!ok) {
            assembly {
                revert(add(data, 0x20), mload(data))
            }
        }
    }

    /**
     * @notice Approve or revoke launcher permissions
     * @param launcher Address to approve (e.g., VaultActivationBatcher)
     * @param approved Whether to approve or revoke
     * @dev Only owner can manage approved launchers
     */
    function setApprovedLauncher(address launcher, bool approved) external {
        launcher;
        approved;
        _delegateConfig();
    }

    /**
     * @notice Update the Uniswap CCA factory address used for deployments.
     * @dev Allows migrating to newer Uniswap factory deployments without redeploying this strategy.
     *      Marks the factory as v1.x (`initializeDistribution`). Use `setCcaFactoryV2` for v2.x.
     */
    function setCcaFactory(address newFactory) external {
        newFactory;
        _delegateConfig();
    }

    /**
     * @notice Point this strategy at a Uniswap CCA v2.x factory (called via `create`).
     * @dev Required for chains where only v2.1.0 is deployed (Arbitrum/Orbit-family), and for
     *      any self-deployed v2.1.0 factory (e.g. Robinhood Chain bootstrap).
     */
    function setCcaFactoryV2(address newFactory) external {
        newFactory;
        _delegateConfig();
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
    ) external {
        _positionManager;
        _positionRecipient;
        _operator;
        _migrationDelayBlocks;
        _sweepDelayBlocks;
        _delegateConfig();
    }

    /**
     * @notice Configure optional backing-vault telemetry source.
     * @dev This is non-blocking visibility only; no auction/migration gates depend on it.
     */
    function setBackingVault(address _backingVault) external {
        _backingVault;
        _delegateConfig();
    }

    /**
     * @notice Enable or disable simplified launch path.
     */
    function setSimpleLaunchEnabled(bool enabled) external {
        enabled;
        _delegateConfig();
    }

    /**
     * @notice Set blocks-per-second for Thursday-epoch scheduling on sub-second (Orbit) chains.
     * @dev Must be paired with the ArbSys block domain; ignored when zero (seconds-per-block applies).
     */
    function setLaunchBlocksPerSecond(uint64 _blocksPerSecond) external {
        _blocksPerSecond;
        _delegateConfig();
    }

    /**
     * @notice Block domain used by this strategy — ArbSys.arbBlockNumber() on Orbit chains,
     *         block.number elsewhere. Matches Uniswap CCA v2.x BlockNumberish semantics so the
     *         strategy lifecycle stays in the same domain as the auction's START/END/CLAIM blocks.
     */
    function _blockNumberish() internal view returns (uint256) {
        if (!_useArbSys) return block.number;
        (bool ok, bytes memory data) =
            ARB_SYS_ADDRESS.staticcall(abi.encodeWithSelector(ARB_BLOCK_NUMBER_SELECTOR));
        if (!ok || data.length != 32) revert BlockNumberishUnavailable();
        return abi.decode(data, (uint256));
    }

    function _detectArbSys() private view returns (bool) {
        if (ARB_SYS_ADDRESS.code.length == 0) return false;
        (bool ok, bytes memory data) =
            ARB_SYS_ADDRESS.staticcall(abi.encodeWithSelector(ARB_BLOCK_NUMBER_SELECTOR));
        return ok && data.length == 32;
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
        (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 assetUsdPrice, uint256 ethUsdPrice) =
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
        // v2.x factories expose the same flow under `create` (identical AuctionParameters encoding).
        bytes32 salt = keccak256(abi.encode(address(auctionToken), amount, configData));
        auction = ccaFactoryV2
            ? IContinuousClearingAuctionFactoryV2(ccaFactory).create(address(auctionToken), amount, configData, salt)
            : IContinuousClearingAuctionFactory(ccaFactory)
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
            lpManagerSeeded: false,
            failedFinalized: false
        });
        _snapshotBackingTelemetry();
        _persistLifecycleSnapshot();
        lastSweepBlock = sweepBlock;
        _setPhase(_blockNumberish() < startBlock ? LifecyclePhase.AuctionScheduled : LifecyclePhase.AuctionLive);

        emit AuctionCreated(auction, address(auctionToken), amount, startBlock, endBlock);
        emit LaunchPricingResolved(auction, floorPriceQ96, tickSpacingQ96, assetUsdPrice, ethUsdPrice);

        // FIX: AUDIT-2026-07-01-L06 — trade fee recipient is immutable after first launch.
        (bool locked,) = _configModule.delegatecall(abi.encodeWithSignature("lockFeeRecipient()"));
        locked;
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
     * @notice Launch auction with explicit LP reserve metadata from the batcher.
     * @dev `lpReserveAmount` stays in the strategy for post-auction migration. Amounts are
     *      computed by `DeploymentBatcher` (30% auction / 30% vesting / 30% Solana / 10% LP reserve).
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
        // FIX: S-C01 — cache auction pointer before external calls (CEI ordering)
        address auctionAddr = currentAuction;
        IContinuousClearingAuction auction = IContinuousClearingAuction(auctionAddr);
        auction.checkpoint();
        if (!auction.isGraduated()) revert AuctionNotGraduated();

        uint256 raised = auction.currencyRaised();
        uint256 finalPrice = auction.clearingPrice();

        // FIX: S-C01 — update state before external sweepCurrency call
        currentLaunch.currencySwept = true;
        auction.sweepCurrency();
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
        if (_blockNumberish() <= currentLaunch.endBlock) {
            revert AuctionStillLive(currentLaunch.endBlock, _blockNumberish());
        }

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
     * @notice Migrate graduated CCA into a live ShareOFT/native-ETH V4 pool.
     * @dev Initializes the pool at the auction clearing price, configures the oracle, and
     *      retains ShareOFT lp reserve + swept currency on this strategy for `seedLpManager()`.
     */
    function migrate() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();
        // taxHook may be address(0) for spoke no-hook V4 pools (Base sell-tax hook is hub-only).
        if (address(poolManager) == address(0)) {
            revert MigrationConfigMissing();
        }
        if (currentLaunch.migrated) revert InvalidConfig();
        if (!currentLaunch.currencySwept) revert MigrationConfigMissing();
        if (_blockNumberish() < currentLaunch.migrationBlock) {
            revert MigrationNotReady(currentLaunch.migrationBlock, _blockNumberish());
        }

        address auctionAddr = currentAuction;
        IContinuousClearingAuction auction = IContinuousClearingAuction(auctionAddr);
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

        bool currencyIsCurrency0 = currency < address(auctionToken);
        uint256 priceX192 = auction.clearingPrice().convertToPriceX192(currencyIsCurrency0);
        uint160 sqrtPriceX96 = priceX192.convertToSqrtPriceX96();

        _setPhase(LifecyclePhase.PoolInitializing);
        // AUDIT-2026-07-08-H04: V4 pools are permissionlessly initializable. If the primary
        // (fee, tickSpacing) key was griefed at a wrong sqrtPrice, rotate across a small
        // candidate set and persist the winning fee/tick so LP seed + oracle use the same key.
        _resolveAndInitializeMigrationPool(sqrtPriceX96);

        currentLaunch.migrated = true;
        _persistLifecycleSnapshot();

        _configureOracleV4Pool();
        _setPhase(LifecyclePhase.PoolLive);

        emit Migrated(auctionAddr, sqrtPriceX96, reserveRaw, currencyAmountRaw);
    }

    /**
     * @notice Wire the post-auction ShareOFT mesh LP manager.
     */
    function setLpManager(address _lpManager) external onlyApprovedOrOwner {
        if (_lpManager == address(0)) revert ZeroAddress();
        if (lpManager != address(0)) revert LpManagerAlreadySet();
        lpManager = _lpManager;
        emit LpManagerUpdated(_lpManager);
    }

    /**
     * @notice Transfer retained ShareOFT reserve + swept currency to the wired LP manager.
     */
    function seedLpManager() external nonReentrant onlyApprovedOrOwner {
        if (!currentLaunch.migrated) revert MigrationConfigMissing();
        if (lpManager == address(0) || lpManager.code.length == 0) revert LpManagerNotSet();
        if (currentLaunch.lpManagerSeeded) revert LpManagerAlreadySeeded();

        uint256 reserveAmount = currentLaunch.lpReserveAmount;
        uint256 currencyAmount = _currencyBalance(address(this));
        currentLaunch.lpManagerSeeded = true;
        _persistLifecycleSnapshot();

        if (reserveAmount > 0) {
            auctionToken.safeTransfer(lpManager, reserveAmount);
        }
        if (currencyAmount > 0) {
            if (currency == address(0)) {
                (bool ok,) = lpManager.call{value: currencyAmount}("");
                if (!ok) revert InvalidConfig();
            } else {
                IERC20(currency).safeTransfer(lpManager, currencyAmount);
            }
        }

        emit LpManagerSeeded(lpManager, reserveAmount, currencyAmount);
    }

    /**
     * @notice Return the ShareOFT/native-ETH mesh pool key used by this strategy.
     */
    function getPoolKey() external view returns (PoolKey memory) {
        return _buildPoolKey();
    }

    /**
     * @notice Configure oracle with V4 pool details
     * @dev Called automatically on graduation if oracle is set
     */
    function _configureOracleV4Pool() internal {
        if (oracle == address(0) || address(poolManager) == address(0)) revert ZeroAddress();
        PoolKey memory poolKey = _buildPoolKey();

        // Configure oracle (Chainlink-style price uses V4 TWAP × Chainlink ETH/USD)
        bool assetIsToken0 = Currency.unwrap(poolKey.currency0) == address(auctionToken);
        IOracle4626(oracle).setV4Pool(address(poolManager), poolKey, assetIsToken0);

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
        _delegateConfig();
    }

    /**
     * @notice Sweep residual raised currency balance after sweep window.
     */
    function sweepResidualCurrency() external nonReentrant {
        _delegateConfig();
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
        if (_blockNumberish() < launchData.startBlock) return LifecyclePhase.AuctionScheduled;
        if (isGraduated) return LifecyclePhase.AuctionEndedPending;
        if (_blockNumberish() <= launchData.endBlock) return LifecyclePhase.AuctionLive;
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
        return _encodingHelper.deriveScheduledStartBlock(
            _blockNumberish(), block.timestamp, launchBlockTimeSeconds, launchBlocksPerSecond
        );
    }

    function _deriveLaunchPricing()
        internal
        view
        returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 assetUsdPrice, uint256 ethUsdPrice)
    {
        return _encodingHelper.deriveLaunchPricing(
            oracle, currency, launchOracleMaxAge, launchDiscountBps, launchTickSpacingBps, block.timestamp
        );
    }

    function _deriveLaunchTickSpacing(uint256 floorPriceQ96) internal view returns (uint256 tickSpacingQ96) {
        tickSpacingQ96 = Math.mulDiv(floorPriceQ96, uint256(launchTickSpacingBps), BPS_DENOMINATOR);
        if (tickSpacingQ96 < 2) tickSpacingQ96 = 2;
    }

    function _encodeAuctionParams(
        uint256 floorPrice,
        uint256 tickSpacingQ96,
        uint128 requiredRaise,
        uint64 startBlock,
        uint64 endBlock,
        uint64 claimBlock,
        bytes memory auctionSteps
    ) internal view returns (bytes memory) {
        return _encodingHelper.encodeAuctionParams(
            currency,
            tokensRecipient,
            fundsRecipient,
            floorPrice,
            tickSpacingQ96,
            requiredRaise,
            startBlock,
            endBlock,
            claimBlock,
            auctionSteps
        );
    }

    function _createUniswapSafeDefaultSteps(uint64 duration) internal view returns (bytes memory) {
        return _encodingHelper.createUniswapSafeDefaultSteps(duration);
    }

    function _currencyBalance(address holder) internal view returns (uint256) {
        if (currency == address(0)) return holder.balance;
        return IERC20(currency).balanceOf(holder);
    }

    function _buildPoolKey() internal view returns (PoolKey memory key) {
        return _buildPoolKeyWith(poolFeeTier, poolTickSpacing);
    }

    function _buildPoolKeyWith(uint24 fee, int24 tickSpacing) internal view returns (PoolKey memory key) {
        // ETH (address(0)) naturally sorts first as token0 in V4.
        bool currencyIsToken0 = currency < address(auctionToken);
        key = PoolKey({
            currency0: Currency.wrap(currencyIsToken0 ? currency : address(auctionToken)),
            currency1: Currency.wrap(currencyIsToken0 ? address(auctionToken) : currency),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(taxHook)
        });
    }

    /// @dev Try primary pool key then alternate fee/tick combos if a third party initialized
    ///      the primary key at the wrong price (permissionless V4 initialize grief).
    function _resolveAndInitializeMigrationPool(uint160 sqrtPriceX96) internal {
        // Candidate fees: configured first, then common V4 tiers.
        uint24 primaryFee = poolFeeTier;
        int24 primaryTick = poolTickSpacing;
        uint24[4] memory fees = [primaryFee, uint24(500), uint24(10_000), uint24(100)];
        int24[3] memory ticks = [primaryTick, int24(10), int24(200)];

        for (uint256 i = 0; i < fees.length; i++) {
            uint24 fee = fees[i];
            // Skip duplicate fees after the first slot.
            if (i > 0 && fee == primaryFee) continue;
            if (fee > LPFeeLibrary.MAX_LP_FEE) continue;

            for (uint256 j = 0; j < ticks.length; j++) {
                int24 tickSp = ticks[j];
                if (j > 0 && tickSp == primaryTick) continue;
                if (tickSp > TickMath.MAX_TICK_SPACING || tickSp < TickMath.MIN_TICK_SPACING) continue;

                PoolKey memory key = _buildPoolKeyWith(fee, tickSp);
                try poolManager.initialize(key, sqrtPriceX96) {} catch {}

                PoolId pid = PoolIdLibrary.toId(key);
                (uint160 actualSqrtPriceX96,,,) = StateLibrary.getSlot0(poolManager, pid);
                if (actualSqrtPriceX96 == sqrtPriceX96) {
                    if (fee != poolFeeTier || tickSp != poolTickSpacing) {
                        poolFeeTier = fee;
                        poolTickSpacing = tickSp;
                        emit MigrationPoolKeyRotated(fee, tickSp, sqrtPriceX96);
                    }
                    return;
                }
            }
        }
        revert MigrationPoolUnavailable(sqrtPriceX96);
    }

    // ================================
    // ADMIN
    // ================================

    /**
     * @notice Update default auction duration
     */
    function setDefaultDuration(uint64 _duration) external {
        _duration;
        _delegateConfig();
    }

    /**
     * @notice Update default claim delay
     */
    function setDefaultClaimDelay(uint64 _delay) external {
        _delay;
        _delegateConfig();
    }

    /**
     * @notice Update the block-time estimate used for Thursday UTC launch alignment.
     */
    function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external {
        _secondsPerBlock;
        _delegateConfig();
    }

    /**
     * @notice Update migration delay after auction end.
     */
    function setMigrationDelayBlocks(uint64 _delay) external {
        _delay;
        _delegateConfig();
    }

    /**
     * @notice Update default post-claim sweep delay.
     */
    function setDefaultSweepDelayBlocks(uint64 _delay) external {
        _delay;
        _delegateConfig();
    }

    /**
     * @notice Update default tick spacing
     */
    function setDefaultTickSpacing(uint256 _spacing) external {
        _spacing;
        _delegateConfig();
    }

    /**
     * @notice Update default floor price
     * @dev Legacy fallback value retained for backwards compatibility. Launch flow derives floor onchain.
     */
    function setDefaultFloorPrice(uint256 _price) external {
        _price;
        _delegateConfig();
    }

    /**
     * @notice Update launch floor discount applied to oracle price.
     * @param _discountBps Discount in bps (10000 = 100%, 8000 = 80%).
     */
    function setLaunchDiscountBps(uint16 _discountBps) external {
        _discountBps;
        _delegateConfig();
    }

    /**
     * @notice Update launch tick spacing (as bps of derived launch floor).
     * @param _tickSpacingBps Tick spacing bps (100 = 1%).
     */
    function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external {
        _tickSpacingBps;
        _delegateConfig();
    }

    /**
     * @notice Update maximum accepted oracle staleness for launch pricing.
     */
    function setLaunchOracleMaxAge(uint64 _maxAge) external {
        _maxAge;
        _delegateConfig();
    }

    /**
     * @notice Update fund recipients
     */
    function setRecipients(address _fundsRecipient, address _tokensRecipient) external {
        _fundsRecipient;
        _tokensRecipient;
        _delegateConfig();
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
    {
        _oracle;
        _poolManager;
        _taxHook;
        _feeRecipient;
        _delegateConfig();
    }

    /**
     * @notice Update fee recipient (GaugeController)
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external {
        _feeRecipient;
        _delegateConfig();
    }

    /**
     * @notice Update tax rate
     * @param _taxRateBps Tax rate in basis points (690 = 6.9%)
     */
    function setTaxRate(uint256 _taxRateBps) external {
        _taxRateBps;
        _delegateConfig();
    }

    /**
     * @notice Update V4 pool fee tier
     * @param _feeTier Fee in hundredths of bips (3000 = 0.3%)
     */
    function setPoolFeeTier(uint24 _feeTier) external {
        _feeTier;
        _delegateConfig();
    }

    /**
     * @notice Update V4 pool tick spacing
     * @param _tickSpacing Tick spacing for the pool
     */
    function setPoolTickSpacing(int24 _tickSpacing) external {
        _tickSpacing;
        _delegateConfig();
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
        returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 assetUsdPrice, uint256 ethUsdPrice)
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
        uint256 blockNumber = _blockNumberish();
        bool auctionWindowOpen = blockNumber >= currentLaunch.startBlock && blockNumber <= currentLaunch.endBlock;
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
        uint256 blockNumber = _blockNumberish();
        status.auctionWindowOpen = blockNumber >= launchData.startBlock && blockNumber <= launchData.endBlock;
        status.claimOpen = blockNumber >= launchData.claimBlock;
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
    function emergencyWithdraw(address token, uint256 amount, address to) external {
        token;
        amount;
        to;
        _delegateConfig();
    }

    /**
     * @notice Emergency withdraw ETH
     */
    function emergencyWithdrawETH(address payable to) external {
        to;
        _delegateConfig();
    }

    receive() external payable {}
}
