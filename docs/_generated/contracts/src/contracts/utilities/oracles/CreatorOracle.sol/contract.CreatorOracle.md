# CreatorOracle
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/oracles/CreatorOracle.sol)

**Inherits:**
OApp

**Title:**
CreatorOracle

**Author:**
0xakita.eth (4626)

Omnichain oracle for Creator Coin price distribution

Deployed to same address on all chains via CREATE2

ARCHITECTURE:
Base (Hub):
- Reads V4 pool TWAP (■AKITA/ETH)
- Gets ETH/USD from Chainlink
- Calculates ■AKITA/USD
- Broadcasts to all chains via LayerZero
Remote Chains:
- Receive and store Base's authoritative price
- Use for lottery, gauge calculations, etc.
- No local liquidity needed!

MANIPULATION RESISTANCE:
- Tick capping limits price movement per observation
- Auto-tuning adjusts cap based on frequency
- TWAP smooths out flash loan attacks
- Chainlink provides trusted ETH/USD baseline

USE CASES:
- GaugeController: Swap slippage protection
- Lottery: Fair USD value for prizes
- Vault: Price impact calculations
- Cross-chain: Consistent pricing everywhere


## Constants
### BASE_CHAIN_ID
Base chain ID (source of truth)


```solidity
uint256 public constant BASE_CHAIN_ID = 8453
```


### BASE_EID
Base chain LayerZero EID (source of truth for inbound price updates)


```solidity
uint32 public immutable BASE_EID
```


### MAX_STALENESS
Staleness threshold for prices


```solidity
uint256 public constant MAX_STALENESS = 7200
```


### DEFAULT_TWAP_DURATION
Default TWAP duration


```solidity
uint32 public constant DEFAULT_TWAP_DURATION = 1800
```


### MIN_TWAP_DURATION
Minimum TWAP duration accepted by public price update functions


```solidity
uint32 public constant MIN_TWAP_DURATION = 1800
```


### MAX_PRICE_DEVIATION
Maximum allowed price deviation per update (20%)


```solidity
uint256 public constant MAX_PRICE_DEVIATION = 0.2e18
```


### MAX_INITIAL_PRICE_USD
Hard upper bound on the first price that `initializeCreatorPrice`
may set (1e18 format). Prevents the bootstrap anchor from being placed
at an extreme value even if the owner key is compromised. 1_000_000 USD
per CREATOR token is unrealistically high but is a non-insulting
sanity cap. Raise only via a formal parameter change, not inline.

Mitigates H-01 (audit finding 4626-293).


```solidity
int256 public constant MAX_INITIAL_PRICE_USD = int256(uint256(1_000_000e18))
```


### MAX_CARDINALITY
Maximum observations to store


```solidity
uint16 public constant MAX_CARDINALITY = 1024
```


### PPM

```solidity
uint32 private constant PPM = 1_000_000
```


### ONE_DAY_PPM

```solidity
uint64 private constant ONE_DAY_PPM = 86_400 * 1_000_000
```


## State Variables
### creatorPriceUSD
Creator token USD price (broadcast from Base)


```solidity
int256 public creatorPriceUSD
```


### creatorPriceTimestamp

```solidity
uint256 public creatorPriceTimestamp
```


### creatorSymbol
Creator token symbol (for identification)


```solidity
string public creatorSymbol
```


### chainlinkFeed
Chainlink ETH/USD feed address


```solidity
address public chainlinkFeed
```


### poolManager
Uniswap V4 PoolManager


```solidity
IPoolManager public poolManager
```


### creatorPoolKey
V4 pool key for ■AKITA/ETH


```solidity
PoolKey public creatorPoolKey
```


### v4PoolConfigured
Whether V4 pool is configured


```solidity
bool public v4PoolConfigured
```


### creatorIsToken0
Whether creator token is token0 in the pool


```solidity
bool public creatorIsToken0
```


### v3Pool
Uniswap V3 pool used as primary CREATOR/USD oracle (optional)


```solidity
address public v3Pool
```


### v3CreatorToken
Creator token used in the V3 pool (base token)


```solidity
address public v3CreatorToken
```


### v3UsdToken
USD stable token used in the V3 pool (quote token, e.g. USDC)


```solidity
address public v3UsdToken
```


### v3CreatorDecimals
Cached decimals for price scaling


