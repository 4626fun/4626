[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/uniswap/client

# src/lib/uniswap/client

## Functions

### getPoolDayData()

> **getPoolDayData**(`poolId`, `days`): `Promise`\<[`UniswapPoolDayData`](types.md#uniswappooldaydata)[]\>

Defined in: [lib/uniswap/client.ts:122](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/client.ts#L122)

Get pool day data for historical volume/fees

#### Parameters

##### poolId

`string`

##### days

`number` = `30`

#### Returns

`Promise`\<[`UniswapPoolDayData`](types.md#uniswappooldaydata)[]\>

***

### getPoolHourData()

> **getPoolHourData**(`poolId`, `hours`): `Promise`\<[`UniswapPoolHourData`](types.md#uniswappoolhourdata)[]\>

Defined in: [lib/uniswap/client.ts:167](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/client.ts#L167)

Get pool hour data for granular historical data

#### Parameters

##### poolId

`string`

##### hours

`number` = `24`

#### Returns

`Promise`\<[`UniswapPoolHourData`](types.md#uniswappoolhourdata)[]\>

***

### getPoolsByToken()

> **getPoolsByToken**(`tokenAddress`): `Promise`\<[`UniswapPool`](types.md#uniswappool)[]\>

Defined in: [lib/uniswap/client.ts:56](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/client.ts#L56)

Get pool by token address
Finds pools where the token is either token0 or token1

#### Parameters

##### tokenAddress

`string`

#### Returns

`Promise`\<[`UniswapPool`](types.md#uniswappool)[]\>

***

### getTimeframeData()

> **getTimeframeData**(`tokenAddress`, `timeframe`): `Promise`\<[`TimeframeData`](types.md#timeframedata) \| `null`\>

Defined in: [lib/uniswap/client.ts:253](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/client.ts#L253)

Get aggregated volume/fees data for a specific timeframe

#### Parameters

##### tokenAddress

`string`

##### timeframe

`"1h"` | `"1d"` | `"1w"` | `"1m"` | `"1y"`

#### Returns

`Promise`\<[`TimeframeData`](types.md#timeframedata) \| `null`\>

***

### getToken()

> **getToken**(`tokenAddress`): `Promise`\<[`UniswapToken`](types.md#uniswaptoken) \| `null`\>

Defined in: [lib/uniswap/client.ts:326](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/client.ts#L326)

Get token info from the subgraph

#### Parameters

##### tokenAddress

`string`

#### Returns

`Promise`\<[`UniswapToken`](types.md#uniswaptoken) \| `null`\>

***

### getTokenDayData()

> **getTokenDayData**(`tokenAddress`, `days`): `Promise`\<[`UniswapTokenDayData`](types.md#uniswaptokendaydata)[]\>

Defined in: [lib/uniswap/client.ts:212](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/client.ts#L212)

Get token day data for historical price/volume

#### Parameters

##### tokenAddress

`string`

##### days

`number` = `30`

#### Returns

`Promise`\<[`UniswapTokenDayData`](types.md#uniswaptokendaydata)[]\>
