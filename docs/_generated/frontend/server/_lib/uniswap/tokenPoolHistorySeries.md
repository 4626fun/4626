[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/uniswap/tokenPoolHistorySeries

# server/\_lib/uniswap/tokenPoolHistorySeries

## Type Aliases

### TokenPoolDayCloseSeries

> **TokenPoolDayCloseSeries** = `object`

Defined in: [server/\_lib/uniswap/tokenPoolHistorySeries.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/uniswap/tokenPoolHistorySeries.ts#L8)

#### Properties

##### changePercent

> **changePercent**: `number` \| `null`

Defined in: [server/\_lib/uniswap/tokenPoolHistorySeries.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/uniswap/tokenPoolHistorySeries.ts#L10)

##### poolId

> **poolId**: `string` \| `null`

Defined in: [server/\_lib/uniswap/tokenPoolHistorySeries.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/uniswap/tokenPoolHistorySeries.ts#L11)

##### values

> **values**: `number`[]

Defined in: [server/\_lib/uniswap/tokenPoolHistorySeries.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/uniswap/tokenPoolHistorySeries.ts#L9)

## Functions

### buildSparklineFromDailyCloses()

> **buildSparklineFromDailyCloses**(`closes`): `Omit`\<[`TokenPoolDayCloseSeries`](#tokenpooldaycloseseries), `"poolId"`\>

Defined in: [server/\_lib/uniswap/tokenPoolHistorySeries.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/uniswap/tokenPoolHistorySeries.ts#L47)

#### Parameters

##### closes

readonly `number`[]

#### Returns

`Omit`\<[`TokenPoolDayCloseSeries`](#tokenpooldaycloseseries), `"poolId"`\>

***

### fetchTokenPoolDayCloseSeries()

> **fetchTokenPoolDayCloseSeries**(`tokenAddress`, `dataPoints`): `Promise`\<[`TokenPoolDayCloseSeries`](#tokenpooldaycloseseries) \| `null`\>

Defined in: [server/\_lib/uniswap/tokenPoolHistorySeries.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/uniswap/tokenPoolHistorySeries.ts#L62)

Uniswap V4 subgraph path for 30d daily closes (PoolDayData.close).
Mirrors `/api/uniswap/poolHistory?timeframe=1m` without HTTP overhead.

#### Parameters

##### tokenAddress

`string`

##### dataPoints

`number` = `30`

#### Returns

`Promise`\<[`TokenPoolDayCloseSeries`](#tokenpooldaycloseseries) \| `null`\>