```solidity
uint8 public v3CreatorDecimals
```


### v3UsdDecimals

```solidity
uint8 public v3UsdDecimals
```


### v3TwapDuration
Default V3 TWAP duration (seconds)


```solidity
uint32 public v3TwapDuration = DEFAULT_TWAP_DURATION
```


### v3PoolConfigured
Whether V3 pool is configured


```solidity
bool public v3PoolConfigured
```


### observations
Ring buffer of observations


```solidity
Observation[65535] public observations
```


### observationState

```solidity
ObservationState public observationState
```


### lastObservationTimestamp
Last observation timestamp


```solidity
uint32 public lastObservationTimestamp
```


### maxTicksPerObservation
Maximum tick movement per observation (manipulation resistance)


```solidity
int24 public maxTicksPerObservation = 100
```


### tickCapState

```solidity
TickCapState public tickCapState
```


### tickCapPolicy

```solidity
TickCapPolicy public tickCapPolicy
```


### isSwapRecorder
Authorized swap recorders


```solidity
mapping(address => bool) public isSwapRecorder
```


### isPriceUpdater
Authorized price updaters


```solidity
mapping(address => bool) public isPriceUpdater
```


### priceUpdateCooldown
Price update cooldown (gas optimization)


```solidity
uint32 public priceUpdateCooldown = 30
```


### useTruncatedTick
Use truncated (manipulation-resistant) tick


```solidity
bool public useTruncatedTick = true
```


## Functions
### constructor

Deploy oracle for a Creator Coin

DETERMINISTIC DEPLOYMENT:
Registry address is same on all chains via CREATE2.
LayerZero endpoint is looked up from registry at construction.
This allows same constructor args → same CREATE2 address on all chains.


```solidity
constructor(address _registry, address _chainlinkFeed, string memory _creatorSymbol, address _owner)
    OApp(ICreatorRegistry(_registry).getLayerZeroEndpoint(block.chainid), _owner)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_registry`|`address`|CreatorRegistry address (same on all chains for deterministic addresses)|
|`_chainlinkFeed`|`address`|Chainlink ETH/USD feed address|
|`_creatorSymbol`|`string`|Creator token symbol (e.g., "■AKITA")|
|`_owner`|`address`|Owner address|


### setChainlinkFeed

Set Chainlink ETH/USD feed


```solidity
function setChainlinkFeed(address _feed) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feed`|`address`|Chainlink feed address|


### setV4Pool

Configure V4 pool for TWAP observations


```solidity
function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _creatorIsToken0) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolManager`|`address`|Uniswap V4 PoolManager|
|`_poolKey`|`PoolKey`|Pool key for ■AKITA/ETH|
|`_creatorIsToken0`|`bool`|Whether creator token is currency0|


### setV3Pool

Configure Uniswap V3 pool for CREATOR/USDC TWAP pricing (optional price source)


```solidity
function setV3Pool(address _pool, address _creatorToken, address _usdToken, uint32 _twapDuration)
    external
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pool`|`address`|Uniswap V3 pool address (must be the CREATOR/USDC pair)|
|`_creatorToken`|`address`|Creator token address|
|`_usdToken`|`address`|USD token address (e.g., USDC)|
|`_twapDuration`|`uint32`|TWAP duration in seconds (e.g., 1800)|


### setSwapRecorder

Set authorized swap recorder


```solidity
function setSwapRecorder(address recorder, bool authorized) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`recorder`|`address`|Address that can record observations|
|`authorized`|`bool`|Whether to authorize|


### setPriceUpdater

Set authorized price updater


```solidity
function setPriceUpdater(address updater, bool authorized) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`updater`|`address`|Address that can update price|
|`authorized`|`bool`|Whether to authorize|


### setMaxTicksPerObservation

Set maximum tick movement per observation


```solidity
function setMaxTicksPerObservation(int24 _maxTicks) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_maxTicks`|`int24`|Maximum allowed tick movement|


### setTickCapPolicy

Set tick cap policy


```solidity
function setTickCapPolicy(int24 _minCap, int24 _maxCap, uint32 _stepBps, uint32 _budgetPpm) external onlyOwner;
```

### setAutoTunePaused

Pause/unpause auto-tuning


```solidity
function setAutoTunePaused(bool paused) external onlyOwner;
```

