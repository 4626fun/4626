// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IRegistry4626} from "@4626/shared/interfaces/core/IRegistry4626.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IUniswapV3Pool} from "@4626/shared/interfaces/uniswap/IUniswapV3Pool.sol";
import {TickMathCompat} from "@4626/shared/libraries/uniswap/TickMathCompat.sol";

import {IOracle4626} from "@4626/shared/interfaces/oracles/IOracle4626.sol";

/**
 * @title AgentOracle
 * @author 0xakita.eth (4626)
 * @notice Omnichain oracle for agent lane token price (◆ lane symbols).
 * @dev Same address on chains via CREATE2.
 *
 *      Hub: V4 TWAP + Chainlink → price → LZ broadcast.
 *      Remotes: store price for lottery/gauge.
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
contract AgentOracle is OApp, IOracle4626 {
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
    /// @notice Post-recovery grace period before a "sequencer up" status is trusted.
    uint256 public constant SEQUENCER_GRACE_PERIOD = 3600; // 1 hour

    /// @notice Default TWAP duration
    uint32 public constant DEFAULT_TWAP_DURATION = 1800; // 30 minutes

    /// @notice Minimum TWAP duration accepted by public price update functions
    uint32 public constant MIN_TWAP_DURATION = 1800; // 30 minutes

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

    // ================================
    // STATE - PRICE DATA
    // ================================

    /// @notice Agent token USD price (broadcast from Base)
    int256 public assetPriceUSD; // 1e18 format
    uint256 public assetPriceTimestamp;

    /// @notice Agent token symbol (for identification)
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

    /// @notice V4 pool key for ◆AGENT/ETH
    PoolKey public assetPoolKey;

    /// @notice Whether V4 pool is configured
    bool public v4PoolConfigured;

    /// @notice Whether agent token is token0 in the pool
    bool public assetIsToken0;

    // ================================
    // STATE - V3 POOL (AGENT/QUOTE TWAP)
    // ================================

    /// @notice Uniswap V3 pool used as primary AGENT/QUOTE oracle (optional)
    address public v3Pool;

    /// @notice Agent token used in the V3 pool (base token)
    address public v3AgentToken;

    /// @notice USD stable token used in the V3 pool (quote token, e.g. USDC)
    address public v3QuoteToken;

    /// @notice Optional reference quote token guard for V3 pricing lanes.
    /// @dev If set, `setV3Pool` requires `_quoteToken == referenceQuoteToken`.
    ///      Intended to pin AgentOracle to the agent lane quote token (e.g. VIRTUAL).
    address public referenceQuoteToken;

    /// @notice When true, reference quote token can no longer be changed.
    bool public referenceQuoteTokenLocked;

    /// @notice Cached decimals for price scaling
    uint8 public v3AgentDecimals;
    uint8 public v3QuoteDecimals;

    /// @notice Default V3 TWAP duration (seconds)
    uint32 public v3TwapDuration = DEFAULT_TWAP_DURATION;

    /// @notice Whether V3 pool is configured
    bool public v3PoolConfigured;

    // ================================
    // STATE - V2 PAIR (AGENT/QUOTE TWAP)
    // ================================

    /// @notice Uniswap V2 pair used as primary Agent/quote TWAP source (optional).
    address public v2Pair;

    /// @notice Agent token in the V2 pair.
    address public v2AgentToken;

    /// @notice Quote token in the V2 pair (e.g. VIRTUAL, WETH).
    address public v2QuoteToken;

    /// @notice Cached decimals for V2 quote scaling.
    uint8 public v2AgentDecimals;
    uint8 public v2QuoteDecimals;

    /// @notice Optional Chainlink-style feed converting the lane quote token to USD.
    /// @dev Shared by the V2 and V3 pricing lanes (both are pinned to the same
    ///      `referenceQuoteToken` when it is set). When unset, Base WETH quotes fall
    ///      back to `chainlinkFeed`; other quote tokens fail closed instead of being
    ///      silently priced as ETH or USD.
    address public quoteUsdFeed;

    /// @notice Default V2 TWAP duration (seconds)
    uint32 public v2TwapDuration = DEFAULT_TWAP_DURATION;

    /// @notice Whether V2 pair is configured.
    bool public v2PairConfigured;

    /// @notice Last recorded cumulative Agent/quote price (UQ112x112*time).
    uint256 public v2PriceCumulativeLast;

    /// @notice Last recorded V2 observation timestamp.
    uint32 public v2ObservationTimestamp;

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
    event V4PoolConfigured(PoolId indexed poolId, address poolManager, bool assetIsToken0);
    event V3PoolConfigured(
        address indexed pool, address indexed creatorToken, address indexed usdToken, uint32 twapDuration
    );
    event V2PairConfigured(
        address indexed pair, address indexed agentToken, address indexed quoteToken, uint32 twapDuration
    );
    event QuoteUsdFeedSet(address indexed feed);
    event V2ObservationRecorded(uint256 cumulativePrice, uint32 timestamp);
    event ObservationRecorded(uint16 index, int24 tick, int24 truncatedTick, uint32 timestamp);
    event SwapRecorderSet(address indexed recorder, bool authorized);
    event PriceUpdaterSet(address indexed updater, bool authorized);
    event MaxTicksUpdated(int24 oldMaxTicks, int24 newMaxTicks, bool autoTuned);
    event TickWasCapped(int24 rawTick, int24 truncatedTick, int24 movement);
    event ChainlinkFeedSet(address indexed feed);
    event SequencerUptimeFeedSet(address indexed feed);
    event ReferenceQuoteTokenSet(address indexed token);
    event ReferenceQuoteTokenLocked(address indexed token);
    // FIX: M-3 (4626-439) — emitted (via the deprecated entrypoint's revert path in tests / off-chain
    // call-simulation) so tooling can pick up migrations to broadcastAssetPriceWithFees.
    event BroadcastEqualSplitCallAttempted(address indexed caller, uint256 msgValue, uint32[] dstEids);
    event RemotePriceUpdateSkipped(uint32 indexed srcEid, int256 candidatePrice, uint256 candidateTimestamp, string reason);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error InvalidPrice();
    error Unauthorized();
    error V4NotConfigured();
    error V3NotConfigured();
    error V2NotConfigured();
    error InvalidV3Pool();
    error InvalidV2Pair();
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
    error RemoteOnly();
    error StaleObservationWindow();
    // FIX: M-3 (4626-439) — signalled when the legacy equal-split broadcast entrypoint is called.
    error BroadcastEqualSplitDeprecated();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy oracle for a Agent token
     * @param _registry Registry4626 address (same on all chains for deterministic addresses)
     * @param _chainlinkFeed Chainlink ETH/USD feed address
     * @param _assetSymbol Agent token symbol (e.g., "◆AGENT")
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
        assetSymbol = _assetSymbol; // field name kept for interface compatibility; stores agent symbol

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
        // FIX: L-3 — reject address(0) to prevent silently disabling price updates
        if (_feed == address(0)) revert ZeroAddress();
        chainlinkFeed = _feed;
        emit ChainlinkFeedSet(_feed);
    }

    /// @notice Configure optional Base sequencer uptime feed (fail-closed when down).
    function setSequencerUptimeFeed(address _feed) external onlyOwner {
        sequencerUptimeFeed = _feed;
        emit SequencerUptimeFeedSet(_feed);
    }

    /// @notice Set the required V3 quote token for this oracle lane.
    /// @dev Set to zero address to disable strict quote-token enforcement.
    function setReferenceQuoteToken(address _token) external onlyOwner {
        if (referenceQuoteTokenLocked) revert ReferenceQuoteTokenIsLocked();
        referenceQuoteToken = _token;
        emit ReferenceQuoteTokenSet(_token);
    }

    /// @notice Configure the quote-token/USD feed used by the V2 and V3 pricing lanes.
    /// @dev Set to zero address to clear. When cleared, only Base WETH quotes fall
    ///      back to `chainlinkFeed`; other quote lanes fail closed.
    function setQuoteUsdFeed(address _feed) external onlyOwner {
        quoteUsdFeed = _feed;
        emit QuoteUsdFeedSet(_feed);
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
     * @param _poolKey Pool key for ◆AGENT/ETH
     * @param _assetIsToken0 Whether agent token is currency0
     */
    function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _assetIsToken0) external onlyOwner {
        if (_poolManager == address(0)) revert ZeroAddress();

        PoolId newPoolId = _poolKey.toId();
        bool v4IdentityChanged =
            !v4PoolConfigured || address(poolManager) != _poolManager
            || PoolId.unwrap(assetPoolKey.toId()) != PoolId.unwrap(newPoolId)
            || assetIsToken0 != _assetIsToken0;

        poolManager = IPoolManager(_poolManager);
        assetPoolKey = _poolKey;
        assetIsToken0 = _assetIsToken0;
        v4PoolConfigured = true;

        // Get initial tick
        (, int24 tick,,) = poolManager.getSlot0(newPoolId);

        if (v4IdentityChanged || observationState.cardinality == 0) {
            // Reset observations when pool identity changes to avoid cross-pool TWAP contamination.
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

        emit V4PoolConfigured(newPoolId, _poolManager, _assetIsToken0);
    }

    /**
     * @notice Configure Uniswap V3 pool for AGENT/QUOTEC TWAP pricing (optional price source)
     * @param _pool Uniswap V3 pool address (must be the AGENT/QUOTEC pair)
     * @param _agentToken Agent token address
     * @param _quoteToken USD token address (e.g., USDC)
     * @param _twapDuration TWAP duration in seconds (e.g., 1800)
     */
    function setV3Pool(address _pool, address _agentToken, address _quoteToken, uint32 _twapDuration)
        external
        onlyOwner
    {
        if (_pool == address(0) || _agentToken == address(0) || _quoteToken == address(0)) {
            revert ZeroAddress();
        }
        address expectedQuoteToken = referenceQuoteToken;
        if (expectedQuoteToken != address(0) && _quoteToken != expectedQuoteToken) {
            revert InvalidReferenceQuoteToken(expectedQuoteToken, _quoteToken);
        }
        if (_twapDuration < MIN_TWAP_DURATION) revert InvalidDuration();

        address t0 = IUniswapV3Pool(_pool).token0();
        address t1 = IUniswapV3Pool(_pool).token1();
        bool ok = (t0 == _agentToken && t1 == _quoteToken) || (t0 == _quoteToken && t1 == _agentToken);
        if (!ok) revert InvalidV3Pool();

        uint8 creatorDec = IERC20Metadata(_agentToken).decimals();
        uint8 usdDec = IERC20Metadata(_quoteToken).decimals();
        if (creatorDec > 18 || usdDec > 18) revert UnsupportedDecimals();

        v3Pool = _pool;
        v3AgentToken = _agentToken;
        v3QuoteToken = _quoteToken;
        v3AgentDecimals = creatorDec;
        v3QuoteDecimals = usdDec;
        v3TwapDuration = _twapDuration;
        v3PoolConfigured = true;

        emit V3PoolConfigured(_pool, _agentToken, _quoteToken, _twapDuration);
    }

    /**
     * @notice Configure Uniswap V2 pair for AGENT/quote TWAP pricing.
     * @param _pair Uniswap V2 pair address.
     * @param _agentToken Agent token address.
     * @param _quoteToken Quote token address (e.g., VIRTUAL/WETH).
     * @param _twapDuration TWAP duration in seconds.
     */
    function setV2Pair(address _pair, address _agentToken, address _quoteToken, uint32 _twapDuration)
        external
        onlyOwner
    {
        if (_pair == address(0) || _agentToken == address(0) || _quoteToken == address(0)) revert ZeroAddress();
        address expectedQuoteToken = referenceQuoteToken;
        if (expectedQuoteToken != address(0) && _quoteToken != expectedQuoteToken) {
            revert InvalidReferenceQuoteToken(expectedQuoteToken, _quoteToken);
        }
        if (_twapDuration < MIN_TWAP_DURATION) revert InvalidDuration();

        address t0 = IUniswapV2Pair(_pair).token0();
        address t1 = IUniswapV2Pair(_pair).token1();
        bool ok = (t0 == _agentToken && t1 == _quoteToken) || (t0 == _quoteToken && t1 == _agentToken);
        if (!ok) revert InvalidV2Pair();

        uint8 agentDec = IERC20Metadata(_agentToken).decimals();
        uint8 quoteDec = IERC20Metadata(_quoteToken).decimals();
        if (agentDec > 18 || quoteDec > 18) revert UnsupportedDecimals();

        v2Pair = _pair;
        v2AgentToken = _agentToken;
        v2QuoteToken = _quoteToken;
        v2AgentDecimals = agentDec;
        v2QuoteDecimals = quoteDec;
        v2TwapDuration = _twapDuration;
        v2PairConfigured = true;

        (uint256 cumulativePrice, uint32 ts) = _currentV2CumulativeAssetPerQuote();
        v2PriceCumulativeLast = cumulativePrice;
        v2ObservationTimestamp = ts;

        emit V2PairConfigured(_pair, _agentToken, _quoteToken, _twapDuration);
        emit V2ObservationRecorded(cumulativePrice, ts);
    }

    /**
     * @notice Record V2 cumulative observation for TWAP.
     * @dev Permissionless; records current cumulative and timestamp.
     */
    function recordV2Observation() external {
        if (!v2PairConfigured) revert V2NotConfigured();
        if (msg.sender != owner() && !isSwapRecorder[msg.sender]) revert Unauthorized();
        (uint256 cumulativePrice, uint32 ts) = _currentV2CumulativeAssetPerQuote();
        v2PriceCumulativeLast = cumulativePrice;
        v2ObservationTimestamp = ts;
        emit V2ObservationRecorded(cumulativePrice, ts);
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
        isPriceUpdater[updater] = authorized;
        emit PriceUpdaterSet(updater, authorized);
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
        require(_minCap > 0 && _maxCap > _minCap, "Invalid range");
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
        require(cooldown <= 300, "Max 5 minutes");
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
     * @notice Get Agent token USD price
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getAssetPrice() external view returns (int256 price, uint256 timestamp) {
        return _getPrice();
    }

    /// @dev Legacy getter alias kept for ABI compatibility with existing tooling.
    function v3UsdToken() external view returns (address) {
        return v3QuoteToken;
    }

    /// @dev Legacy getter alias kept for ABI compatibility with existing tooling.
    function v3UsdDecimals() external view returns (uint8) {
        return v3QuoteDecimals;
    }

    function _getPrice() internal view returns (int256 price, uint256 timestamp) {
        if (assetPriceUSD > 0 && assetPriceTimestamp > 0) {
            if (block.timestamp - assetPriceTimestamp < MAX_STALENESS) {
                return (assetPriceUSD, assetPriceTimestamp);
            }
        }
        return (0, 0);
    }

    /**
     * @notice Update agent price (authorized callers only)
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
     * @notice Owner-only bootstrap of the first agent price. Every other
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

    /**
     * @notice Owner emergency path to recover a stale remote oracle state.
     * @dev Remote-only: hub price source should continue using normal update/broadcast lanes.
     *      This is intentionally owner-gated for operations use during sustained packet
     *      delay/loss or repeated deviation rejections on remotes.
     */
    function forceSyncRemotePrice(int256 _price, uint256 _timestamp, string calldata _symbol) external onlyOwner {
        if (block.chainid == BASE_CHAIN_ID) revert RemoteOnly();
        if (_price <= 0 || _price > MAX_INITIAL_PRICE_USD) revert InvalidPrice();
        if (_timestamp > block.timestamp) revert InvalidPrice();
        if (assetPriceTimestamp != 0 && _timestamp < assetPriceTimestamp) revert InvalidPrice();

        assetPriceUSD = _price;
        assetPriceTimestamp = _timestamp;
        if (bytes(_symbol).length > 0) {
            assetSymbol = _symbol;
        }

        emit AssetPriceUpdated(assetSymbol, _price, _timestamp, msg.sender);
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
        bool wasInitialized = observations[newIndex].initialized;

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
        if (!wasInitialized && observationState.cardinality < cardinalityNext) {
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
        if (duration == 0) revert InvalidDuration();

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

        twapTick = int24(tickCumulativeDelta / int56(int32(timeDelta)));
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
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        uint256 sqrtPrice = uint256(sqrtPriceX96);

        // price = (sqrtPriceX96 / 2^96)^2, scaled to 1e18.
        // Use full-precision math to avoid overflow at valid tick bounds.
        if (sqrtPriceX96 <= type(uint128).max) {
            uint256 ratioX192 = sqrtPrice * sqrtPrice;
            price = Math.mulDiv(ratioX192, 1e18, uint256(1) << 192);
        } else {
            uint256 ratioX128 = Math.mulDiv(sqrtPrice, sqrtPrice, uint256(1) << 64);
            price = Math.mulDiv(ratioX128, 1e18, uint256(1) << 128);
        }

        // Invert if agent is token0
        if (assetIsToken0 && price > 0) {
            price = (1e18 * 1e18) / price;
        }
    }

    /**
     * @notice Get Agent/ETH TWAP price
     * @param duration TWAP duration in seconds
     * @return price Agent per ETH in 1e18
     */
    function getAssetEthTWAP(uint32 duration) public view returns (uint256 price) {
        int24 twapTick = getTWAPTick(duration);
        price = tickToPrice(twapTick);
    }

    // ================================
    // V3 TWAP - PRICE CALCULATION (AGENT/QUOTEC)
    // ================================

    /**
     * @notice Calculate V3 TWAP tick for the configured AGENT/QUOTEC pool
     * @dev Uses Uniswap V3 pool observations (TWAP), not spot `slot0`.
     */
    function getV3TWAPTick(uint32 duration) public view returns (int24 twapTick) {
        if (!v3PoolConfigured) revert V3NotConfigured();
        if (duration == 0) revert InvalidDuration();

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = duration;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives,) = IUniswapV3Pool(v3Pool).observe(secondsAgos);
        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int56 timeDelta = int56(uint56(duration));

        int56 meanTick = tickDelta / timeDelta;
        // Uniswap V3 standard: round toward negative infinity
        if (tickDelta < 0 && (tickDelta % timeDelta != 0)) meanTick--;

        twapTick = int24(meanTick);
    }

    /**
     * @notice Get AGENT/QUOTE TWAP price from the configured Uniswap V3 pool
     * @param duration TWAP duration in seconds
     * @return priceUsd18 USDC per 1 CREATOR, scaled to 1e18
     */
    function getAssetUsdTWAP(uint32 duration) public view returns (uint256 priceUsd18) {
        if (!v3PoolConfigured) revert V3NotConfigured();

        int24 twapTick = getV3TWAPTick(duration);

        // Quote USDC amount for 1 CREATOR (10^creatorDecimals units)
        uint256 baseAmount = 10 ** uint256(v3AgentDecimals);
        uint256 quoteAmount = _getQuoteAtTick(twapTick, uint128(baseAmount), v3AgentToken, v3QuoteToken);

        // Scale USDC decimals to 1e18
        if (v3QuoteDecimals < 18) {
            priceUsd18 = quoteAmount * (10 ** uint256(18 - v3QuoteDecimals));
        } else if (v3QuoteDecimals == 18) {
            priceUsd18 = quoteAmount;
        } else {
            // guarded by setV3Pool() but keep safe
            priceUsd18 = quoteAmount / (10 ** uint256(v3QuoteDecimals - 18));
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
     *      For our Ajna strategy (quote=CREATOR, collateral=USDC), you want the AGENT/QUOTEC tick.
     */
    function tickToAjnaBucket(int24 tick) public pure returns (uint256 bucketIndex) {
        int256 t = int256(tick);
        int256 q = t / 50;
        int256 r = t % 50;

        // Solidity rounds toward 0; emulate Math.floor for negatives.
        if (t < 0 && r != 0) q -= 1;

        int256 idx = 4156 - q;
        if (idx < 1) idx = 1;
        if (idx > 7388) idx = 7388;
        bucketIndex = uint256(idx);
    }

    /**
     * @notice Suggested Ajna bucket from the configured AGENT/QUOTEC V3 TWAP tick
     * @dev Uniswap ticks are for token1/token0. We need agent-token per USDC (quote per collateral),
     *      so we invert if CREATOR is token0 (i.e., address(creator) < address(usdc)).
     */
    function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex) {
        if (!v3PoolConfigured) revert V3NotConfigured();
        int24 twapTick = getV3TWAPTick(duration);

        int24 orientedTick = (v3AgentToken > v3QuoteToken) ? twapTick : -twapTick;
        bucketIndex = tickToAjnaBucket(orientedTick);
    }

    /**
     * @dev Minimal `getQuoteAtTick` (Uniswap V3 OracleLibrary-style) without importing v3-core FullMath.
     *      Uses TickMathCompat + OpenZeppelin Math.mulDiv for full-precision mul/div.
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

    /**
     * @notice Get Agent/quote TWAP from configured Uniswap V2 pair.
     * @dev Returns Agent-per-quote in 1e18 precision.
     */
    function getV2AssetQuoteTWAP(uint32 duration) public view returns (uint256 agentPerQuote18) {
        if (!v2PairConfigured) revert V2NotConfigured();
        if (duration == 0) revert InvalidDuration();
        if (v2ObservationTimestamp == 0) revert NeedMoreObservations();

        (uint256 currentCumulative, uint32 currentTs) = _currentV2CumulativeAssetPerQuote();
        uint32 timeElapsed = currentTs - v2ObservationTimestamp;
        if (timeElapsed < duration) revert NeedMoreObservations();

        uint256 avgUQ112x112 = (currentCumulative - v2PriceCumulativeLast) / uint256(timeElapsed);
        // Raw V2 cumulative price is a raw-token-unit ratio (agent wei per quote wei).
        // Normalize to human units using the cached pair decimals so quote tokens
        // with fewer/more decimals than the agent token are not mispriced.
        agentPerQuote18 = Math.mulDiv(avgUQ112x112, 1e18, uint256(1) << 112);
        if (v2QuoteDecimals > v2AgentDecimals) {
            agentPerQuote18 = Math.mulDiv(agentPerQuote18, 10 ** uint256(v2QuoteDecimals - v2AgentDecimals), 1);
        } else if (v2AgentDecimals > v2QuoteDecimals) {
            agentPerQuote18 = agentPerQuote18 / (10 ** uint256(v2AgentDecimals - v2QuoteDecimals));
        }
    }

    /**
     * @dev Compute current cumulative Agent/quote price from V2 pair cumulatives plus current block extrapolation.
     */
    function _currentV2CumulativeAssetPerQuote() internal view returns (uint256 cumulativePrice, uint32 blockTimestamp) {
        IUniswapV2Pair pair = IUniswapV2Pair(v2Pair);
        blockTimestamp = uint32(block.timestamp % 2 ** 32);

        uint256 price0Cumulative = pair.price0CumulativeLast();
        uint256 price1Cumulative = pair.price1CumulativeLast();
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = pair.getReserves();

        if (blockTimestampLast != blockTimestamp) {
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            if (reserve0 > 0 && reserve1 > 0) {
                uint256 price0 = (uint256(reserve1) << 112) / uint256(reserve0); // token1 per token0
                uint256 price1 = (uint256(reserve0) << 112) / uint256(reserve1); // token0 per token1
                price0Cumulative += price0 * timeElapsed;
                price1Cumulative += price1 * timeElapsed;
            }
        }

        bool quoteIsToken0 = pair.token0() == v2QuoteToken;
        // We need Agent per Quote:
        // - if quote is token0, take price0 (token1/token0 = agent/quote)
        // - if quote is token1, take price1 (token0/token1 = agent/quote)
        cumulativePrice = quoteIsToken0 ? price0Cumulative : price1Cumulative;
    }

    /**
     * @notice Internal: Update price from TWAP
     */
    function _updatePriceFromTWAP() internal {
        // Rate limit
        if (block.timestamp - assetPriceTimestamp < priceUpdateCooldown) return;
        // Prefer V2 Agent/quote TWAP when configured; fallback to legacy V4 Agent/ETH TWAP.
        uint256 agentPerQuote;
        if (v2PairConfigured) {
            try this.getV2AssetQuoteTWAP(v2TwapDuration) returns (uint256 price) {
                agentPerQuote = price;
            } catch {
                return;
            }
        } else {
            if (observationState.cardinality < 2) return;
            uint32 duration = DEFAULT_TWAP_DURATION;
            uint32 nowTs = uint32(block.timestamp);
            if (nowTs <= duration) return;
            if (!_hasRecentObservationWindow(duration)) return;

            uint16 currentIndex = observationState.index;
            Observation storage currentObs = observations[currentIndex];
            if (!currentObs.initialized) return;

            uint16 oldIndex = _findObservationBefore(nowTs - duration);
            Observation storage oldObs = observations[oldIndex];
            if (!oldObs.initialized) return;

            uint32 timeDelta = currentObs.blockTimestamp - oldObs.blockTimestamp;
            if (timeDelta < MIN_TWAP_DURATION) return;

            try this.getAssetEthTWAP(duration) returns (uint256 price) {
                agentPerQuote = price;
            } catch {
                return;
            }
        }

        if (agentPerQuote == 0) return;

        // H-01 / 4626-293: auto TWAP writes must not bootstrap the oracle either;
        // the first price must come from owner-only initializeAssetPrice().
        if (assetPriceUSD == 0) return;

        // Get quote/USD from feed.
        address resolvedFeed = _resolveQuoteUsdFeed();
        if (resolvedFeed == address(0)) return;
        if (!_sequencerIsUp()) return;

        try this._readFeedPrice18External(resolvedFeed) returns (uint256 quoteUsd18, uint256, bool ok) {
            if (!ok || quoteUsd18 == 0) return;

            // USD per Agent = (USD per quote) / (Agent per quote)
            int256 agentUsd = int256(Math.mulDiv(quoteUsd18, 1e18, agentPerQuote));

            // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value.
            // Auto-update is called inside a swap-path try/catch; return instead of reverting.
            {
                uint256 oldP = uint256(assetPriceUSD);
                uint256 newP = agentUsd > 0 ? uint256(agentUsd) : 0;
                uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
                if (deviation > MAX_PRICE_DEVIATION) return;
            }

            assetPriceUSD = agentUsd;
            assetPriceTimestamp = block.timestamp;

            emit AssetPriceUpdated(assetSymbol, agentUsd, block.timestamp, address(this));
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

        // USD/Agent = (USD/quote) / (Agent/quote), preferring V2 when configured.
        uint256 agentPerQuote;
        if (v2PairConfigured) {
            uint32 dur = twapDuration == 0 ? v2TwapDuration : twapDuration;
            agentPerQuote = getV2AssetQuoteTWAP(dur);
        } else {
            if (!v4PoolConfigured) revert V4NotConfigured();
            if (observationState.cardinality < 2) revert NeedMoreObservations();
            if (!_hasRecentObservationWindow(twapDuration)) revert StaleObservationWindow();
            agentPerQuote = getAssetEthTWAP(twapDuration);
        }
        if (agentPerQuote == 0) revert InvalidPrice();

        address resolvedFeed = _resolveQuoteUsdFeed();
        if (resolvedFeed == address(0)) {
            if (v2PairConfigured) revert MissingQuoteUsdFeed(v2QuoteToken);
            revert ZeroAddress();
        }
        if (!_sequencerIsUp()) revert SequencerDown();

        (uint256 quoteUsd18, uint256 updatedAt, bool ok) = _readFeedPrice18(resolvedFeed);
        if (!ok || quoteUsd18 == 0) {
            if (updatedAt != 0 && block.timestamp > updatedAt && block.timestamp - updatedAt > MAX_STALENESS) {
                revert StalePrice();
            }
            revert InvalidPrice();
        }
        // USD per Agent = (USD per quote) / (Agent per quote)
        int256 agentUsd = int256(Math.mulDiv(quoteUsd18, 1e18, agentPerQuote));

        // H-01 / 4626-293: TWAP-driven writes also must not bootstrap the oracle.
        if (assetPriceUSD == 0) revert OracleNotInitialized();

        // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value
        {
            uint256 oldP = uint256(assetPriceUSD);
            uint256 newP = agentUsd > 0 ? uint256(agentUsd) : 0;
            uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
            if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();
        }

        assetPriceUSD = agentUsd;
        assetPriceTimestamp = block.timestamp;

        emit AssetPriceUpdated(assetSymbol, agentUsd, block.timestamp, msg.sender);
    }

    /**
     * @notice Optional: update agent USD price from Uniswap V3 TWAP (AGENT/QUOTE)
     * @dev The V3 TWAP is quote-token-denominated. When the quote token is not a
     *      USD stable, the price is converted through `quoteUsdFeed` (or the ETH/USD
     *      feed for Base WETH quotes). With a pinned non-stable `referenceQuoteToken`
     *      and no feed configured this fails closed rather than storing a
     *      quote-denominated value as USD.
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

        uint256 quotePerAgent18 = getAssetUsdTWAP(dur);
        if (quotePerAgent18 == 0) revert InvalidPrice();

        uint256 creatorUsd18 = _convertQuoteToUsd18(quotePerAgent18, v3QuoteToken);
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
     * @notice DEPRECATED — see `broadcastAssetPriceWithFees`.
     * @dev FIX: M-3 (4626-439) — the equal-split variant divided `msg.value / dstEids.length`
     *      and used that as the fee for every destination. LayerZero fees differ per
     *      destination chain, so any chain whose real fee exceeded the split amount
     *      reverted mid-loop and the broadcast partially failed, while leaving excess
     *      ETH stranded on non-refund paths. Rather than carry a footgun with an
     *      attractive short signature, this entrypoint is now a hard revert that emits
     *      a migration-signal event against off-chain call simulation. Callers must
     *      switch to `broadcastAssetPriceWithFees(dstEids, options, fees)` and quote
     *      per-destination native fees via `quote()` / `endpoint.quote(...)`.
     * @custom:deprecated Use `broadcastAssetPriceWithFees` with per-chain fees.
     */
    function broadcastAssetPrice(uint32[] calldata dstEids, bytes calldata /* options */)
        external
        payable
        returns (MessagingReceipt[] memory /* receipts */)
    {
        // Emit before revert so off-chain call-simulation / trace tooling surfaces the
        // migration signal even though the transaction aborts.
        emit BroadcastEqualSplitCallAttempted(msg.sender, msg.value, dstEids);
        revert BroadcastEqualSplitDeprecated();
    }

    /**
     * @notice Broadcast price to other chains with per-destination LayerZero fees
     * @dev FIX: M-01 (4626-310) — the equal-split `broadcastAssetPrice` variant above
     *      divides `msg.value / dstEids.length` and uses that as the fee for every
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
        require(dstEids.length > 0, "No destinations");
        require(dstEids.length == fees.length, "Length mismatch");

        uint256 totalFees;
        for (uint256 i = 0; i < fees.length; i++) {
            require(fees[i] > 0, "Zero fee");
            totalFees += fees[i];
        }
        require(msg.value >= totalFees, "Insufficient fee");

        receipts = new MessagingReceipt[](dstEids.length);
        bytes memory payload = abi.encode(assetPriceUSD, assetPriceTimestamp, assetSymbol);

        for (uint256 i = 0; i < dstEids.length; i++) {
            receipts[i] = _lzSend(dstEids[i], payload, options, MessagingFee(fees[i], 0), payable(msg.sender));
        }

        uint256 remainder = msg.value - totalFees;
        if (remainder > 0) {
            (bool ok,) = payable(msg.sender).call{value: remainder}("");
            require(ok, "Refund failed");
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
                // If we are still fresh, keep strict deviation guard.
                // If already stale, accept authenticated hub price to recover liveness.
                if (block.timestamp - assetPriceTimestamp <= MAX_STALENESS) {
                    // Step-wise convergence: clamp toward hub value by one max-deviation
                    // step so remotes keep progressing even after packet loss/censorship.
                    uint256 maxStep = Math.mulDiv(oldP, MAX_PRICE_DEVIATION, 1e18);
                    if (maxStep == 0) maxStep = 1;
                    if (newP > oldP) {
                        newP = oldP + maxStep;
                    } else {
                        newP = oldP > maxStep ? oldP - maxStep : 1;
                    }
                    price = int256(newP);
                    emit RemotePriceUpdateSkipped(origin.srcEid, price, safeTimestamp, "deviation_clamped");
                }
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
    function _sequencerIsUp() internal view returns (bool) {
        address feed = sequencerUptimeFeed;
        if (feed == address(0)) return true;
        (, int256 answer, uint256 startedAt, uint256 updatedAt,) = IChainlinkFeed(feed).latestRoundData();
        if (updatedAt > block.timestamp) return false;
        if (answer != 0) return false;
        if (startedAt == 0) return false;
        if (startedAt > block.timestamp) return false;
        if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) return false;
        return true;
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
        address feed = quoteUsdFeed;
        if (feed == address(0) && quoteToken == BASE_WETH) {
            feed = chainlinkFeed;
        }
        if (feed == address(0)) {
            if (referenceQuoteToken != address(0)) revert MissingQuoteUsdFeed(quoteToken);
            return amountQuote18; // legacy USD-stable quote (e.g. USDC)
        }
        if (!_sequencerIsUp()) revert SequencerDown();
        (uint256 quoteUsd18, uint256 updatedAt, bool ok) = _readFeedPrice18(feed);
        if (!ok || quoteUsd18 == 0) {
            if (updatedAt != 0 && block.timestamp > updatedAt && block.timestamp - updatedAt > MAX_STALENESS) {
                revert StalePrice();
            }
            revert InvalidPrice();
        }
        usd18 = Math.mulDiv(amountQuote18, quoteUsd18, 1e18);
    }

    function _resolveQuoteUsdFeed() internal view returns (address feed) {
        if (!v2PairConfigured) return chainlinkFeed;
        if (quoteUsdFeed != address(0)) return quoteUsdFeed;
        // Only fallback to ETH/USD when the quote token is Base WETH.
        if (v2QuoteToken == BASE_WETH) return chainlinkFeed;
        return address(0);
    }

    function _readFeedPrice18(address feed) internal view returns (uint256 price18, uint256 updatedAt, bool ok) {
        if (feed == address(0)) return (0, 0, false);
        uint80 roundId;
        int256 answer;
        uint80 answeredInRound;
        uint256 roundUpdatedAt;
        try IChainlinkFeed(feed).latestRoundData() returns (
            uint80 _roundId, int256 _answer, uint256, uint256 _updatedAt, uint80 _answeredInRound
        ) {
            roundId = _roundId;
            answer = _answer;
            roundUpdatedAt = _updatedAt;
            answeredInRound = _answeredInRound;
        } catch {
            return (0, 0, false);
        }
        if (answer <= 0) return (0, roundUpdatedAt, false);
        if (roundUpdatedAt > block.timestamp) return (0, roundUpdatedAt, false);
        if (block.timestamp - roundUpdatedAt > MAX_STALENESS) return (0, roundUpdatedAt, false);
        if (answeredInRound < roundId) return (0, roundUpdatedAt, false);

        uint8 feedDecimals;
        try IChainlinkFeed(feed).decimals() returns (uint8 d) {
            feedDecimals = d;
        } catch {
            return (0, roundUpdatedAt, false);
        }
        if (feedDecimals > 18) return (0, roundUpdatedAt, false);

        uint256 unsignedAnswer = uint256(answer);
        if (feedDecimals < 18) {
            price18 = Math.mulDiv(unsignedAnswer, 10 ** uint256(18 - feedDecimals), 1);
        } else {
            price18 = unsignedAnswer;
        }
        return (price18, roundUpdatedAt, true);
    }

    function _hasRecentObservationWindow(uint32 duration) internal view returns (bool) {
        if (observationState.cardinality < 2) return false;

        uint16 currentIndex = observationState.index;
        Observation storage currentObs = observations[currentIndex];
        if (!currentObs.initialized) return false;

        uint32 currentTs = currentObs.blockTimestamp;
        if (currentTs > block.timestamp) return false;
        if (block.timestamp - currentTs > duration) return false;

        uint32 targetTime = currentTs > duration ? currentTs - duration : 0;
        uint16 oldIndex = _findObservationBefore(targetTime);
        Observation storage oldObs = observations[oldIndex];
        if (!oldObs.initialized) return false;

        uint32 realizedWindow = currentTs - oldObs.blockTimestamp;
        return realizedWindow >= MIN_TWAP_DURATION;
    }
}

/**
 * @notice Chainlink feed interface
 */
interface IChainlinkFeed {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function price0CumulativeLast() external view returns (uint256);
    function price1CumulativeLast() external view returns (uint256);
}
