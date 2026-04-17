[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/client

# src/lib/uniswap/client

## Functions

### getPoolDayData()

> **getPoolDayData**(`poolId`, `days`): `Promise`\<[`UniswapPoolDayData`](types.md#uniswappooldaydata)[]\>

Defined in: [src/lib/uniswap/client.ts:155](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L155)

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

Defined in: [src/lib/uniswap/client.ts:200](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L200)

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

Defined in: [src/lib/uniswap/client.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L89)

Get pool by token address
Finds pools where the token is either token0 or token1

#### Parameters

##### tokenAddress

`string`

#### Returns

`Promise`\<[`UniswapPool`](types.md#uniswappool)[]\>

***

### getPoolSwaps()

> **getPoolSwaps**(`poolId`, `first`): `Promise`\<[`UniswapSwap`](types.md#uniswapswap)[]\>

Defined in: [src/lib/uniswap/client.ts:389](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L389)

Get recent swaps for a pool

#### Parameters

##### poolId

`string`

##### first

`number` = `20`

#### Returns

`Promise`\<[`UniswapSwap`](types.md#uniswapswap)[]\>

***

### getTimeframeData()

> **getTimeframeData**(`tokenAddress`, `timeframe`): `Promise`\<[`TimeframeData`](types.md#timeframedata) \| `null`\>

Defined in: [src/lib/uniswap/client.ts:286](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L286)

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

Defined in: [src/lib/uniswap/client.ts:360](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L360)

Get token info from the subgraph

#### Parameters

##### tokenAddress

`string`

#### Returns

`Promise`\<[`UniswapToken`](types.md#uniswaptoken) \| `null`\>

***

### getTokenDayData()

> **getTokenDayData**(`tokenAddress`, `days`): `Promise`\<[`UniswapTokenDayData`](types.md#uniswaptokendaydata)[]\>

Defined in: [src/lib/uniswap/client.ts:245](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/client.ts#L245)

Get token day data for historical price/volume

#### Parameters

##### tokenAddress

`string`

##### days

`number` = `30`

#### Returns

`Promise`\<[`UniswapTokenDayData`](types.md#uniswaptokendaydata)[]\>