### setPriceUpdateCooldown

Set price update cooldown


```solidity
function setPriceUpdateCooldown(uint32 cooldown) external onlyOwner;
```

### setUseTruncatedTick

Set whether to use truncated tick


```solidity
function setUseTruncatedTick(bool _use) external onlyOwner;
```

### getEthPrice

Get ETH/USD price from Chainlink


```solidity
function getEthPrice() external view returns (int256 price, uint256 timestamp);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`price`|`int256`|Price in 1e18 format|
|`timestamp`|`uint256`|Last update timestamp|


### getCreatorPrice

Get Creator token USD price


```solidity
function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`price`|`int256`|Price in 1e18 format|
|`timestamp`|`uint256`|Last update timestamp|


### updateCreatorPrice

Update creator price (authorized callers only)


```solidity
function updateCreatorPrice(int256 _price) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_price`|`int256`|Price in 1e18 format|


### initializeCreatorPrice

Owner-only bootstrap of the first creator price. Every other
update path (updateCreatorPrice, updateCreatorPriceFromTWAP,
updateCreatorPriceFromV3TWAP) enforces a MAX_PRICE_DEVIATION
cap against the previously stored value, so the first write is
what anchors every subsequent movement. Before this function was
added, any `isPriceUpdater` could silently anchor the oracle to
an arbitrary value. See H-01 / 4626-293.

Can only be called once. Further changes must go through the
deviation-capped paths. Bounded by MAX_INITIAL_PRICE_USD as a
last-line sanity check even on the owner key.


```solidity
function initializeCreatorPrice(int256 _price) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_price`|`int256`|Initial price in 1e18 format. Must be > 0 and <= MAX_INITIAL_PRICE_USD.|


### recordSwapObservation

Record observation on swap

Called by authorized recorders during swaps


```solidity
function recordSwapObservation() external;
```

### _updatePriceFromTWAPExternal

External wrapper for try/catch


```solidity
function _updatePriceFromTWAPExternal() external;
```

### _recordObservation

Internal observation recording


```solidity
function _recordObservation() internal returns (bool tickWasCapped);
```

### _updateCapFrequency

Update cap frequency and auto-tune


```solidity
function _updateCapFrequency(bool capOccurred) internal;
```

### _autoTuneTickCap

Auto-tune tick cap


```solidity
function _autoTuneTickCap(uint64 currentFreq) internal;
```

### getCurrentTick

Get current tick from V4 pool


```solidity
function getCurrentTick() external view returns (int24 tick);
```

### getTWAPTick

Calculate TWAP tick


```solidity
function getTWAPTick(uint32 duration) public view returns (int24 twapTick);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`duration`|`uint32`|Lookback duration in seconds|


### _findObservationBefore

Find observation before target time


```solidity
function _findObservationBefore(uint32 targetTime) internal view returns (uint16);
```

### tickToPrice

Convert tick to price


```solidity
function tickToPrice(int24 tick) public view returns (uint256 price);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tick`|`int24`|The tick value|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`price`|`uint256`|Price in 1e18 format|


### getCreatorEthTWAP

Get Creator/ETH TWAP price


```solidity
function getCreatorEthTWAP(uint32 duration) public view returns (uint256 price);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`duration`|`uint32`|TWAP duration in seconds|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`price`|`uint256`|Creator per ETH in 1e18|


### getV3TWAPTick

Calculate V3 TWAP tick for the configured CREATOR/USDC pool

Uses Uniswap V3 pool observations (TWAP), not spot `slot0`.


```solidity
function getV3TWAPTick(uint32 duration) public view returns (int24 twapTick);
```

### getCreatorUsdTWAP

Get CREATOR/USD TWAP price from the configured Uniswap V3 pool


