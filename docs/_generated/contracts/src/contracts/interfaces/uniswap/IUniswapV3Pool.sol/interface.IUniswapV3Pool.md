# IUniswapV3Pool
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/interfaces/uniswap/IUniswapV3Pool.sol)

**Title:**
The interface for a Uniswap V3 Pool

**Author:**
Uniswap Labs

A Uniswap pool facilitates swapping and automated market making between any two assets that strictly conform
to the ERC20 specification


## Functions
### slot0

The 0th storage slot in the pool stores many values, and is exposed as a single method to save gas


```solidity
function slot0()
    external
    view
    returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`sqrtPriceX96`|`uint160`|The current price of the pool as a sqrt(token1/token0) Q64.96 value|
|`tick`|`int24`|The current tick of the pool, i.e. according to the last tick transition that was run.|
|`observationIndex`|`uint16`|The index of the last oracle observation that was written,|
|`observationCardinality`|`uint16`|The current maximum number of observations stored in the pool,|
|`observationCardinalityNext`|`uint16`|The next maximum number of observations, to be updated when the observation.|
|`feeProtocol`|`uint8`|The protocol fee for both tokens of the pool.|
|`unlocked`|`bool`|Whether the pool is currently locked to reentrancy|


### token0

The first of the two tokens of the pool, sorted by address


```solidity
function token0() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The token contract address|


### token1

The second of the two tokens of the pool, sorted by address


```solidity
function token1() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The token contract address|


### fee

The current protocol fee as a percentage of the swap fee taken on withdrawal
represented as an integer denominator (1/x)%


```solidity
function fee() external view returns (uint24);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint24`|feeProtocol The protocol fee|


### liquidity

The pool's fee in hundredths of a bip, i.e. 1e-6


```solidity
function liquidity() external view returns (uint128);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint128`|The fee|


### tickSpacing

The pool tick spacing

Ticks can only be used at multiples of this value, minimum of 1 and always positive
e.g.: a tickSpacing of 3 means ticks can be initialized every 3rd tick, i.e., ..., -6, -3, 0, 3, 6, ...
This value is an int24 to avoid casting even though it is always positive.


```solidity
function tickSpacing() external view returns (int24);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`int24`|The tick spacing|


### positions

Returns the information about a position by the position's key


```solidity
function positions(bytes32 key)
    external
    view
    returns (
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`key`|`bytes32`|The position's key is a hash of a preimage composed by the owner, tickLower and tickUpper|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint128`|The amount of liquidity in the position|
|`feeGrowthInside0LastX128`|`uint256`|fee growth of token0 inside the tick range as of the last mint/burn/poke|
|`feeGrowthInside1LastX128`|`uint256`|fee growth of token1 inside the tick range as of the last mint/burn/poke|
|`tokensOwed0`|`uint128`|the computed amount of token0 owed to the position as of the last mint/burn/poke|
|`tokensOwed1`|`uint128`|the computed amount of token1 owed to the position as of the last mint/burn/poke|


### observe

Returns the cumulative tick and liquidity as of each timestamp `secondsAgo` from the current block timestamp

To get a time weighted average tick or liquidity-in-range, you must call this with two values, one representing
the beginning of the period and another for the end of the period. E.g., to get the last hour time-weighted average tick,
you must call it with secondsAgos = [3600, 0].

The time weighted average tick represents the geometric time weighted average price of the pool, in
log base sqrt(1.0001) of token1 / token0. The TickMath library can be used to go from a tick value to a ratio.


```solidity
function observe(uint32[] calldata secondsAgos)
    external
    view
    returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`secondsAgos`|`uint32[]`|From how long ago each cumulative tick and liquidity value should be returned|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`tickCumulatives`|`int56[]`|Cumulative tick values as of each `secondsAgos` from the current block timestamp|
|`secondsPerLiquidityCumulativeX128s`|`uint160[]`|Cumulative seconds per liquidity-in-range value as of each `secondsAgos` from the current block timestamp|


### initialize

Initialize the state for a given pool ID

Can only be called once per pool ID


```solidity
function initialize(uint160 sqrtPriceX96) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sqrtPriceX96`|`uint160`|The initial sqrt price of the pool as a Q64.96|


### mint

Adds liquidity for the given recipient/tickLower/tickUpper position


```solidity
function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount, bytes calldata data)
    external
    returns (uint256 amount0, uint256 amount1);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`recipient`|`address`|The address for which the liquidity will be created|
|`tickLower`|`int24`|The lower tick of the position in which to add liquidity|
|`tickUpper`|`int24`|The upper tick of the position in which to add liquidity|
|`amount`|`uint128`|The amount of liquidity to mint|
|`data`|`bytes`|Any data that should be passed through to the callback|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amount0`|`uint256`|The amount of token0 that was paid to mint the given amount of liquidity|
|`amount1`|`uint256`|The amount of token1 that was paid to mint the given amount of liquidity|


### burn

Burn liquidity from the sender and account tokens owed for the liquidity to the position


```solidity
function burn(int24 tickLower, int24 tickUpper, uint128 amount) external returns (uint256 amount0, uint256 amount1);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tickLower`|`int24`|The lower tick of the position for which to burn liquidity|
|`tickUpper`|`int24`|The upper tick of the position for which to burn liquidity|
|`amount`|`uint128`|How much liquidity to burn|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amount0`|`uint256`|The amount of token0 sent to the recipient|
|`amount1`|`uint256`|The amount of token1 sent to the recipient|


### swap

Swap token0 for token1, or token1 for token0


```solidity
function swap(
    address recipient,
    bool zeroForOne,
    int256 amountSpecified,
    uint160 sqrtPriceLimitX96,
    bytes calldata data
) external returns (int256 amount0, int256 amount1);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`recipient`|`address`|The address to receive the output of the swap|
|`zeroForOne`|`bool`|The direction of the swap, true for token0 to token1, false for token1 to token0|
|`amountSpecified`|`int256`|The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)|
|`sqrtPriceLimitX96`|`uint160`|The Q64.96 sqrt price limit. If zero for one, the price cannot be less than this value after the swap. If one for zero, the price cannot be greater than this value after the swap|
|`data`|`bytes`|Any data to be passed through to the callback|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amount0`|`int256`|The delta of the balance of token0 of the pool, exact when negative, minimum when positive|
|`amount1`|`int256`|The delta of the balance of token1 of the pool, exact when negative, minimum when positive|


### collect

Collect tokens owed to a position


```solidity
function collect(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount0Requested,
    uint128 amount1Requested
) external returns (uint128 amount0, uint128 amount1);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`recipient`|`address`|The address which should receive the fees collected|
|`tickLower`|`int24`|The lower tick of the position for which to collect fees|
|`tickUpper`|`int24`|The upper tick of the position for which to collect fees|
|`amount0Requested`|`uint128`|How much token0 should be withdrawn from the fees owed|
|`amount1Requested`|`uint128`|How much token1 should be withdrawn from the fees owed|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amount0`|`uint128`|The amount of fees collected in token0|
|`amount1`|`uint128`|The amount of fees collected in token1|


