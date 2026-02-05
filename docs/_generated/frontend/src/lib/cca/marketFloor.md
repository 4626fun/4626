[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/cca/marketFloor

# src/lib/cca/marketFloor

## Interfaces

### ReadonlyPublicClient

Defined in: [lib/cca/marketFloor.ts:130](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L130)

#### Methods

##### getBlock()

> **getBlock**(`args`): `Promise`\<`any`\>

Defined in: [lib/cca/marketFloor.ts:135](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L135)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### getBlockNumber()

> **getBlockNumber**(`args?`): `Promise`\<`bigint`\>

Defined in: [lib/cca/marketFloor.ts:134](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L134)

###### Parameters

###### args?

`any`

###### Returns

`Promise`\<`bigint`\>

##### getLogs()

> **getLogs**(`args`): `Promise`\<`any`[]\>

Defined in: [lib/cca/marketFloor.ts:136](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L136)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`[]\>

##### multicall()

> **multicall**(`args`): `Promise`\<`any`\>

Defined in: [lib/cca/marketFloor.ts:133](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L133)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### readContract()

> **readContract**(`args`): `Promise`\<`any`\>

Defined in: [lib/cca/marketFloor.ts:132](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L132)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

## Type Aliases

### MarketFloorQuote

> **MarketFloorQuote** = `object`

Defined in: [lib/cca/marketFloor.ts:94](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L94)

#### Properties

##### creatorZora

> **creatorZora**: `object`

Defined in: [lib/cca/marketFloor.ts:104](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L104)

###### creatorPerZora

> **creatorPerZora**: `number`

###### currency0

> **currency0**: `Address`

###### currency1

> **currency1**: `Address`

###### durationSec

> **durationSec**: `number`

###### fromBlock

> **fromBlock**: `bigint`

###### liquidity

> **liquidity**: `bigint`

###### meanTick

> **meanTick**: `number`

Time-weighted mean tick over the window

###### poolId

> **poolId**: `` `0x${string}` ``

###### sampleCount

> **sampleCount**: `number`

###### spotTick

> **spotTick**: `number`

Spot tick at `toBlock` (latest state)

###### toBlock

> **toBlock**: `bigint`

##### floorPriceQ96

> **floorPriceQ96**: `bigint`

Defined in: [lib/cca/marketFloor.ts:100](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L100)

##### floorPriceQ96Aligned

> **floorPriceQ96Aligned**: `bigint`

Defined in: [lib/cca/marketFloor.ts:96](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L96)

##### tickSpacingQ96

> **tickSpacingQ96**: `bigint`

Defined in: [lib/cca/marketFloor.ts:99](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L99)

##### weiPerToken

> **weiPerToken**: `bigint`

Defined in: [lib/cca/marketFloor.ts:101](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L101)

##### zoraEth

> **zoraEth**: `object`

Defined in: [lib/cca/marketFloor.ts:119](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L119)

###### discountBps

> **discountBps**: `number`

###### durationSec

> **durationSec**: `number`

###### ethPerZoraConservative

> **ethPerZoraConservative**: `number`

###### ethPerZoraUsdcTwap?

> `optional` **ethPerZoraUsdcTwap**: `number`

###### ethPerZoraWethTwap?

> `optional` **ethPerZoraWethTwap**: `number`

## Functions

### computeMarketFloorQuote()

> **computeMarketFloorQuote**(`params`): `Promise`\<[`MarketFloorQuote`](#marketfloorquote)\>

Defined in: [lib/cca/marketFloor.ts:440](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/cca/marketFloor.ts#L440)

#### Parameters

##### params

###### creatorCoin

`` `0x${string}` ``

###### discountBps?

`number`

###### publicClient

[`ReadonlyPublicClient`](#readonlypublicclient)

###### twapDurationSec?

`number`

Lookback window for sampling the CREATOR/ZORA v4 pool tick.

###### zoraEthTwapDurationSec?

`number`

TWAP window used for ZORA reference pricing from Uniswap v3 pools.

#### Returns

`Promise`\<[`MarketFloorQuote`](#marketfloorquote)\>