```solidity
function getCreatorUsdTWAP(uint32 duration) public view returns (uint256 priceUsd18);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`duration`|`uint32`|TWAP duration in seconds|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`priceUsd18`|`uint256`|USDC per 1 CREATOR, scaled to 1e18|


### tickToAjnaBucket

Convert a Uniswap tick to an Ajna bucket index (approx)

Approximation: AjnaIndex ≈ 4156 - floor(tick / 50)
- 50 Uniswap ticks ≈ 0.5% (≈ Ajna 1.005 bucket step)
- Clamped to Ajna valid range (1..7388). Note: bucket 0 is invalid on Ajna pools.
IMPORTANT: `tick` should represent price = (quote token) per (collateral token).
For our Ajna strategy (quote=CREATOR, collateral=USDC), you want the CREATOR/USDC tick.


```solidity
function tickToAjnaBucket(int24 tick) public pure returns (uint256 bucketIndex);
```

### getAjnaBucketFromV3TWAP

Suggested Ajna bucket from the configured CREATOR/USDC V3 TWAP tick

Uniswap ticks are for token1/token0. We need CREATOR per USDC (quote per collateral),
so we invert if CREATOR is token0 (i.e., address(creator) < address(usdc)).


```solidity
function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex);
```

### _getQuoteAtTick

Minimal `getQuoteAtTick` (Uniswap V3 OracleLibrary-style) without importing v3-core FullMath.
Uses TickMathCompat + OpenZeppelin Math.mulDiv for full-precision mul/div.


```solidity
function _getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
    internal
    pure
    returns (uint256 quoteAmount);
```

### _updatePriceFromTWAP

Internal: Update price from TWAP


```solidity
function _updatePriceFromTWAP() internal;
```

### updateCreatorPriceFromTWAP

Manually update price from TWAP


```solidity
function updateCreatorPriceFromTWAP(uint32 twapDuration) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`twapDuration`|`uint32`|TWAP duration in seconds|


### updateCreatorPriceFromV3TWAP

Optional: update creator USD price from Uniswap V3 TWAP (CREATOR/USDC)

Useful for Ajna bucket selection or cross-checking. Does not require Chainlink.


```solidity
function updateCreatorPriceFromV3TWAP(uint32 twapDuration) external;
```

### broadcastCreatorPrice

DEPRECATED — see `broadcastCreatorPriceWithFees`.

FIX: M-3 (4626-439) — the equal-split variant divided `msg.value / dstEids.length`
and used that as the fee for every destination. LayerZero fees differ per
destination chain, so any chain whose real fee exceeded the split amount
reverted mid-loop and the broadcast partially failed, while leaving excess
ETH stranded on non-refund paths. Rather than carry a footgun with an
attractive short signature, this entrypoint is now a hard revert that emits
a migration-signal event against off-chain call simulation. Callers must
switch to `broadcastCreatorPriceWithFees(dstEids, options, fees)` and quote
per-destination native fees via `quote()` / `endpoint.quote(...)`.

**Note:**
deprecated: Use `broadcastCreatorPriceWithFees` with per-chain fees.


```solidity
function broadcastCreatorPrice(
    uint32[] calldata dstEids,
    bytes calldata /* options */
)
    external
    payable
    returns (
        MessagingReceipt[] memory /* receipts */
    );
```

### broadcastCreatorPriceWithFees

Broadcast price to other chains with per-destination LayerZero fees

FIX: M-01 (4626-310) — the equal-split `broadcastCreatorPrice` variant above
divides `msg.value / dstEids.length` and uses that as the fee for every
destination. LayerZero fees differ per destination chain, so any chain whose
real fee exceeds the split amount reverts mid-loop and the broadcast
partially fails. This overload requires the caller to pass a `fees` array
parallel to `dstEids`; the correct way to populate it is to call
`quote()` once per destination and pass the returned native fees here.
The old method is preserved for backwards compatibility.


```solidity
function broadcastCreatorPriceWithFees(uint32[] calldata dstEids, bytes calldata options, uint256[] calldata fees)
    external
    payable
    returns (MessagingReceipt[] memory receipts);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`dstEids`|`uint32[]`|   Destination chain EIDs|
|`options`|`bytes`|   LayerZero options (shared across destinations)|
|`fees`|`uint256[]`|      Native LayerZero fee per destination, in the same order as dstEids|


### _payNative

Override LayerZero default behavior to allow multi-destination broadcasts in one transaction.
The contract spends from its balance (funded by `msg.value`) across multiple `_lzSend` calls.


```solidity
function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee);
```

### _lzReceive

Receive price from Base


```solidity
function _lzReceive(Origin calldata origin, bytes32, bytes calldata payload, address, bytes calldata)
    internal
    override;
```

### getObservationState

Get observation state


```solidity
function getObservationState()
    external
    view
    returns (uint16 index, uint16 cardinality, uint16 cardinalityNext, uint32 lastTimestamp);
