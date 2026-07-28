// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IUniswapV3Pool} from "@4626/shared/interfaces/uniswap/IUniswapV3Pool.sol";

import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";
import {CreatorOracleQuoteLib} from "@4626/creator/oracles/CreatorOracleQuoteLib.sol";

/**
 * @title CreatorOracle
 * @author 0xakita.eth (4626)
 * @notice Omnichain oracle for Creator Coin price distribution
 * @dev Deployed to same address on all chains via CREATE2
 *
 * @dev ARCHITECTURE:
 *      Base (Hub):
 *      - Reads V4 pool TWAP (■CREATOR/ETH)
 *      - Gets ETH/USD from Chainlink
 *      - Calculates ■CREATOR/USD
 *      - Broadcasts to all chains via LayerZero
 *
 *      Remote Chains:
 *      - Receive and store Base's authoritative price
 *      - Use for lottery, gauge calculations, etc.
 *      - No local liquidity needed!
 *
 * @dev MANIPULATION RESISTANCE:
 *      - Tick capping limits price movement per observation
 *      - Auto-tuning adjusts cap based on frequency
 *      - TWAP smooths out flash loan attacks
 *      - Chainlink provides trusted ETH/USD baseline
 *
 * @dev USE CASES:
 *      - GaugeController: Swap slippage protection
 *      - Lottery: Fair USD value for prizes
 *      - Vault: Price impact calculations
 *      - Cross-chain: Consistent pricing everywhere
 */
