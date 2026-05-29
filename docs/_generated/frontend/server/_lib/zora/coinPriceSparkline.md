[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/coinPriceSparkline

# server/\_lib/zora/coinPriceSparkline

## Type Aliases

### CoinPriceSparklineResult

> **CoinPriceSparklineResult** = `object`

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L8)

#### Properties

##### changePercent

> **changePercent**: `number` \| `null`

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L11)

##### coinAddress

> **coinAddress**: `string`

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L9)

##### source

> **source**: [`CoinSparklineSource`](#coinsparklinesource)

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L12)

##### values

> **values**: `number`[]

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L10)

***

### CoinSparklineSource

> **CoinSparklineSource** = `"subgraph"` \| `"zora_swaps"` \| `null`

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L6)

***

### CoinSparklineTimeframe

> **CoinSparklineTimeframe** = `"1m"`

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L5)

## Functions

### buildCoinPriceSparklineFromSwapEdges()

> **buildCoinPriceSparklineFromSwapEdges**(`edges`, `timeframe`): `Omit`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult), `"coinAddress"` \| `"source"`\>

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L40)

#### Parameters

##### edges

readonly `object`[]

##### timeframe

`"1m"` = `'1m'`

#### Returns

`Omit`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult), `"coinAddress"` \| `"source"`\>

***

### ~~fetchCoinPriceSparkline()~~

> **fetchCoinPriceSparkline**(`sdk`, `coinAddress`, `chainId`, `timeframe`): `Promise`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult)\>

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:108](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L108)

#### Parameters

##### sdk

`any`

##### coinAddress

`string`

##### chainId

`number`

##### timeframe

`"1m"` = `'1m'`

#### Returns

`Promise`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult)\>

#### Deprecated

Use resolveCoinPriceSparkline — kept for call-site stability.

***

### fetchCoinPriceSparklineFromZoraSwaps()

> **fetchCoinPriceSparklineFromZoraSwaps**(`sdk`, `coinAddress`, `chainId`, `timeframe`): `Promise`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult)\>

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L86)

#### Parameters

##### sdk

`any`

##### coinAddress

`string`

##### chainId

`number`

##### timeframe

`"1m"` = `'1m'`

#### Returns

`Promise`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult)\>

***

### resolveCoinPriceSparkline()

> **resolveCoinPriceSparkline**(`coinAddress`, `options`): `Promise`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult)\>

Defined in: [server/\_lib/zora/coinPriceSparkline.ts:120](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/coinPriceSparkline.ts#L120)

Subgraph-first, Zora swap fallback — same resolution order as detail charts.

#### Parameters

##### coinAddress

`string`

##### options

###### chainId?

`number`

###### sdk?

`any`

###### timeframe?

`"1m"`

#### Returns

`Promise`\<[`CoinPriceSparklineResult`](#coinpricesparklineresult)\>