```

### getTickCapState

Get tick cap state


```solidity
function getTickCapState() external view returns (int24 currentCap, uint64 capFrequency, bool autoTunePaused);
```

### isPriceFresh

Check if price is fresh


```solidity
function isPriceFresh() external view returns (bool);
```

## Events
### CreatorPriceUpdated

```solidity
event CreatorPriceUpdated(string symbol, int256 price, uint256 timestamp, address indexed updater);
```

### CreatorPriceBroadcast

```solidity
event CreatorPriceBroadcast(uint32[] dstEids, int256 price, uint256 timestamp);
```

### CreatorPriceReceived

```solidity
event CreatorPriceReceived(uint32 srcEid, int256 price, uint256 timestamp);
```

### V4PoolConfigured

```solidity
event V4PoolConfigured(PoolId indexed poolId, address poolManager, bool creatorIsToken0);
```

### V3PoolConfigured

```solidity
event V3PoolConfigured(
    address indexed pool, address indexed creatorToken, address indexed usdToken, uint32 twapDuration
);
```

### ObservationRecorded

```solidity
event ObservationRecorded(uint16 index, int24 tick, int24 truncatedTick, uint32 timestamp);
```

### SwapRecorderSet

```solidity
event SwapRecorderSet(address indexed recorder, bool authorized);
```

### PriceUpdaterSet

```solidity
event PriceUpdaterSet(address indexed updater, bool authorized);
```

### MaxTicksUpdated

```solidity
event MaxTicksUpdated(int24 oldMaxTicks, int24 newMaxTicks, bool autoTuned);
```

### TickWasCapped

```solidity
event TickWasCapped(int24 rawTick, int24 truncatedTick, int24 movement);
```

### ChainlinkFeedSet

```solidity
event ChainlinkFeedSet(address indexed feed);
```

### BroadcastEqualSplitCallAttempted

```solidity
event BroadcastEqualSplitCallAttempted(address indexed caller, uint256 msgValue, uint32[] dstEids);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidPrice

```solidity
error InvalidPrice();
```

### Unauthorized

```solidity
error Unauthorized();
```

### V4NotConfigured

```solidity
error V4NotConfigured();
```

### V3NotConfigured

```solidity
error V3NotConfigured();
```

### InvalidV3Pool

```solidity
error InvalidV3Pool();
```

### UnsupportedDecimals

```solidity
error UnsupportedDecimals();
```

### NeedMoreObservations

```solidity
error NeedMoreObservations();
```

### StalePrice

```solidity
error StalePrice();
```

### InvalidDuration

```solidity
error InvalidDuration();
```

### PriceUpdateCooldown

```solidity
error PriceUpdateCooldown();
```

### PriceDeviationTooHigh

```solidity
error PriceDeviationTooHigh();
```

### OracleNotInitialized

```solidity
error OracleNotInitialized();
```

### OracleAlreadyInitialized

```solidity
error OracleAlreadyInitialized();
```

### InitialPriceTooHigh

```solidity
error InitialPriceTooHigh();
```

### InvalidBaseEid

```solidity
error InvalidBaseEid();
```

### InvalidOriginEid

```solidity
error InvalidOriginEid(uint32 srcEid);
```

### BroadcastEqualSplitDeprecated

```solidity
error BroadcastEqualSplitDeprecated();
```

## Structs
### Observation
Observation data point


```solidity
struct Observation {
    uint32 blockTimestamp;
    int56 tickCumulative;
    int56 tickCumulativeTruncated;
    uint160 secondsPerLiquidityCumulativeX128;
    int24 prevTruncatedTick;
    bool initialized;
}
```

### ObservationState
Current observation state


```solidity
struct ObservationState {
    uint16 index;
    uint16 cardinality;
    uint16 cardinalityNext;
}
```

### TickCapState
Tick cap auto-tuning state


```solidity
struct TickCapState {
    uint64 capFrequency;
    uint48 lastCapUpdate;
    bool autoTunePaused;
}
```

### TickCapPolicy
Tick cap policy


```solidity
struct TickCapPolicy {
    int24 minCap;
    int24 maxCap;
    uint32 stepBps;
    uint32 budgetPpm;
    uint32 decayWindowSec;
    uint32 updateIntervalSec;
}
```