contract CreatorOracle is OApp, IOracle4626 {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Base chain ID (source of truth)
    uint256 public constant BASE_CHAIN_ID = 8453;
    /// @notice Base mainnet canonical WETH address.
    address public constant BASE_WETH = 0x4200000000000000000000000000000000000006;

    /// @notice Base chain LayerZero EID (source of truth for inbound price updates)
    uint32 public immutable BASE_EID;

    /// @notice Staleness threshold for prices
    uint256 public constant MAX_STALENESS = 7200; // 2 hours

    /// @notice Minimum Uniswap V3 pool liquidity accepted for oracle configuration.
    /// @dev Rejects dust / spoof pools (e.g. liquidity == 1) that produce nonsense TWAPs
    ///      and poison CCA launch floors. Real Base CREATOR/USDC pools are far above this.
    uint128 public constant MIN_V3_ORACLE_LIQUIDITY = 1e12;

    /// @notice Post-recovery grace period before a "sequencer up" status is trusted.
    /// @dev Mitigates L-1 (audit `docs/audits/aristotle/oracle`) — mirrors Chainlink's
    ///      reference sequencer-uptime pattern of not trusting prices for a window
    ///      right after the sequencer comes back online.
    uint256 public constant SEQUENCER_GRACE_PERIOD = 3600; // 1 hour

    /// @notice Default TWAP duration
    uint32 public constant DEFAULT_TWAP_DURATION = 1800; // 30 minutes

    /// @notice Minimum TWAP duration accepted by public price update functions
    uint32 public constant MIN_TWAP_DURATION = 1800; // 30 minutes
    uint32 public constant MIN_PRICE_UPDATE_COOLDOWN = 30; // ODA-514/513: prevent instant walk

    /// @notice Maximum allowed price deviation per update (20%)
    uint256 public constant MAX_PRICE_DEVIATION = 0.2e18;

    /// @notice Hard upper bound on the first price that `initializeAssetPrice`
    /// may set (1e18 format). Prevents the bootstrap anchor from being placed
    /// at an extreme value even if the owner key is compromised. 1_000_000 USD
    /// per CREATOR token is unrealistically high but is a non-insulting
    /// sanity cap. Raise only via a formal parameter change, not inline.
    /// @dev Mitigates H-01 (audit finding 4626-293).
    int256 public constant MAX_INITIAL_PRICE_USD = int256(uint256(1_000_000e18));

    /// @notice Maximum observations to store
    uint16 public constant MAX_CARDINALITY = 1024;

    /// @notice Delay before post-bootstrap critical config changes can execute.
    uint48 public constant CRITICAL_CONFIG_DELAY = 1 days;

    // ================================
    // STATE - PRICE DATA
    // ================================

    /// @notice Creator token USD price (broadcast from Base)
    int256 public assetPriceUSD; // 1e18 format
    uint256 public assetPriceTimestamp;

    /// @notice Creator token symbol (for identification)
    string public assetSymbol;

    /// @notice Chainlink ETH/USD feed address
    address public chainlinkFeed;
    /// @notice Optional Base L2 sequencer uptime feed (Chainlink). Zero disables the guard.
    /// Base mainnet reference: 0x4C4814aa04433e0FB313CB0895b582569eF52253
    address public sequencerUptimeFeed;

    // ================================
    // STATE - V4 POOL
    // ================================

    /// @notice Uniswap V4 PoolManager
    IPoolManager public poolManager;

    /// @notice V4 pool key for ■CREATOR/ETH
    PoolKey public assetPoolKey;

    /// @notice Whether V4 pool is configured
    bool public v4PoolConfigured;

    /// @notice Whether creator token is token0 in the pool
    bool public assetIsToken0;

    // ================================
    // STATE - V3 POOL (CREATOR/USDC TWAP)
    // ================================

    /// @notice Uniswap V3 pool used as primary CREATOR/USD oracle (optional)
    address public v3Pool;

    /// @notice Creator token used in the V3 pool (base token)
    address public v3CreatorToken;

    /// @notice USD stable token used in the V3 pool (quote token, e.g. USDC)
    address public v3UsdToken;

    /// @notice Optional reference quote token guard for V3 pricing lanes.
    /// @dev If set, `setV3Pool` requires `_usdToken == referenceQuoteToken`.
    ///      Intended to pin CreatorOracle to the creator lane quote token (e.g. ZORA).
    address public referenceQuoteToken;

    /// @notice When true, reference quote token can no longer be changed.
    bool public referenceQuoteTokenLocked;

    /// @notice Optional Chainlink-style feed converting the V3 quote token to USD.
    /// @dev Used by `updateAssetPriceFromV3TWAP` when the V3 quote token is not a
    ///      USD stable (e.g. ZORA). When unset, Base WETH quotes fall back to
    ///      `chainlinkFeed`; a pinned non-stable quote token fails closed instead of
    ///      being silently stored as USD.
    address public quoteUsdFeed;

    /// @notice Cached decimals for price scaling
    uint8 public v3CreatorDecimals;
    uint8 public v3UsdDecimals;

    /// @notice Default V3 TWAP duration (seconds)
    uint32 public v3TwapDuration = DEFAULT_TWAP_DURATION;

    /// @notice Whether V3 pool is configured
    bool public v3PoolConfigured;

    // ================================
    // STATE - TWAP OBSERVATIONS
    // ================================

    /// @notice Observation data point
    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        int56 tickCumulativeTruncated;
        uint160 secondsPerLiquidityCumulativeX128;
        int24 prevTruncatedTick;
        bool initialized;
    }

    /// @notice Ring buffer of observations
    Observation[65535] public observations;

    /// @notice Current observation state
    struct ObservationState {
        uint16 index;
        uint16 cardinality;
        uint16 cardinalityNext;
    }
    ObservationState public observationState;

    /// @notice Last observation timestamp
    uint32 public lastObservationTimestamp;

    // ================================
    // STATE - TICK CAPPING
    // ================================

    /// @notice Maximum tick movement per observation (manipulation resistance)
    int24 public maxTicksPerObservation = 100; // ~1% per observation

    /// @notice Tick cap auto-tuning state
    struct TickCapState {
        uint64 capFrequency;
        uint48 lastCapUpdate;
        bool autoTunePaused;
    }
    TickCapState public tickCapState;

    /// @notice Tick cap policy
    struct TickCapPolicy {
        int24 minCap;
        int24 maxCap;
        uint32 stepBps;
        uint32 budgetPpm;
        uint32 decayWindowSec;
        uint32 updateIntervalSec;
    }
    TickCapPolicy public tickCapPolicy;

    // ================================
    // STATE - ACCESS CONTROL
    // ================================

    /// @notice Authorized swap recorders
    mapping(address => bool) public isSwapRecorder;

    /// @notice Authorized price updaters
    mapping(address => bool) public isPriceUpdater;

    /// @notice Price update cooldown (gas optimization)
    uint32 public priceUpdateCooldown = 30;

    /// @notice Use truncated (manipulation-resistant) tick
    bool public useTruncatedTick = true;

    struct PendingAddressConfig {
        address value;
        uint48 executeAfter;
        bool queued;
    }

    struct PendingPriceUpdaterConfig {
        address updater;
        bool authorized;
        uint48 executeAfter;
        bool queued;
    }

    struct PendingV3PoolConfig {
        address pool;
        address creatorToken;
        address usdToken;
        uint32 twapDuration;
        uint48 executeAfter;
        bool queued;
    }

    struct PendingV4PoolConfig {
        address poolManager;
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        bool assetIsToken0;
        uint48 executeAfter;
        bool queued;
    }

    PendingAddressConfig public pendingChainlinkFeed;
    PendingAddressConfig public pendingSequencerUptimeFeed;
    PendingAddressConfig public pendingQuoteUsdFeed;
    PendingPriceUpdaterConfig public pendingPriceUpdater;
    PendingV3PoolConfig private pendingV3Pool;
    PendingV4PoolConfig private pendingV4Pool;

    // ================================
    // CONSTANTS - INTERNAL
    // ================================

    uint32 private constant PPM = 1_000_000;
    uint64 private constant ONE_DAY_PPM = 86_400 * 1_000_000;

    // ================================
    // EVENTS
    // ================================

    event AssetPriceUpdated(string symbol, int256 price, uint256 timestamp, address indexed updater);
    event AssetPriceBroadcast(uint32[] dstEids, int256 price, uint256 timestamp);
    event AssetPriceReceived(uint32 srcEid, int256 price, uint256 timestamp);
    /// @notice Remote price update rejected before any state change.
    event RemotePriceUpdateSkipped(uint32 indexed srcEid, int256 candidatePrice, uint256 candidateTimestamp, string reason);
    event V4PoolConfigured(PoolId indexed poolId, address poolManager, bool assetIsToken0);
    event V3PoolConfigured(
        address indexed pool, address indexed creatorToken, address indexed usdToken, uint32 twapDuration
    );
    event ObservationRecorded(uint16 index, int24 tick, int24 truncatedTick, uint32 timestamp);
    event SwapRecorderSet(address indexed recorder, bool authorized);
    event PriceUpdaterSet(address indexed updater, bool authorized);
    event MaxTicksUpdated(int24 oldMaxTicks, int24 newMaxTicks, bool autoTuned);
    event TickWasCapped(int24 rawTick, int24 truncatedTick, int24 movement);
    event ChainlinkFeedSet(address indexed feed);
    event SequencerUptimeFeedSet(address indexed feed);
    event ReferenceQuoteTokenSet(address indexed token);
    event ReferenceQuoteTokenLocked(address indexed token);
    event QuoteUsdFeedSet(address indexed feed);
    event ChainlinkFeedQueued(address indexed feed, uint256 executeAfter);
    event SequencerUptimeFeedQueued(address indexed feed, uint256 executeAfter);
    event QuoteUsdFeedQueued(address indexed feed, uint256 executeAfter);
    event V4PoolQueued(PoolId indexed poolId, address indexed poolManager, bool assetIsToken0, uint256 executeAfter);
    event V3PoolQueued(
        address indexed pool, address indexed creatorToken, address indexed usdToken, uint32 twapDuration, uint256 executeAfter
    );
    event PriceUpdaterQueued(address indexed updater, bool authorized, uint256 executeAfter);
    event RemotePriceUpdateClamped(
        uint32 indexed srcEid, int256 candidatePrice, int256 appliedPrice, uint256 candidateTimestamp
    );
    // FIX: M-3 (4626-439) — emitted (via the deprecated entrypoint's revert path in tests / off-chain
    // call-simulation) so tooling can pick up migrations to broadcastAssetPriceWithFees.

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error InvalidPrice();
    error Unauthorized();
    error V4NotConfigured();
    error V3NotConfigured();
    error InvalidV3Pool();
    error V3PoolLiquidityTooLow(uint128 liquidity, uint128 minimum);
    error UnsupportedDecimals();
    error NeedMoreObservations();
    error StalePrice();
    error SequencerDown();
    error InvalidDuration();
    error InvalidReferenceQuoteToken(address expected, address actual);
    error ReferenceQuoteTokenIsLocked();
    error ReferenceQuoteTokenUnset();
    error MissingQuoteUsdFeed(address quoteToken);
    error PriceUpdateCooldown();
    error PriceDeviationTooHigh();
    // H-01 / 4626-293: oracle bootstrap must go through initializeAssetPrice.
    error OracleNotInitialized();
    error OracleAlreadyInitialized();
    error InitialPriceTooHigh();
    error InvalidBaseEid();
    error InvalidOriginEid(uint32 srcEid);
    error HubOnly();
    error StaleObservationWindow();
    error NoDestinations();
    error BroadcastLengthMismatch();
    error ZeroBroadcastFee();
    error InsufficientBroadcastFee();
    error BroadcastRefundFailed();
    error InvalidV4Pool();
    error CriticalConfigNotReady(uint256 executeAfter);
    error CriticalConfigNotQueued();
    error RenounceOwnershipDisabled();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy oracle for a Creator Coin
     * @param _registry Registry4626 address (same on all chains for deterministic addresses)
     * @param _chainlinkFeed Chainlink ETH/USD feed address
     * @param _assetSymbol Creator token symbol (e.g., "■CREATOR")
     * @param _owner Owner address
     *
     * @dev DETERMINISTIC DEPLOYMENT:
     *      Registry address is same on all chains via CREATE2.
     *      LayerZero endpoint is looked up from registry at construction.
     *      This allows same constructor args → same CREATE2 address on all chains.
     */
    constructor(address _registry, address _chainlinkFeed, string memory _assetSymbol, address _owner)
        OApp(IRegistry4626(_registry).getLayerZeroEndpoint(block.chainid), _owner)
        Ownable(_owner)
    {
        if (_registry == address(0)) revert ZeroAddress();

        BASE_EID = IRegistry4626(_registry).hubChainEid();
        if (BASE_EID == 0) revert InvalidBaseEid();

        chainlinkFeed = _chainlinkFeed;
        assetSymbol = _assetSymbol;

        // Initialize tick cap policy with sensible defaults
        tickCapPolicy = TickCapPolicy({
            minCap: 10, // ~0.1% movement
            maxCap: 500, // ~5% movement
            stepBps: 500, // 5% adjustment per step
            budgetPpm: 10000, // Target 1% of observations hit cap
            decayWindowSec: 3600, // 1 hour decay
            updateIntervalSec: 60 // Min 1 minute between adjustments
        });
    }

    // ================================
    // ADMIN - CONFIGURATION
    // ================================

    /**
     * @notice Set Chainlink ETH/USD feed
     * @param _feed Chainlink feed address
     */
    function setChainlinkFeed(address _feed) external onlyOwner {
        if (_feed == address(0)) revert ZeroAddress();
        if (_feed == chainlinkFeed) return;
        if (_criticalConfigDelayActive()) {
            pendingChainlinkFeed =
                PendingAddressConfig({value: _feed, executeAfter: _criticalConfigExecuteAfter(), queued: true});
            emit ChainlinkFeedQueued(_feed, pendingChainlinkFeed.executeAfter);
            return;
        }
        _applyChainlinkFeed(_feed);
    }

    /// @notice Configure optional Base sequencer uptime feed (fail-closed when down).
    function setSequencerUptimeFeed(address _feed) external onlyOwner {
        if (_feed == sequencerUptimeFeed) return;
        if (_criticalConfigDelayActive()) {
            pendingSequencerUptimeFeed =
                PendingAddressConfig({value: _feed, executeAfter: _criticalConfigExecuteAfter(), queued: true});
            emit SequencerUptimeFeedQueued(_feed, pendingSequencerUptimeFeed.executeAfter);
            return;
        }
        _applySequencerUptimeFeed(_feed);
    }

    /// @notice Set the required V3 quote token for this oracle lane.
    /// @dev Set to zero address to disable strict quote-token enforcement.
    function setReferenceQuoteToken(address _token) external onlyOwner {
        if (referenceQuoteTokenLocked) revert ReferenceQuoteTokenIsLocked();
        referenceQuoteToken = _token;
        emit ReferenceQuoteTokenSet(_token);
    }

    /// @notice Configure the quote-token/USD feed used by the V3 pricing lane.
    /// @dev Set to zero address to clear. When cleared, only Base WETH quotes fall
    ///      back to `chainlinkFeed`; other pinned quote lanes fail closed.
    function setQuoteUsdFeed(address _feed) external onlyOwner {
        if (_feed == quoteUsdFeed) return;
        if (_criticalConfigDelayActive()) {
            pendingQuoteUsdFeed =
                PendingAddressConfig({value: _feed, executeAfter: _criticalConfigExecuteAfter(), queued: true});
            emit QuoteUsdFeedQueued(_feed, pendingQuoteUsdFeed.executeAfter);
            return;
        }
        _applyQuoteUsdFeed(_feed);
    }

    /// @notice Irreversibly lock the current reference quote token.
    /// @dev Prevents post-init quote-token drift in production deployments.
    function lockReferenceQuoteToken() external onlyOwner {
        if (referenceQuoteToken == address(0)) revert ReferenceQuoteTokenUnset();
        referenceQuoteTokenLocked = true;
        emit ReferenceQuoteTokenLocked(referenceQuoteToken);
    }

    /**
     * @notice Configure V4 pool for TWAP observations
     * @param _poolManager Uniswap V4 PoolManager
     * @param _poolKey Pool key for ■CREATOR/ETH
     * @param _assetIsToken0 Whether creator token is currency0
     */
    function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _assetIsToken0) external onlyOwner {
        if (_criticalConfigDelayActive() && v4PoolConfigured) {
            (PoolId queuedPoolId,,) = _validateV4PoolConfig(_poolManager, _poolKey, _assetIsToken0);
            pendingV4Pool = PendingV4PoolConfig({
                poolManager: _poolManager,
                currency0: Currency.unwrap(_poolKey.currency0),
                currency1: Currency.unwrap(_poolKey.currency1),
                fee: _poolKey.fee,
                tickSpacing: _poolKey.tickSpacing,
                hooks: address(_poolKey.hooks),
                assetIsToken0: _assetIsToken0,
                executeAfter: _criticalConfigExecuteAfter(),
                queued: true
            });
            emit V4PoolQueued(queuedPoolId, _poolManager, _assetIsToken0, pendingV4Pool.executeAfter);
            return;
        }
        _applyV4Pool(_poolManager, _poolKey, _assetIsToken0);
    }

    /**
     * @notice Configure Uniswap V3 pool for CREATOR/USDC TWAP pricing (optional price source)
     * @param _pool Uniswap V3 pool address (must be the CREATOR/USDC pair)
     * @param _creatorToken Creator token address
     * @param _usdToken USD token address (e.g., USDC)
     * @param _twapDuration TWAP duration in seconds (e.g., 1800)
     */
    function setV3Pool(address _pool, address _creatorToken, address _usdToken, uint32 _twapDuration)
        external
        onlyOwner
    {
        if (_criticalConfigDelayActive() && v3PoolConfigured) {
            _validateV3PoolConfig(_pool, _creatorToken, _usdToken, _twapDuration);
            pendingV3Pool = PendingV3PoolConfig({
                pool: _pool,
                creatorToken: _creatorToken,
                usdToken: _usdToken,
                twapDuration: _twapDuration,
                executeAfter: _criticalConfigExecuteAfter(),
                queued: true
            });
            emit V3PoolQueued(_pool, _creatorToken, _usdToken, _twapDuration, pendingV3Pool.executeAfter);
            return;
        }
        _applyV3Pool(_pool, _creatorToken, _usdToken, _twapDuration);
    }

    /**
     * @notice Set authorized swap recorder
     * @param recorder Address that can record observations
     * @param authorized Whether to authorize
     */
    function setSwapRecorder(address recorder, bool authorized) external onlyOwner {
        if (recorder == address(0)) revert ZeroAddress();
        isSwapRecorder[recorder] = authorized;
        emit SwapRecorderSet(recorder, authorized);
    }

    /**
     * @notice Set authorized price updater
     * @param updater Address that can update price
     * @param authorized Whether to authorize
     */
    function setPriceUpdater(address updater, bool authorized) external onlyOwner {
        if (updater == address(0)) revert ZeroAddress();
        if (isPriceUpdater[updater] == authorized) return;
        // Revocations apply immediately so a compromised updater can be stopped
        // without waiting for the critical-config delay. Grants stay delayed.
        if (_criticalConfigDelayActive() && authorized) {
            pendingPriceUpdater = PendingPriceUpdaterConfig({
                updater: updater,
                authorized: authorized,
                executeAfter: _criticalConfigExecuteAfter(),
                queued: true
            });
            emit PriceUpdaterQueued(updater, authorized, pendingPriceUpdater.executeAfter);
            return;
        }
        // Clear a stale grant queue when revoking the same updater.
        if (!authorized && pendingPriceUpdater.queued && pendingPriceUpdater.updater == updater) {
            delete pendingPriceUpdater;
        }
        _applyPriceUpdater(updater, authorized);
    }

    function executeChainlinkFeedUpdate() external onlyOwner {
        _applyChainlinkFeed(_consumePendingAddress(pendingChainlinkFeed));
    }

    function executeSequencerUptimeFeedUpdate() external onlyOwner {
        _applySequencerUptimeFeed(_consumePendingAddress(pendingSequencerUptimeFeed));
    }

    function executeQuoteUsdFeedUpdate() external onlyOwner {
        _applyQuoteUsdFeed(_consumePendingAddress(pendingQuoteUsdFeed));
    }

    function executeV4PoolUpdate() external onlyOwner {
        PendingV4PoolConfig memory pending = pendingV4Pool;
        _requirePendingReady(pending.queued, pending.executeAfter);
        delete pendingV4Pool;
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(pending.currency0),
            currency1: Currency.wrap(pending.currency1),
            fee: pending.fee,
            tickSpacing: pending.tickSpacing,
            hooks: IHooks(address(pending.hooks))
        });
        _applyV4Pool(pending.poolManager, poolKey, pending.assetIsToken0);
    }

    function executeV3PoolUpdate() external onlyOwner {
        PendingV3PoolConfig memory pending = pendingV3Pool;
        _requirePendingReady(pending.queued, pending.executeAfter);
        delete pendingV3Pool;
        _applyV3Pool(pending.pool, pending.creatorToken, pending.usdToken, pending.twapDuration);
    }

    function executePriceUpdaterUpdate() external onlyOwner {
        PendingPriceUpdaterConfig memory pending = pendingPriceUpdater;
        _requirePendingReady(pending.queued, pending.executeAfter);
        delete pendingPriceUpdater;
        _applyPriceUpdater(pending.updater, pending.authorized);
    }

    /**
     * @notice Set maximum tick movement per observation
     * @param _maxTicks Maximum allowed tick movement
     */
    function setMaxTicksPerObservation(int24 _maxTicks) external onlyOwner {
        // FIX: L-5 — require minimum of 1; 0 disables all tick capping, removing
        // manipulation resistance entirely
        require(_maxTicks >= 1 && _maxTicks <= 1000, "Invalid range");
        int24 oldMax = maxTicksPerObservation;
        maxTicksPerObservation = _maxTicks;
        emit MaxTicksUpdated(oldMax, _maxTicks, false);
    }

    /**
     * @notice Set tick cap policy
     */
    function setTickCapPolicy(int24 _minCap, int24 _maxCap, uint32 _stepBps, uint32 _budgetPpm) external onlyOwner {
        require(_minCap > 0 && _maxCap > _minCap && _maxCap <= 1000, "Invalid range");
        require(_stepBps > 0 && _stepBps <= 10000, "Invalid step");
        require(_budgetPpm > 0 && _budgetPpm <= PPM, "Invalid budget");

        tickCapPolicy.minCap = _minCap;
        tickCapPolicy.maxCap = _maxCap;
        tickCapPolicy.stepBps = _stepBps;
        tickCapPolicy.budgetPpm = _budgetPpm;
    }

    /**
     * @notice Pause/unpause auto-tuning
     */
    function setAutoTunePaused(bool paused) external onlyOwner {
        tickCapState.autoTunePaused = paused;
    }

    /**
     * @notice Set price update cooldown
     */
    function setPriceUpdateCooldown(uint32 cooldown) external onlyOwner {
        // ODA-514: nonzero floor so a compromised updater cannot walk price in one tx via cooldown=0.
        require(cooldown >= MIN_PRICE_UPDATE_COOLDOWN && cooldown <= 300, "Cooldown out of range");
        priceUpdateCooldown = cooldown;
    }

    /**
     * @notice Set whether to use truncated tick
     */
    function setUseTruncatedTick(bool _use) external onlyOwner {
        useTruncatedTick = _use;
    }

    // ================================
    // PRICE READING
    // ================================

    /**
     * @notice Get ETH/USD price from Chainlink
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getEthPrice() external view returns (int256 price, uint256 timestamp) {
        if (!_sequencerIsUp()) return (0, 0);
        if (chainlinkFeed == address(0)) return (0, 0);

        (uint256 price18, uint256 updatedAt, bool ok) = _readFeedPrice18(chainlinkFeed);
        if (!ok) return (0, 0);
        price = int256(price18);
        timestamp = updatedAt;
    }

    /**
     * @notice Get Creator token USD price
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getAssetPrice() external view returns (int256 price, uint256 timestamp) {
        if (assetPriceUSD > 0 && assetPriceTimestamp > 0) {
            if (block.timestamp - assetPriceTimestamp < MAX_STALENESS) {
                return (assetPriceUSD, assetPriceTimestamp);
            }
        }
        return (0, 0);
    }

    /**
     * @notice Update creator price (authorized callers only)
     * @param _price Price in 1e18 format
     */
    function updateAssetPrice(int256 _price) external {
        if (block.chainid != BASE_CHAIN_ID) revert HubOnly();
        if (!isPriceUpdater[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        if (_price <= 0) revert InvalidPrice();
        if (!_sequencerIsUp()) revert SequencerDown();
        if (assetPriceTimestamp > 0 && block.timestamp - assetPriceTimestamp < priceUpdateCooldown) {
            revert PriceUpdateCooldown();
        }

        // H-01 / 4626-293: the first write must go through
        // initializeAssetPrice(), which is owner-only and bounded. A 0 price
        // here means the oracle has never been initialized, and accepting an
        // arbitrary value at this point lets an attacker (or a compromised
        // isPriceUpdater) anchor every subsequent MAX_PRICE_DEVIATION-capped
        // update to a manipulated baseline.
        if (assetPriceUSD == 0) revert OracleNotInitialized();

        // FIX: H-4 — apply deviation bounds to direct setter; previously bypassed all
        // TWAP/deviation guards, allowing a compromised priceUpdater to set arbitrary prices
        uint256 oldP = uint256(assetPriceUSD);
        uint256 newP = uint256(_price);
        uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
        if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();

        assetPriceUSD = _price;
        assetPriceTimestamp = block.timestamp;

        emit AssetPriceUpdated(assetSymbol, _price, block.timestamp, msg.sender);
    }

    /**
     * @notice Owner-only bootstrap of the first creator price. Every other
     *         update path (updateAssetPrice, updateAssetPriceFromTWAP,
     *         updateAssetPriceFromV3TWAP) enforces a MAX_PRICE_DEVIATION
     *         cap against the previously stored value, so the first write is
     *         what anchors every subsequent movement. Before this function was
     *         added, any `isPriceUpdater` could silently anchor the oracle to
     *         an arbitrary value. See H-01 / 4626-293.
     * @dev Can only be called once. Further changes must go through the
     *      deviation-capped paths. Bounded by MAX_INITIAL_PRICE_USD as a
     *      last-line sanity check even on the owner key.
     * @param _price Initial price in 1e18 format. Must be > 0 and
     *               <= MAX_INITIAL_PRICE_USD.
     */
    function initializeAssetPrice(int256 _price) external onlyOwner {
        if (block.chainid != BASE_CHAIN_ID) revert HubOnly();
        if (assetPriceUSD != 0) revert OracleAlreadyInitialized();
        if (_price <= 0) revert InvalidPrice();
        if (_price > MAX_INITIAL_PRICE_USD) revert InitialPriceTooHigh();

        assetPriceUSD = _price;
        assetPriceTimestamp = block.timestamp;

        emit AssetPriceUpdated(assetSymbol, _price, block.timestamp, msg.sender);
    }

    // ================================
    // TWAP - OBSERVATION RECORDING
    // ================================

    /**
     * @notice Record observation on swap
     * @dev Called by authorized recorders during swaps
     */
    function recordSwapObservation() external {
        if (!isSwapRecorder[msg.sender]) revert Unauthorized();
        if (!v4PoolConfigured) revert V4NotConfigured();

        bool tickWasCapped = _recordObservation();

        // Update cap frequency and auto-tune
        if (!tickCapState.autoTunePaused) {
            _updateCapFrequency(tickWasCapped);
        }

        // Only calculate price on Base
        if (block.chainid == BASE_CHAIN_ID && observationState.cardinality >= 2) {
            try this._updatePriceFromTWAPExternal() {} catch {}
        }
    }

    /**
     * @notice External wrapper for try/catch
     */
    function _updatePriceFromTWAPExternal() external {
        require(msg.sender == address(this), "Only self");
        _updatePriceFromTWAP();
    }

    /**
     * @notice Internal observation recording
     */
    function _recordObservation() internal returns (bool tickWasCapped) {
        if (!v4PoolConfigured) return false;

        PoolId poolId = assetPoolKey.toId();
        (, int24 tick,,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);

        // Get previous observation
        Observation storage prevObs = observations[observationState.index];
        int24 prevTick = prevObs.prevTruncatedTick;

        // Calculate tick movement
        int24 movement = tick - prevTick;
        int24 truncatedTick = tick;

        // Apply tick capping
        if (maxTicksPerObservation > 0) {
            if (movement > maxTicksPerObservation) {
                truncatedTick = prevTick + maxTicksPerObservation;
                tickWasCapped = true;
            } else if (movement < -maxTicksPerObservation) {
                truncatedTick = prevTick - maxTicksPerObservation;
                tickWasCapped = true;
            }
        }

        if (tickWasCapped) {
            emit TickWasCapped(tick, truncatedTick, movement);
        }

        // Calculate time delta
        uint32 delta = uint32(block.timestamp) - prevObs.blockTimestamp;
        if (delta == 0) return tickWasCapped; // Same block, skip

        // Calculate new cumulatives
        int56 newTickCumulative = prevObs.tickCumulative + int56(tick) * int56(int32(delta));
        int56 newTickCumulativeTruncated = prevObs.tickCumulativeTruncated + int56(truncatedTick) * int56(int32(delta));

        uint160 newSecondsPerLiquidity = prevObs.secondsPerLiquidityCumulativeX128;
        if (liquidity > 0) {
            // secondsPerLiquidityCumulativeX128 += (delta << 128) / liquidity
            newSecondsPerLiquidity += uint160((uint256(delta) << 128) / liquidity);
        }

        // Grow observation ring buffer (counts only initialized slots)
        uint16 cardinalityNext = observationState.cardinalityNext;
        if (cardinalityNext < MAX_CARDINALITY) {
            cardinalityNext++;
            observationState.cardinalityNext = cardinalityNext;
        }

        uint16 newIndex = (observationState.index + 1) % cardinalityNext;

        // Write new observation
        observations[newIndex] = Observation({
            blockTimestamp: uint32(block.timestamp),
            tickCumulative: newTickCumulative,
            tickCumulativeTruncated: newTickCumulativeTruncated,
            secondsPerLiquidityCumulativeX128: newSecondsPerLiquidity,
            prevTruncatedTick: truncatedTick,
            initialized: true
        });

        observationState.index = newIndex;
        // Grow while the ring is expanding. Keying on stale `initialized` flags
        // permanently bricks growth after pool-identity reset.
        if (observationState.cardinality < cardinalityNext) {
            observationState.cardinality++;
        }
        lastObservationTimestamp = uint32(block.timestamp);

        emit ObservationRecorded(newIndex, tick, truncatedTick, uint32(block.timestamp));
    }

    /**
     * @notice Update cap frequency and auto-tune
     */
    function _updateCapFrequency(bool capOccurred) internal {
        uint32 nowTs = uint32(block.timestamp);
        uint32 lastTs = uint32(tickCapState.lastCapUpdate);
        uint32 elapsed = nowTs - lastTs;

        if (!capOccurred && elapsed == 0) return;

        tickCapState.lastCapUpdate = uint48(nowTs);
        uint64 currentFreq = tickCapState.capFrequency;

        // Add cap contribution
        // FIX: M-8 — use saturating addition; previous overflow detection missed
        // cases where wrapped value was still >= ONE_DAY_PPM, causing false frequency
        // reset and aggressive tick cap tightening
        if (capOccurred) {
            uint64 newFreq = currentFreq + ONE_DAY_PPM;
            currentFreq = newFreq < currentFreq ? type(uint64).max : newFreq;
        }

        // Apply decay
        if (!capOccurred && elapsed > 0 && currentFreq > 0) {
            uint32 decayWindow = tickCapPolicy.decayWindowSec;
            if (elapsed >= decayWindow) {
                currentFreq = 0;
            } else {
                uint64 decayFactor = PPM - (uint64(elapsed) * PPM / decayWindow);
                currentFreq = uint64(uint128(currentFreq) * decayFactor / PPM);
            }
        }

        tickCapState.capFrequency = currentFreq;

        // Auto-tune
        if (elapsed >= tickCapPolicy.updateIntervalSec) {
            _autoTuneTickCap(currentFreq);
        }
    }

    /**
     * @notice Auto-tune tick cap
     */
    function _autoTuneTickCap(uint64 currentFreq) internal {
        uint64 targetFreq = uint64(tickCapPolicy.budgetPpm) * uint64(tickCapPolicy.decayWindowSec);

        int24 currentCap = maxTicksPerObservation;
        uint256 capAbs = currentCap >= 0 ? uint256(uint24(currentCap)) : uint256(uint24(-currentCap));
        int24 change = int24(int256(capAbs * uint256(tickCapPolicy.stepBps) / 10000));
        if (change == 0) change = 1;

        int24 newCap;
        if (currentFreq > targetFreq) {
            // Too many cap hits imply increased turbulence/risk; tighten.
            newCap = currentCap - change;
            if (newCap < tickCapPolicy.minCap) newCap = tickCapPolicy.minCap;
        } else {
            // Too few cap hits imply room to relax cap strictness.
            newCap = currentCap + change;
            if (newCap > tickCapPolicy.maxCap) newCap = tickCapPolicy.maxCap;
        }

        if (newCap != currentCap) {
            maxTicksPerObservation = newCap;
            emit MaxTicksUpdated(currentCap, newCap, true);
        }
    }

    // ================================
    // TWAP - PRICE CALCULATION
    // ================================

    /**
     * @notice Get current tick from V4 pool
     */
    function getCurrentTick() external view returns (int24 tick) {
        if (!v4PoolConfigured) revert V4NotConfigured();
        PoolId poolId = assetPoolKey.toId();
        (, tick,,) = poolManager.getSlot0(poolId);
    }

    /**
     * @notice Calculate TWAP tick
     * @param duration Lookback duration in seconds
     */
    function getTWAPTick(uint32 duration) public view returns (int24 twapTick) {
        if (observationState.cardinality < 2) revert NeedMoreObservations();
        if (duration < MIN_TWAP_DURATION) revert InvalidDuration();
        if (!_hasRecentObservationWindow(duration)) revert StaleObservationWindow();

        uint16 currentIndex = observationState.index;
        Observation storage currentObs = observations[currentIndex];
        if (!currentObs.initialized) revert NeedMoreObservations();

        // Find oldest observation within duration
        uint32 targetTime = uint32(block.timestamp) - duration;
        uint16 oldIndex = _findObservationBefore(targetTime);

        Observation storage oldObs = observations[oldIndex];
        if (!oldObs.initialized) revert NeedMoreObservations();

        uint32 timeDelta = currentObs.blockTimestamp - oldObs.blockTimestamp;
        if (timeDelta == 0) revert NeedMoreObservations();

        int56 tickCumulativeDelta = useTruncatedTick
            ? currentObs.tickCumulativeTruncated - oldObs.tickCumulativeTruncated
            : currentObs.tickCumulative - oldObs.tickCumulative;

        int56 timeDelta56 = int56(int32(timeDelta));
        int56 meanTick = tickCumulativeDelta / timeDelta56;
        if (tickCumulativeDelta < 0 && (tickCumulativeDelta % timeDelta56 != 0)) meanTick--;
        twapTick = int24(meanTick);
    }

    /**
     * @notice Find observation before target time
     */
    function _findObservationBefore(uint32 targetTime) internal view returns (uint16) {
        uint16 currentIndex = observationState.index;
        // FIX: H-5 — use cardinalityNext for ring buffer traversal, not cardinality;
        // when cardinalityNext > cardinality, valid initialized observations between
        // cardinality and cardinalityNext were skipped, returning stale results and
        // shortening the effective TWAP window
        uint16 size = observationState.cardinalityNext;

        bool foundAny;
        uint16 oldestIndex = currentIndex;
        uint32 oldestTs = type(uint32).max;

        // Walk backwards through the ring (newest -> oldest)
        for (uint16 i = 0; i < size; i++) {
            uint16 checkIndex = (currentIndex + size - i) % size;
            Observation storage obs = observations[checkIndex];
            if (!obs.initialized) continue;

            foundAny = true;
            if (obs.blockTimestamp < oldestTs) {
                oldestTs = obs.blockTimestamp;
                oldestIndex = checkIndex;
            }

            if (obs.blockTimestamp <= targetTime) {
                return checkIndex;
            }
        }

        if (!foundAny) revert NeedMoreObservations();

        // Not enough history for `targetTime` → return oldest initialized observation.
        return oldestIndex;
    }

    /**
     * @notice Convert tick to price
     * @param tick The tick value
     * @return price Price in 1e18 format
     */
    function tickToPrice(int24 tick) public view returns (uint256 price) {
        price = CreatorOracleQuoteLib.tickToPrice(tick, assetIsToken0);
    }

    /**
     * @notice Get Creator/ETH TWAP price
     * @param duration TWAP duration in seconds
     * @return price Creator per ETH in 1e18
     */
    function getAssetEthTWAP(uint32 duration) public view returns (uint256 price) {
        int24 twapTick = getTWAPTick(duration);
        price = tickToPrice(twapTick);
    }

    // ================================
    // V3 TWAP - PRICE CALCULATION (CREATOR/USDC)
    // ================================

    /**
     * @notice Calculate V3 TWAP tick for the configured CREATOR/USDC pool
     * @dev Uses Uniswap V3 pool observations (TWAP), not spot `slot0`.
     */
    function getV3TWAPTick(uint32 duration) public view returns (int24 twapTick) {
        if (!v3PoolConfigured) revert V3NotConfigured();
        if (duration < MIN_TWAP_DURATION) revert InvalidDuration();
        // Observe-failure reverts with CreatorOracleQuoteLib.NeedMoreObservations (EIP-170 split).
        twapTick = CreatorOracleQuoteLib.v3TwapTick(v3Pool, duration, 0);
    }

    /**
     * @notice Get CREATOR/USD TWAP price from the configured Uniswap V3 pool
     * @param duration TWAP duration in seconds
     * @return priceUsd18 USDC per 1 CREATOR, scaled to 1e18
     */
    function getAssetUsdTWAP(uint32 duration) public view returns (uint256 priceUsd18) {
        if (!v3PoolConfigured) revert V3NotConfigured();

        int24 twapTick = getV3TWAPTick(duration);

        // Quote USDC amount for 1 CREATOR (10^creatorDecimals units)
        uint256 baseAmount = 10 ** uint256(v3CreatorDecimals);
        uint256 quoteAmount = _getQuoteAtTick(twapTick, uint128(baseAmount), v3CreatorToken, v3UsdToken);

        // Scale USDC decimals to 1e18
        if (v3UsdDecimals < 18) {
            priceUsd18 = quoteAmount * (10 ** uint256(18 - v3UsdDecimals));
        } else if (v3UsdDecimals == 18) {
            priceUsd18 = quoteAmount;
        } else {
            // guarded by setV3Pool() but keep safe
            priceUsd18 = quoteAmount / (10 ** uint256(v3UsdDecimals - 18));
        }
    }

    // ================================
    // AJNA BUCKET HELPERS
    // ================================

    /**
     * @notice Convert a Uniswap tick to an Ajna bucket index (approx)
     * @dev Approximation: AjnaIndex ≈ 4156 - floor(tick / 50)
     *      - 50 Uniswap ticks ≈ 0.5% (≈ Ajna 1.005 bucket step)
     *      - Clamped to Ajna valid range (1..7388). Note: bucket 0 is invalid on Ajna pools.
     *
     *      IMPORTANT: `tick` should represent price = (quote token) per (collateral token).
     *      For our Ajna strategy (quote=CREATOR, collateral=USDC), you want the CREATOR/USDC tick.
     */
    function tickToAjnaBucket(int24 tick) public pure returns (uint256 bucketIndex) {
        bucketIndex = CreatorOracleQuoteLib.tickToAjnaBucket(tick);
    }

    /**
     * @notice Suggested Ajna bucket from the configured CREATOR/USDC V3 TWAP tick
     * @dev Uniswap ticks are for token1/token0. We need CREATOR per USDC (quote per collateral),
     *      so we invert if CREATOR is token0 (i.e., address(creator) < address(usdc)).
     */
    function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex) {
        if (!v3PoolConfigured) revert V3NotConfigured();
        int24 twapTick = getV3TWAPTick(duration);

        int24 orientedTick = (v3CreatorToken > v3UsdToken) ? twapTick : -twapTick;
        bucketIndex = tickToAjnaBucket(orientedTick);
    }

    /**
     * @dev Minimal `getQuoteAtTick` — body lives in CreatorOracleQuoteLib (EIP-170).
     */
    function _getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        internal
        pure
        returns (uint256 quoteAmount)
    {
        quoteAmount = CreatorOracleQuoteLib.getQuoteAtTick(tick, baseAmount, baseToken, quoteToken);
    }

    /**
     * @notice Internal: Update price from TWAP
     */
    function _updatePriceFromTWAP() internal {
        // Rate limit
        if (block.timestamp - assetPriceTimestamp < priceUpdateCooldown) return;
        if (observationState.cardinality < 2) return;

        // Fixed, non-bypassable window for auto-updates.
        uint32 duration = DEFAULT_TWAP_DURATION;
        uint32 nowTs = uint32(block.timestamp);
        if (nowTs <= duration) return;
        if (!_hasRecentObservationWindow(duration)) return;

        // Require at least MIN_TWAP_DURATION of real observation history before writing a price.
        uint16 currentIndex = observationState.index;
        Observation storage currentObs = observations[currentIndex];
        if (!currentObs.initialized) return;

        uint16 oldIndex = _findObservationBefore(nowTs - duration);
        Observation storage oldObs = observations[oldIndex];
        if (!oldObs.initialized) return;

        uint32 timeDelta = currentObs.blockTimestamp - oldObs.blockTimestamp;
        if (timeDelta < MIN_TWAP_DURATION) return;

        // Get Creator/ETH TWAP
        uint256 creatorPerEth;
        try this.getAssetEthTWAP(duration) returns (uint256 price) {
            creatorPerEth = price;
        } catch {
            return;
        }

        if (creatorPerEth == 0) return;

        // H-01 / 4626-293: auto TWAP writes must not bootstrap the oracle either;
        // the first price must come from owner-only initializeAssetPrice().
        if (assetPriceUSD == 0) return;

        // Get ETH/USD from Chainlink
        if (chainlinkFeed == address(0)) return;
        if (!_sequencerIsUp()) return;

        try this._readFeedPrice18External(chainlinkFeed) returns (uint256 ethUSD18, uint256, bool ok) {
            if (!ok || ethUSD18 == 0) return;

            // USD per CREATOR = (USD per ETH) / (CREATOR per ETH)
            int256 creatorUSD = int256(Math.mulDiv(ethUSD18, 1e18, creatorPerEth));

            // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value.
            // Auto-update is called inside a swap-path try/catch; return instead of reverting.
            {
                uint256 oldP = uint256(assetPriceUSD);
                uint256 newP = creatorUSD > 0 ? uint256(creatorUSD) : 0;
                uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
                if (deviation > MAX_PRICE_DEVIATION) return;
            }

            assetPriceUSD = creatorUSD;
            assetPriceTimestamp = block.timestamp;

            emit AssetPriceUpdated(assetSymbol, creatorUSD, block.timestamp, address(this));
        } catch {
            // Chainlink failed, skip
        }
    }

    /**
     * @notice Manually update price from TWAP
     * @param twapDuration TWAP duration in seconds
     */
    function updateAssetPriceFromTWAP(uint32 twapDuration) external {
        if (block.chainid != BASE_CHAIN_ID) revert HubOnly();
        if (msg.sender != owner() && !isPriceUpdater[msg.sender]) revert Unauthorized();
        if (twapDuration < MIN_TWAP_DURATION) revert InvalidDuration();
        if (assetPriceTimestamp > 0 && block.timestamp - assetPriceTimestamp < priceUpdateCooldown) {
            revert PriceUpdateCooldown();
        }

        // USD/CREATOR = Chainlink(ETH/USD) ÷ V4_TWAP(CREATOR/ETH).
        if (!v4PoolConfigured) revert V4NotConfigured();
        if (observationState.cardinality < 2) revert NeedMoreObservations();
        if (!_hasRecentObservationWindow(twapDuration)) revert StaleObservationWindow();

        uint256 creatorPerEth = getAssetEthTWAP(twapDuration);
        if (creatorPerEth == 0) revert InvalidPrice();

        if (chainlinkFeed == address(0)) revert ZeroAddress();
        if (!_sequencerIsUp()) revert SequencerDown();

        (uint256 ethUSD18, uint256 updatedAt, bool ok) = _readFeedPrice18(chainlinkFeed);
        if (!ok || ethUSD18 == 0) {
            if (updatedAt != 0 && block.timestamp > updatedAt && block.timestamp - updatedAt > MAX_STALENESS) {
                revert StalePrice();
            }
            revert InvalidPrice();
        }

        // USD per CREATOR = (USD per ETH) / (CREATOR per ETH)
        int256 creatorUSD = int256(Math.mulDiv(ethUSD18, 1e18, creatorPerEth));

        // H-01 / 4626-293: TWAP-driven writes also must not bootstrap the oracle.
        if (assetPriceUSD == 0) revert OracleNotInitialized();

        // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value
        {
            uint256 oldP = uint256(assetPriceUSD);
            uint256 newP = creatorUSD > 0 ? uint256(creatorUSD) : 0;
            uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
            if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();
        }

        assetPriceUSD = creatorUSD;
        assetPriceTimestamp = block.timestamp;

        emit AssetPriceUpdated(assetSymbol, creatorUSD, block.timestamp, msg.sender);
    }

    /**
     * @notice Optional: update creator USD price from Uniswap V3 TWAP (CREATOR/QUOTE)
     * @dev The V3 TWAP is quote-token-denominated. When the quote token is not a
     *      USD stable (e.g. ZORA), the price is converted through `quoteUsdFeed`
     *      (or the ETH/USD feed for Base WETH quotes). With a pinned non-stable
     *      `referenceQuoteToken` and no feed configured this fails closed rather
     *      than storing a quote-denominated value as USD.
     */
    function updateAssetPriceFromV3TWAP(uint32 twapDuration) external {
        if (block.chainid != BASE_CHAIN_ID) revert HubOnly();
        if (msg.sender != owner() && !isPriceUpdater[msg.sender]) revert Unauthorized();
        if (!v3PoolConfigured) revert V3NotConfigured();
        uint32 dur = twapDuration == 0 ? v3TwapDuration : twapDuration;
        if (dur < MIN_TWAP_DURATION) revert InvalidDuration();
        if (assetPriceTimestamp > 0 && block.timestamp - assetPriceTimestamp < priceUpdateCooldown) {
            revert PriceUpdateCooldown();
        }

        uint256 quotePerCreator18 = getAssetUsdTWAP(dur);
        if (quotePerCreator18 == 0) revert InvalidPrice();

        uint256 creatorUsd18 = _convertQuoteToUsd18(quotePerCreator18, v3UsdToken);
        if (creatorUsd18 == 0) revert InvalidPrice();

        // H-01 / 4626-293: TWAP-driven writes also must not bootstrap the oracle.
        if (assetPriceUSD == 0) revert OracleNotInitialized();

        // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value
        {
            uint256 oldP = uint256(assetPriceUSD);
            uint256 deviation =
                oldP > creatorUsd18 ? ((oldP - creatorUsd18) * 1e18) / oldP : ((creatorUsd18 - oldP) * 1e18) / oldP;
            if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();
        }

        assetPriceUSD = int256(creatorUsd18);
        assetPriceTimestamp = block.timestamp;

        emit AssetPriceUpdated(assetSymbol, int256(creatorUsd18), block.timestamp, msg.sender);
    }

    // ================================
    // LAYERZERO - CROSS-CHAIN
    // ================================

    /**
     * @notice Broadcast price to other chains with per-destination LayerZero fees
     * @dev FIX: M-01 (4626-310) — the previous equal-split broadcast variant
     *      divided `msg.value / dstEids.length` and used that as the fee for every
     *      destination. LayerZero fees differ per destination chain, so any chain whose
     *      real fee exceeds the split amount reverts mid-loop and the broadcast
     *      partially fails. This overload requires the caller to pass a `fees` array
     *      parallel to `dstEids`; the correct way to populate it is to call
     *      `quote()` once per destination and pass the returned native fees here.
     *      The old method is preserved for backwards compatibility.
     * @param dstEids    Destination chain EIDs
     * @param options    LayerZero options (shared across destinations)
     * @param fees       Native LayerZero fee per destination, in the same order as dstEids
     */
    function broadcastAssetPriceWithFees(
        uint32[] calldata dstEids,
        bytes calldata options,
        uint256[] calldata fees
    ) external payable returns (MessagingReceipt[] memory receipts) {
        if (assetPriceUSD <= 0) revert InvalidPrice();
        if (!isPriceUpdater[msg.sender] && msg.sender != owner()) revert Unauthorized();
        if (dstEids.length == 0) revert NoDestinations();
        if (dstEids.length != fees.length) revert BroadcastLengthMismatch();

        uint256 totalFees;
        for (uint256 i = 0; i < fees.length; i++) {
            if (fees[i] == 0) revert ZeroBroadcastFee();
            totalFees += fees[i];
        }
        if (msg.value < totalFees) revert InsufficientBroadcastFee();

        receipts = new MessagingReceipt[](dstEids.length);
        bytes memory payload = abi.encode(assetPriceUSD, assetPriceTimestamp, assetSymbol);

        for (uint256 i = 0; i < dstEids.length; i++) {
            receipts[i] = _lzSend(dstEids[i], payload, options, MessagingFee(fees[i], 0), payable(msg.sender));
        }

        uint256 remainder = msg.value - totalFees;
        if (remainder > 0) {
            (bool ok,) = payable(msg.sender).call{value: remainder}("");
            if (!ok) revert BroadcastRefundFailed();
        }

        emit AssetPriceBroadcast(dstEids, assetPriceUSD, assetPriceTimestamp);
    }

    /// @dev Override LayerZero default behavior to allow multi-destination broadcasts in one transaction.
    ///      The contract spends from its balance (funded by `msg.value`) across multiple `_lzSend` calls.
    function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
        if (address(this).balance < _nativeFee) revert NotEnoughNative(msg.value);
        return _nativeFee;
    }

    /**
     * @notice Receive price from Base
     * @dev M-06: apply the same deviation clamp / bounds as AgentOracle remote receive so a
     *      compromised or buggy hub cannot jump remote price arbitrarily while still fresh.
     */
    function _lzReceive(Origin calldata origin, bytes32, bytes calldata payload, address, bytes calldata)
        internal
        override
    {
        // Defense-in-depth: even if peers are configured for outbound sends on the hub,
        // only accept price updates that originate from the canonical hub/Base EID.
        if (origin.srcEid != BASE_EID) revert InvalidOriginEid(origin.srcEid);

        (int256 price, uint256 timestamp, string memory symbol) = abi.decode(payload, (int256, uint256, string));

        if (price <= 0) {
            emit RemotePriceUpdateSkipped(origin.srcEid, price, block.timestamp, "invalid_non_positive");
            return;
        }

        // Clamp to prevent freshness spoofing and future-timestamp underflow in staleness checks.
        uint256 safeTimestamp = timestamp > block.timestamp ? block.timestamp : timestamp;

        // Defense-in-depth: ignore out-of-order updates so delayed/replayed packets cannot roll back freshness.
        if (assetPriceTimestamp != 0 && safeTimestamp < assetPriceTimestamp) {
            emit RemotePriceUpdateSkipped(origin.srcEid, price, safeTimestamp, "out_of_order");
            return;
        }
        if (price > MAX_INITIAL_PRICE_USD) {
            emit RemotePriceUpdateSkipped(origin.srcEid, price, safeTimestamp, "invalid_out_of_bounds");
            return;
        }
        if (assetPriceUSD > 0) {
            uint256 oldP = uint256(assetPriceUSD);
            uint256 newP = uint256(price);
            uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
            if (deviation > MAX_PRICE_DEVIATION) {
                uint256 maxStep = Math.mulDiv(oldP, MAX_PRICE_DEVIATION, 1e18);
                if (maxStep == 0) maxStep = 1;
                if (newP > oldP) {
                    newP = oldP + maxStep;
                } else {
                    newP = oldP > maxStep ? oldP - maxStep : 1;
                }
                emit RemotePriceUpdateClamped(origin.srcEid, price, int256(newP), safeTimestamp);
                price = int256(newP);
            }
        }

        assetPriceUSD = price;
        assetPriceTimestamp = safeTimestamp;

        // Update symbol if different (for multi-creator support)
        if (bytes(symbol).length > 0) {
            assetSymbol = symbol;
        }

        emit AssetPriceReceived(origin.srcEid, price, safeTimestamp);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Get observation state
     */
    function getObservationState()
        external
        view
        returns (uint16 index, uint16 cardinality, uint16 cardinalityNext, uint32 lastTimestamp)
    {
        return (
            observationState.index,
            observationState.cardinality,
            observationState.cardinalityNext,
            lastObservationTimestamp
        );
    }

    /**
     * @notice Get tick cap state
     */
    function getTickCapState() external view returns (int24 currentCap, uint64 capFrequency, bool autoTunePaused) {
        return (maxTicksPerObservation, tickCapState.capFrequency, tickCapState.autoTunePaused);
    }

    /**
     * @notice Check if price is fresh
     */
    function isPriceFresh() external view returns (bool) {
        return assetPriceUSD > 0 && block.timestamp - assetPriceTimestamp < MAX_STALENESS;
    }

    /// @dev Chainlink sequencer feeds return 0 when the sequencer is up, 1 when down.
    /// @dev FIX: M-1 (audit `docs/audits/aristotle/oracle`) — the L2 sequencer uptime
    ///      feed only emits a new round when the sequencer's status *transitions*
    ///      (up<->down), so `updatedAt`/`startedAt` are legitimately far in the past
    ///      during long stretches of healthy uptime. Applying `MAX_STALENESS` to this
    ///      feed (as before) fails closed a couple of hours after any status change,
    ///      bricking every price-update path. The freshness/heartbeat check remains on
    ///      the *price* feeds only (`_readFeedPrice18`), never on this status feed.
    /// @dev FIX: L-1 — require `SEQUENCER_GRACE_PERIOD` to elapse since the last status
    ///      transition (`startedAt`) before trusting an "up" answer, per Chainlink's
    ///      reference sequencer-uptime pattern. This also naturally rejects a future
    ///      `startedAt` (spoofed/misreporting feed), which would otherwise underflow.
    function _sequencerIsUp() internal view returns (bool) {
        return CreatorOracleQuoteLib.sequencerIsUp(sequencerUptimeFeed, SEQUENCER_GRACE_PERIOD);
    }

    /// @notice External wrapper used in try/catch to keep auto-path fail-open.
    function _readFeedPrice18External(address feed) external view returns (uint256 price18, uint256 updatedAt, bool ok) {
        require(msg.sender == address(this), "Only self");
        return _readFeedPrice18(feed);
    }

    /// @dev Convert a quote-token-denominated 1e18 amount to USD 1e18.
    ///      Resolution order: explicit `quoteUsdFeed` → ETH/USD `chainlinkFeed` when the
    ///      quote token is Base WETH → legacy 1:1 USD-stable assumption only when no
    ///      `referenceQuoteToken` is pinned. A pinned quote token without a feed fails
    ///      closed with `MissingQuoteUsdFeed`.
    function _convertQuoteToUsd18(uint256 amountQuote18, address quoteToken) internal view returns (uint256 usd18) {
        if (!_sequencerIsUp()) revert SequencerDown();
        address feed = quoteUsdFeed;
        if (feed == address(0) && quoteToken == BASE_WETH) {
            feed = chainlinkFeed;
        }
        if (feed == address(0)) {
            if (referenceQuoteToken != address(0)) revert MissingQuoteUsdFeed(quoteToken);
            return amountQuote18; // legacy USD-stable quote (e.g. USDC)
        }
        (uint256 quoteUsd18, uint256 updatedAt, bool ok) = _readFeedPrice18(feed);
        if (!ok || quoteUsd18 == 0) {
            if (updatedAt != 0 && block.timestamp > updatedAt && block.timestamp - updatedAt > MAX_STALENESS) {
                revert StalePrice();
            }
            revert InvalidPrice();
        }
        usd18 = Math.mulDiv(amountQuote18, quoteUsd18, 1e18);
    }

    /// @dev Robust Chainlink-style feed read normalized to 1e18 (body in QuoteLib).
    function _readFeedPrice18(address feed) internal view returns (uint256 price18, uint256 updatedAt, bool ok) {
        return CreatorOracleQuoteLib.readFeedPrice18(feed, MAX_STALENESS);
    }

    function _requirePendingReady(bool queued, uint48 executeAfter) internal view {
        if (!queued) revert CriticalConfigNotQueued();
        if (block.timestamp < executeAfter) revert CriticalConfigNotReady(executeAfter);
    }

    function _consumePendingAddress(PendingAddressConfig storage pending) internal returns (address value) {
        _requirePendingReady(pending.queued, pending.executeAfter);
        value = pending.value;
        pending.value = address(0);
        pending.executeAfter = 0;
        pending.queued = false;
    }

    function _hasRecentObservationWindow(uint32 duration) internal view returns (bool) {
        if (observationState.cardinality < 2) return false;

        uint16 currentIndex = observationState.index;
        Observation storage currentObs = observations[currentIndex];
        if (!currentObs.initialized) return false;

        uint32 currentTs = currentObs.blockTimestamp;
        if (currentTs > block.timestamp) return false;

        // The latest observation must be reasonably fresh relative to the requested window.
        if (block.timestamp - currentTs > duration) return false;

        uint32 targetTime = uint32(block.timestamp) - duration;
        uint16 oldIndex = _findObservationBefore(targetTime);
        Observation storage oldObs = observations[oldIndex];
        if (!oldObs.initialized) return false;

        uint32 realizedWindow = currentTs - oldObs.blockTimestamp;
        return realizedWindow >= MIN_TWAP_DURATION;
    }

    function renounceOwnership() public view override onlyOwner {
        revert RenounceOwnershipDisabled();
    }

    function _criticalConfigDelayActive() internal view returns (bool) {
        return assetPriceUSD > 0;
    }

    function _criticalConfigExecuteAfter() internal view returns (uint48) {
        return uint48(block.timestamp + CRITICAL_CONFIG_DELAY);
    }

    function _applyChainlinkFeed(address _feed) internal {
        if (_feed == address(0)) revert ZeroAddress();
        chainlinkFeed = _feed;
        emit ChainlinkFeedSet(_feed);
    }

    function _applySequencerUptimeFeed(address _feed) internal {
        sequencerUptimeFeed = _feed;
        emit SequencerUptimeFeedSet(_feed);
    }

    function _applyQuoteUsdFeed(address _feed) internal {
        quoteUsdFeed = _feed;
        emit QuoteUsdFeedSet(_feed);
    }

    function _applyPriceUpdater(address updater, bool authorized) internal {
        if (updater == address(0)) revert ZeroAddress();
        isPriceUpdater[updater] = authorized;
        emit PriceUpdaterSet(updater, authorized);
    }

    function _applyV3Pool(address _pool, address _creatorToken, address _usdToken, uint32 _twapDuration) internal {
        (uint8 creatorDec, uint8 usdDec) = _validateV3PoolConfig(_pool, _creatorToken, _usdToken, _twapDuration);

        v3Pool = _pool;
        v3CreatorToken = _creatorToken;
        v3UsdToken = _usdToken;
        v3CreatorDecimals = creatorDec;
        v3UsdDecimals = usdDec;
        v3TwapDuration = _twapDuration;
        v3PoolConfigured = true;

        emit V3PoolConfigured(_pool, _creatorToken, _usdToken, _twapDuration);
    }

    function _applyV4Pool(address _poolManager, PoolKey memory _poolKey, bool _assetIsToken0) internal {
        (PoolId poolId, int24 tick, bool derivedAssetIsToken0) = _validateV4PoolConfig(_poolManager, _poolKey, _assetIsToken0);
        IPoolManager newPoolManager = IPoolManager(_poolManager);

        bool poolIdentityChanged = !v4PoolConfigured || address(poolManager) != _poolManager
            || PoolId.unwrap(assetPoolKey.toId()) != PoolId.unwrap(poolId) || assetIsToken0 != derivedAssetIsToken0;

        poolManager = newPoolManager;
        assetPoolKey = _poolKey;
        assetIsToken0 = derivedAssetIsToken0;
        v4PoolConfigured = true;

        if (poolIdentityChanged || observationState.cardinality == 0) {
            // Clear prior-generation ring slots before shrinking cardinalityNext. Otherwise
            // leftover `initialized=true` flags make `_recordObservation` skip cardinality
            // growth forever (wasInitialized stays true for every reused index).
            uint16 oldCardinalityNext = observationState.cardinalityNext;
            for (uint16 i = 1; i < oldCardinalityNext;) {
                delete observations[i];
                unchecked {
                    ++i;
                }
            }

            observations[0] = Observation({
                blockTimestamp: uint32(block.timestamp),
                tickCumulative: 0,
                tickCumulativeTruncated: 0,
                secondsPerLiquidityCumulativeX128: 0,
                prevTruncatedTick: tick,
                initialized: true
            });

            observationState = ObservationState({index: 0, cardinality: 1, cardinalityNext: 1});
        }

        lastObservationTimestamp = uint32(block.timestamp);
        tickCapState.lastCapUpdate = uint48(block.timestamp);

        emit V4PoolConfigured(poolId, _poolManager, derivedAssetIsToken0);
    }

    function _validateV3PoolConfig(address _pool, address _creatorToken, address _usdToken, uint32 _twapDuration)
        internal
        view
        returns (uint8 creatorDec, uint8 usdDec)
    {
        if (_pool == address(0) || _creatorToken == address(0) || _usdToken == address(0)) {
            revert ZeroAddress();
        }
        address expectedQuoteToken = referenceQuoteToken;
        if (expectedQuoteToken != address(0) && _usdToken != expectedQuoteToken) {
            revert InvalidReferenceQuoteToken(expectedQuoteToken, _usdToken);
        }
        if (_twapDuration < MIN_TWAP_DURATION) revert InvalidDuration();

        address t0 = IUniswapV3Pool(_pool).token0();
        address t1 = IUniswapV3Pool(_pool).token1();
        bool ok = (t0 == _creatorToken && t1 == _usdToken) || (t0 == _usdToken && t1 == _creatorToken);
        if (!ok) revert InvalidV3Pool();

        uint128 poolLiquidity = IUniswapV3Pool(_pool).liquidity();
        if (poolLiquidity < MIN_V3_ORACLE_LIQUIDITY) {
            revert V3PoolLiquidityTooLow(poolLiquidity, MIN_V3_ORACLE_LIQUIDITY);
        }

        creatorDec = IERC20Metadata(_creatorToken).decimals();
        usdDec = IERC20Metadata(_usdToken).decimals();
        if (creatorDec > 18 || usdDec > 18) revert UnsupportedDecimals();
    }

    function _validateV4PoolConfig(address _poolManager, PoolKey memory _poolKey, bool _assetIsToken0)
        internal
        view
        returns (PoolId poolId, int24 tick, bool derivedAssetIsToken0)
    {
        if (_poolManager == address(0)) revert ZeroAddress();

        poolId = _poolKey.toId();

        address c0 = Currency.unwrap(_poolKey.currency0);
        address c1 = Currency.unwrap(_poolKey.currency1);
        bool token0IsEthQuote = c0 == address(0) || c0 == BASE_WETH;
        bool token1IsEthQuote = c1 == address(0) || c1 == BASE_WETH;
        if (token0IsEthQuote == token1IsEthQuote) revert InvalidV4Pool();

        derivedAssetIsToken0 = !token0IsEthQuote;
        if (_assetIsToken0 != derivedAssetIsToken0) revert InvalidV4Pool();

        address creatorToken = derivedAssetIsToken0 ? c0 : c1;
        if (creatorToken == address(0) || creatorToken == BASE_WETH) revert InvalidV4Pool();
        if (IERC20Metadata(creatorToken).decimals() > 18) revert UnsupportedDecimals();

        IPoolManager newPoolManager = IPoolManager(_poolManager);
        (uint160 sqrtPriceX96, int24 poolTick,,) = newPoolManager.getSlot0(poolId);
        if (sqrtPriceX96 == 0 || newPoolManager.getLiquidity(poolId) == 0) revert InvalidV4Pool();
        tick = poolTick;
    }
}
