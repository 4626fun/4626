[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/cca/marketFloor

# src/lib/cca/marketFloor

## Interfaces

### ReadonlyPublicClient

Defined in: [src/lib/cca/marketFloor.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L131)

#### Methods

##### getBlock()

> **getBlock**(`args`): `Promise`\<`any`\>

Defined in: [src/lib/cca/marketFloor.ts:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L136)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### getBlockNumber()

> **getBlockNumber**(`args?`): `Promise`\<`bigint`\>

Defined in: [src/lib/cca/marketFloor.ts:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L135)

###### Parameters

###### args?

`any`

###### Returns

`Promise`\<`bigint`\>

##### getLogs()

> **getLogs**(`args`): `Promise`\<`any`[]\>

Defined in: [src/lib/cca/marketFloor.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L137)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`[]\>

##### multicall()

> **multicall**(`args`): `Promise`\<`any`\>

Defined in: [src/lib/cca/marketFloor.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L134)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

##### readContract()

> **readContract**(`args`): `Promise`\<`any`\>

Defined in: [src/lib/cca/marketFloor.ts:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L133)

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

## Type Aliases

### MarketFloorQuote

> **MarketFloorQuote** = `object`

Defined in: [src/lib/cca/marketFloor.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L95)

#### Properties

##### creatorZora

> **creatorZora**: `object`

Defined in: [src/lib/cca/marketFloor.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L105)

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

Defined in: [src/lib/cca/marketFloor.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L101)

##### floorPriceQ96Aligned

> **floorPriceQ96Aligned**: `bigint`

Defined in: [src/lib/cca/marketFloor.ts:97](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L97)

##### tickSpacingQ96

> **tickSpacingQ96**: `bigint`

Defined in: [src/lib/cca/marketFloor.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L100)

##### weiPerToken

> **weiPerToken**: `bigint`

Defined in: [src/lib/cca/marketFloor.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L102)

##### zoraEth

> **zoraEth**: `object`

Defined in: [src/lib/cca/marketFloor.ts:120](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L120)

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

Defined in: [src/lib/cca/marketFloor.ts:414](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L414)

#### Parameters

##### params

###### creatorCoin

`string`

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

***

### getZoraReferenceV3Ticks()

> **getZoraReferenceV3Ticks**(`params`): `Promise`\<\{ `durationSec`: `number`; `usdcTick`: `number`; `wethTick`: `number`; \}\>

Defined in: [src/lib/cca/marketFloor.ts:212](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/cca/marketFloor.ts#L212)

#### Parameters

##### params

###### desiredDurationSec

`number`

###### publicClient

[`ReadonlyPublicClient`](#readonlypublicclient)

###### zoraUsdcV3Pool

`string`

###### zoraWethV3Pool

`string`

#### Returns

`Promise`\<\{ `durationSec`: `number`; `usdcTick`: `number`; `wethTick`: `number`; \}\>
