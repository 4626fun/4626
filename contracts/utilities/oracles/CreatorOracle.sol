// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IUniswapV3Pool} from "../../interfaces/uniswap/IUniswapV3Pool.sol";
import {TickMathCompat} from "../../libraries/TickMathCompat.sol";

/**
 * @title CreatorOracle
 * @author 0xakita.eth (4626)
 * @notice Omnichain oracle for Creator Coin price distribution
 * @dev Deployed to same address on all chains via CREATE2
 *
 * @dev ARCHITECTURE:
 *      Base (Hub):
 *      - Reads V4 pool TWAP (■AKITA/ETH)
 *      - Gets ETH/USD from Chainlink
 *      - Calculates ■AKITA/USD
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
contract CreatorOracle is OApp {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Base chain ID (source of truth)
    uint256 public constant BASE_CHAIN_ID = 8453;

    /// @notice Base chain LayerZero EID (source of truth for inbound price updates)
    uint32 public immutable BASE_EID;

    /// @notice Staleness threshold for prices
    uint256 public constant MAX_STALENESS = 7200; // 2 hours

    /// @notice Default TWAP duration
    uint32 public constant DEFAULT_TWAP_DURATION = 1800; // 30 minutes

    /// @notice Minimum TWAP duration accepted by public price update functions
    uint32 public constant MIN_TWAP_DURATION = 1800; // 30 minutes

    /// @notice Maximum allowed price deviation per update (20%)
    uint256 public constant MAX_PRICE_DEVIATION = 0.2e18;

    /// @notice Hard upper bound on the first price that `initializeCreatorPrice`
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

    /// @notice Creator token USD price (broadcast from Base)
    int256 public creatorPriceUSD; // 1e18 format
    uint256 public creatorPriceTimestamp;

    /// @notice Creator token symbol (for identification)
    string public creatorSymbol;

    /// @notice Chainlink ETH/USD feed address
    address public chainlinkFeed;

    // ================================
    // STATE - V4 POOL
    // ================================

    /// @notice Uniswap V4 PoolManager
    IPoolManager public poolManager;

    /// @notice V4 pool key for ■AKITA/ETH
    PoolKey public creatorPoolKey;

    /// @notice Whether V4 pool is configured
    bool public v4PoolConfigured;

    /// @notice Whether creator token is token0 in the pool
    bool public creatorIsToken0;

    // ================================
    // STATE - V3 POOL (CREATOR/USDC TWAP)
    // ================================

    /// @notice Uniswap V3 pool used as primary CREATOR/USD oracle (optional)
    address public v3Pool;

    /// @notice Creator token used in the V3 pool (base token)
    address public v3CreatorToken;

    /// @notice USD stable token used in the V3 pool (quote token, e.g. USDC)
    address public v3UsdToken;

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

    // ================================
    // CONSTANTS - INTERNAL
    // ================================

    uint32 private constant PPM = 1_000_000;
    uint64 private constant ONE_DAY_PPM = 86_400 * 1_000_000;

    // ================================
    // EVENTS
    // ================================

    event CreatorPriceUpdated(string symbol, int256 price, uint256 timestamp, address indexed updater);
    event CreatorPriceBroadcast(uint32[] dstEids, int256 price, uint256 timestamp);
    event CreatorPriceReceived(uint32 srcEid, int256 price, uint256 timestamp);
    event V4PoolConfigured(PoolId indexed poolId, address poolManager, bool creatorIsToken0);
    event V3PoolConfigured(
        address indexed pool, address indexed creatorToken, address indexed usdToken, uint32 twapDuration
    );
    event ObservationRecorded(uint16 index, int24 tick, int24 truncatedTick, uint32 timestamp);
    event SwapRecorderSet(address indexed recorder, bool authorized);
    event PriceUpdaterSet(address indexed updater, bool authorized);
    event MaxTicksUpdated(int24 oldMaxTicks, int24 newMaxTicks, bool autoTuned);
    event TickWasCapped(int24 rawTick, int24 truncatedTick, int24 movement);
    event ChainlinkFeedSet(address indexed feed);
    // FIX: M-3 (4626-439) — emitted (via the deprecated entrypoint's revert path in tests / off-chain
    // call-simulation) so tooling can pick up migrations to broadcastCreatorPriceWithFees.
    event BroadcastEqualSplitCallAttempted(address indexed caller, uint256 msgValue, uint32[] dstEids);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error InvalidPrice();
    error Unauthorized();
    error V4NotConfigured();
    error V3NotConfigured();
    error InvalidV3Pool();
    error UnsupportedDecimals();
    error NeedMoreObservations();
    error StalePrice();
    error InvalidDuration();
    error PriceUpdateCooldown();
    error PriceDeviationTooHigh();
    // H-01 / 4626-293: oracle bootstrap must go through initializeCreatorPrice.
    error OracleNotInitialized();
    error OracleAlreadyInitialized();
    error InitialPriceTooHigh();
    error InvalidBaseEid();
    error InvalidOriginEid(uint32 srcEid);
    // FIX: M-3 (4626-439) — signalled when the legacy equal-split broadcast entrypoint is called.
    error BroadcastEqualSplitDeprecated();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy oracle for a Creator Coin
     * @param _registry CreatorRegistry address (same on all chains for deterministic addresses)
     * @param _chainlinkFeed Chainlink ETH/USD feed address
     * @param _creatorSymbol Creator token symbol (e.g., "■AKITA")
     * @param _owner Owner address
     *
     * @dev DETERMINISTIC DEPLOYMENT:
     *      Registry address is same on all chains via CREATE2.
     *      LayerZero endpoint is looked up from registry at construction.
     *      This allows same constructor args → same CREATE2 address on all chains.
     */
    constructor(address _registry, address _chainlinkFeed, string memory _creatorSymbol, address _owner)
        OApp(ICreatorRegistry(_registry).getLayerZeroEndpoint(block.chainid), _owner)
        Ownable(_owner)
    {
        if (_registry == address(0)) revert ZeroAddress();

        BASE_EID = ICreatorRegistry(_registry).hubChainEid();
        if (BASE_EID == 0) revert InvalidBaseEid();

        chainlinkFeed = _chainlinkFeed;
        creatorSymbol = _creatorSymbol;

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

    /**
     * @notice Configure V4 pool for TWAP observations
     * @param _poolManager Uniswap V4 PoolManager
     * @param _poolKey Pool key for ■AKITA/ETH
     * @param _creatorIsToken0 Whether creator token is currency0
     */
    function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _creatorIsToken0) external onlyOwner {
        if (_poolManager == address(0)) revert ZeroAddress();

        // FIX: M-5 — only reset observation ring buffer when pool manager changes;
        // previously every call to setV4Pool reset cardinality to 1, invalidating
        // TWAP history and causing a price blackout during warmup
        bool managerChanged = address(poolManager) != _poolManager;

        poolManager = IPoolManager(_poolManager);
        creatorPoolKey = _poolKey;
        creatorIsToken0 = _creatorIsToken0;
        v4PoolConfigured = true;

        // Get initial tick
        PoolId poolId = _poolKey.toId();
        (, int24 tick,,) = poolManager.getSlot0(poolId);

        if (managerChanged || observationState.cardinality == 0) {
            // Initialize first observation only on manager change or first setup
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

        emit V4PoolConfigured(poolId, _poolManager, _creatorIsToken0);
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
        if (_pool == address(0) || _creatorToken == address(0) || _usdToken == address(0)) {
            revert ZeroAddress();
        }
        if (_twapDuration < MIN_TWAP_DURATION) revert InvalidDuration();

        address t0 = IUniswapV3Pool(_pool).token0();
        address t1 = IUniswapV3Pool(_pool).token1();
        bool ok = (t0 == _creatorToken && t1 == _usdToken) || (t0 == _usdToken && t1 == _creatorToken);
        if (!ok) revert InvalidV3Pool();

        uint8 creatorDec = IERC20Metadata(_creatorToken).decimals();
        uint8 usdDec = IERC20Metadata(_usdToken).decimals();
        if (creatorDec > 18 || usdDec > 18) revert UnsupportedDecimals();

        v3Pool = _pool;
        v3CreatorToken = _creatorToken;
        v3UsdToken = _usdToken;
        v3CreatorDecimals = creatorDec;
        v3UsdDecimals = usdDec;
        v3TwapDuration = _twapDuration;
        v3PoolConfigured = true;

        emit V3PoolConfigured(_pool, _creatorToken, _usdToken, _twapDuration);
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
        if (chainlinkFeed == address(0)) return (0, 0);

        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = IChainlinkFeed(chainlinkFeed).latestRoundData();

        if (answer <= 0) return (0, 0);
        if (block.timestamp - updatedAt > MAX_STALENESS) return (0, 0);
        // FIX: I-3 (cross-cutting) — check answeredInRound per Chainlink docs
        if (answeredInRound < roundId) return (0, 0);

        // Chainlink 8 decimals → 18 decimals
        price = answer * 1e10;
        timestamp = updatedAt;
    }

    /**
     * @notice Get Creator token USD price
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp) {
        if (creatorPriceUSD > 0 && creatorPriceTimestamp > 0) {
            if (block.timestamp - creatorPriceTimestamp < MAX_STALENESS) {
                return (creatorPriceUSD, creatorPriceTimestamp);
            }
        }
        return (0, 0);
    }

    /**
     * @notice Update creator price (authorized callers only)
     * @param _price Price in 1e18 format
     */
    function updateCreatorPrice(int256 _price) external {
        if (!isPriceUpdater[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        if (_price <= 0) revert InvalidPrice();

        // H-01 / 4626-293: the first write must go through
        // initializeCreatorPrice(), which is owner-only and bounded. A 0 price
        // here means the oracle has never been initialized, and accepting an
        // arbitrary value at this point lets an attacker (or a compromised
        // isPriceUpdater) anchor every subsequent MAX_PRICE_DEVIATION-capped
        // update to a manipulated baseline.
        if (creatorPriceUSD == 0) revert OracleNotInitialized();

        // FIX: H-4 — apply deviation bounds to direct setter; previously bypassed all
        // TWAP/deviation guards, allowing a compromised priceUpdater to set arbitrary prices
        uint256 oldP = uint256(creatorPriceUSD);
        uint256 newP = uint256(_price);
        uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
        if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();

        creatorPriceUSD = _price;
        creatorPriceTimestamp = block.timestamp;

        emit CreatorPriceUpdated(creatorSymbol, _price, block.timestamp, msg.sender);
    }

    /**
     * @notice Owner-only bootstrap of the first creator price. Every other
     *         update path (updateCreatorPrice, updateCreatorPriceFromTWAP,
     *         updateCreatorPriceFromV3TWAP) enforces a MAX_PRICE_DEVIATION
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
    function initializeCreatorPrice(int256 _price) external onlyOwner {
        if (creatorPriceUSD != 0) revert OracleAlreadyInitialized();
        if (_price <= 0) revert InvalidPrice();
        if (_price > MAX_INITIAL_PRICE_USD) revert InitialPriceTooHigh();

        creatorPriceUSD = _price;
        creatorPriceTimestamp = block.timestamp;

        emit CreatorPriceUpdated(creatorSymbol, _price, block.timestamp, msg.sender);
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

        PoolId poolId = creatorPoolKey.toId();
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
            // Too many caps → loosen
            newCap = currentCap + change;
            if (newCap > tickCapPolicy.maxCap) newCap = tickCapPolicy.maxCap;
        } else {
            // Too few caps → tighten
            newCap = currentCap - change;
            if (newCap < tickCapPolicy.minCap) newCap = tickCapPolicy.minCap;
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
        PoolId poolId = creatorPoolKey.toId();
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

        // Invert if creator is token0
        if (creatorIsToken0 && price > 0) {
            price = (1e18 * 1e18) / price;
        }
    }

    /**
     * @notice Get Creator/ETH TWAP price
     * @param duration TWAP duration in seconds
     * @return price Creator per ETH in 1e18
     */
    function getCreatorEthTWAP(uint32 duration) public view returns (uint256 price) {
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
     * @notice Get CREATOR/USD TWAP price from the configured Uniswap V3 pool
     * @param duration TWAP duration in seconds
     * @return priceUsd18 USDC per 1 CREATOR, scaled to 1e18
     */
    function getCreatorUsdTWAP(uint32 duration) public view returns (uint256 priceUsd18) {
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
     * @notice Internal: Update price from TWAP
     */
    function _updatePriceFromTWAP() internal {
        // Rate limit
        if (block.timestamp - creatorPriceTimestamp < priceUpdateCooldown) return;
        if (observationState.cardinality < 2) return;

        // Fixed, non-bypassable window for auto-updates.
        uint32 duration = DEFAULT_TWAP_DURATION;
        uint32 nowTs = uint32(block.timestamp);
        if (nowTs <= duration) return;

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
        try this.getCreatorEthTWAP(duration) returns (uint256 price) {
            creatorPerEth = price;
        } catch {
            return;
        }

        if (creatorPerEth == 0) return;

        // Get ETH/USD from Chainlink
        if (chainlinkFeed == address(0)) return;

        try IChainlinkFeed(chainlinkFeed).latestRoundData() returns (
            uint80, int256 ethUSD, uint256, uint256 updatedAt, uint80
        ) {
            if (ethUSD <= 0) return;
            if (block.timestamp - updatedAt > MAX_STALENESS) return;

            // Convert Chainlink 8 decimals to 18
            uint256 ethUSD18 = uint256(ethUSD) * 1e10;

            // USD per CREATOR = (USD per ETH) / (CREATOR per ETH)
            int256 creatorUSD = int256(Math.mulDiv(ethUSD18, 1e18, creatorPerEth));

            // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value.
            // Auto-update is called inside a swap-path try/catch; return instead of reverting.
            if (creatorPriceUSD > 0) {
                uint256 oldP = uint256(creatorPriceUSD);
                uint256 newP = creatorUSD > 0 ? uint256(creatorUSD) : 0;
                uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
                if (deviation > MAX_PRICE_DEVIATION) return;
            }

            creatorPriceUSD = creatorUSD;
            creatorPriceTimestamp = block.timestamp;

            emit CreatorPriceUpdated(creatorSymbol, creatorUSD, block.timestamp, address(this));
        } catch {
            // Chainlink failed, skip
        }
    }

    /**
     * @notice Manually update price from TWAP
     * @param twapDuration TWAP duration in seconds
     */
    function updateCreatorPriceFromTWAP(uint32 twapDuration) external {
        if (msg.sender != owner() && !isPriceUpdater[msg.sender]) revert Unauthorized();
        if (twapDuration < MIN_TWAP_DURATION) revert InvalidDuration();
        if (creatorPriceTimestamp > 0 && block.timestamp - creatorPriceTimestamp < priceUpdateCooldown) {
            revert PriceUpdateCooldown();
        }

        // USD/CREATOR = Chainlink(ETH/USD) ÷ V4_TWAP(CREATOR/ETH).
        if (!v4PoolConfigured) revert V4NotConfigured();
        if (observationState.cardinality < 2) revert NeedMoreObservations();

        uint256 creatorPerEth = getCreatorEthTWAP(twapDuration);
        if (creatorPerEth == 0) revert InvalidPrice();

        if (chainlinkFeed == address(0)) revert ZeroAddress();

        (uint80 roundId, int256 ethUSD,, uint256 updatedAt, uint80 answeredInRound) = IChainlinkFeed(chainlinkFeed).latestRoundData();

        if (ethUSD <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
        // FIX: I-3 (cross-cutting) — check answeredInRound per Chainlink docs
        require(answeredInRound >= roundId, "Stale round");

        uint256 ethUSD18 = uint256(ethUSD) * 1e10;
        // USD per CREATOR = (USD per ETH) / (CREATOR per ETH)
        int256 creatorUSD = int256(Math.mulDiv(ethUSD18, 1e18, creatorPerEth));

        // H-01 / 4626-293: TWAP-driven writes also must not bootstrap the oracle.
        if (creatorPriceUSD == 0) revert OracleNotInitialized();

        // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value
        {
            uint256 oldP = uint256(creatorPriceUSD);
            uint256 newP = creatorUSD > 0 ? uint256(creatorUSD) : 0;
            uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
            if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();
        }

        creatorPriceUSD = creatorUSD;
        creatorPriceTimestamp = block.timestamp;

        emit CreatorPriceUpdated(creatorSymbol, creatorUSD, block.timestamp, msg.sender);
    }

    /**
     * @notice Optional: update creator USD price from Uniswap V3 TWAP (CREATOR/USDC)
     * @dev Useful for Ajna bucket selection or cross-checking. Does not require Chainlink.
     */
    function updateCreatorPriceFromV3TWAP(uint32 twapDuration) external {
        if (msg.sender != owner() && !isPriceUpdater[msg.sender]) revert Unauthorized();
        if (!v3PoolConfigured) revert V3NotConfigured();
        uint32 dur = twapDuration == 0 ? v3TwapDuration : twapDuration;
        if (dur < MIN_TWAP_DURATION) revert InvalidDuration();
        if (creatorPriceTimestamp > 0 && block.timestamp - creatorPriceTimestamp < priceUpdateCooldown) {
            revert PriceUpdateCooldown();
        }

        uint256 creatorUsd18 = getCreatorUsdTWAP(dur);
        if (creatorUsd18 == 0) revert InvalidPrice();

        // H-01 / 4626-293: TWAP-driven writes also must not bootstrap the oracle.
        if (creatorPriceUSD == 0) revert OracleNotInitialized();

        // Sanity: reject updates that move price more than MAX_PRICE_DEVIATION from the stored value
        {
            uint256 oldP = uint256(creatorPriceUSD);
            uint256 deviation =
                oldP > creatorUsd18 ? ((oldP - creatorUsd18) * 1e18) / oldP : ((creatorUsd18 - oldP) * 1e18) / oldP;
            if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();
        }

        creatorPriceUSD = int256(creatorUsd18);
        creatorPriceTimestamp = block.timestamp;

        emit CreatorPriceUpdated(creatorSymbol, int256(creatorUsd18), block.timestamp, msg.sender);
    }

    // ================================
    // LAYERZERO - CROSS-CHAIN
    // ================================

    /**
     * @notice DEPRECATED — see `broadcastCreatorPriceWithFees`.
     * @dev FIX: M-3 (4626-439) — the equal-split variant divided `msg.value / dstEids.length`
     *      and used that as the fee for every destination. LayerZero fees differ per
     *      destination chain, so any chain whose real fee exceeded the split amount
     *      reverted mid-loop and the broadcast partially failed, while leaving excess
     *      ETH stranded on non-refund paths. Rather than carry a footgun with an
     *      attractive short signature, this entrypoint is now a hard revert that emits
     *      a migration-signal event against off-chain call simulation. Callers must
     *      switch to `broadcastCreatorPriceWithFees(dstEids, options, fees)` and quote
     *      per-destination native fees via `quote()` / `endpoint.quote(...)`.
     * @custom:deprecated Use `broadcastCreatorPriceWithFees` with per-chain fees.
     */
    function broadcastCreatorPrice(uint32[] calldata dstEids, bytes calldata /* options */)
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
     * @dev FIX: M-01 (4626-310) — the equal-split `broadcastCreatorPrice` variant above
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
    function broadcastCreatorPriceWithFees(
        uint32[] calldata dstEids,
        bytes calldata options,
        uint256[] calldata fees
    ) external payable returns (MessagingReceipt[] memory receipts) {
        if (creatorPriceUSD <= 0) revert InvalidPrice();
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
        bytes memory payload = abi.encode(creatorPriceUSD, creatorPriceTimestamp, creatorSymbol);

        for (uint256 i = 0; i < dstEids.length; i++) {
            receipts[i] = _lzSend(dstEids[i], payload, options, MessagingFee(fees[i], 0), payable(msg.sender));
        }

        uint256 remainder = msg.value - totalFees;
        if (remainder > 0) {
            (bool ok,) = payable(msg.sender).call{value: remainder}("");
            require(ok, "Refund failed");
        }

        emit CreatorPriceBroadcast(dstEids, creatorPriceUSD, creatorPriceTimestamp);
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

        if (price <= 0) revert InvalidPrice();

        // Clamp to prevent freshness spoofing and future-timestamp underflow in staleness checks.
        uint256 safeTimestamp = timestamp > block.timestamp ? block.timestamp : timestamp;

        // Defense-in-depth: ignore out-of-order updates so delayed/replayed packets cannot roll back freshness.
        if (creatorPriceTimestamp != 0 && safeTimestamp < creatorPriceTimestamp) {
            return;
        }

        creatorPriceUSD = price;
        creatorPriceTimestamp = safeTimestamp;

        // Update symbol if different (for multi-creator support)
        if (bytes(symbol).length > 0) {
            creatorSymbol = symbol;
        }

        emit CreatorPriceReceived(origin.srcEid, price, safeTimestamp);
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
        return creatorPriceUSD > 0 && block.timestamp - creatorPriceTimestamp < MAX_STALENESS;
    }
}

/**
 * @notice Chainlink feed interface
 */
interface IChainlinkFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
