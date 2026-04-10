[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/uniswap/hooks

# src/lib/uniswap/hooks

## Type Aliases

### PoolHistoryData

> **PoolHistoryData** = `object`

Defined in: [src/lib/uniswap/hooks.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L5)

#### Properties

##### dataPoints

> **dataPoints**: `object`[]

Defined in: [src/lib/uniswap/hooks.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L13)

###### close?

> `optional` **close**: `number`

###### feesUSD

> **feesUSD**: `number`

###### high?

> `optional` **high**: `number`

###### low?

> `optional` **low**: `number`

###### open?

> `optional` **open**: `number`

###### timestamp

> **timestamp**: `number`

###### tvlUSD

> **tvlUSD**: `number`

###### volumeUSD

> **volumeUSD**: `number`

##### feesUSD

> **feesUSD**: `number`

Defined in: [src/lib/uniswap/hooks.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L10)

##### poolId

> **poolId**: `string` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L8)

##### priceChangePercent

> **priceChangePercent**: `number`

Defined in: [src/lib/uniswap/hooks.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L12)

##### timeframe

> **timeframe**: `string`

Defined in: [src/lib/uniswap/hooks.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L7)

##### tokenAddress

> **tokenAddress**: `string`

Defined in: [src/lib/uniswap/hooks.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L6)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [src/lib/uniswap/hooks.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L11)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [src/lib/uniswap/hooks.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L9)

## Functions

### usePoolHistory()

> **usePoolHistory**(`tokenAddress`, `timeframe`, `options?`): `UseQueryResult`\<[`PoolHistoryData`](#poolhistorydata) \| `null`, `Error`\>

Defined in: [src/lib/uniswap/hooks.ts:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L93)

Hook to fetch historical pool data for a token

#### Parameters

##### tokenAddress

The token contract address

`string` | `undefined`

##### timeframe

One of: 1h, 1d, 1w, 1m, 1y

`"1h"` | `"1d"` | `"1w"` | `"1m"` | `"1y"`

##### options?

Query options (enabled, etc.)

###### enabled?

`boolean`

#### Returns

`UseQueryResult`\<[`PoolHistoryData`](#poolhistorydata) \| `null`, `Error`\>

***

### useUniswapServiceStatus()

> **useUniswapServiceStatus**(): `UseQueryResult`\<\{ `available`: `boolean`; `reason`: `null`; \} \| \{ `available`: `boolean`; `reason`: `string`; \}, `Error`\>

Defined in: [src/lib/uniswap/hooks.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/lib/uniswap/hooks.ts#L112)

Check if Uniswap data service is available
This can be used to conditionally enable timeframe filters

#### Returns

`UseQueryResult`\<\{ `available`: `boolean`; `reason`: `null`; \} \| \{ `available`: `boolean`; `reason`: `string`; \}, `Error`\>
