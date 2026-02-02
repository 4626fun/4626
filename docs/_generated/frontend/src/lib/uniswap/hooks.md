[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/uniswap/hooks

# src/lib/uniswap/hooks

## Type Aliases

### PoolHistoryData

> **PoolHistoryData** = `object`

Defined in: [lib/uniswap/hooks.ts:3](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L3)

#### Properties

##### dataPoints

> **dataPoints**: `object`[]

Defined in: [lib/uniswap/hooks.ts:11](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L11)

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

Defined in: [lib/uniswap/hooks.ts:8](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L8)

##### poolId

> **poolId**: `string` \| `null`

Defined in: [lib/uniswap/hooks.ts:6](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L6)

##### priceChangePercent

> **priceChangePercent**: `number`

Defined in: [lib/uniswap/hooks.ts:10](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L10)

##### timeframe

> **timeframe**: `string`

Defined in: [lib/uniswap/hooks.ts:5](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L5)

##### tokenAddress

> **tokenAddress**: `string`

Defined in: [lib/uniswap/hooks.ts:4](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L4)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [lib/uniswap/hooks.ts:9](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L9)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [lib/uniswap/hooks.ts:7](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L7)

## Functions

### usePoolHistory()

> **usePoolHistory**(`tokenAddress`, `timeframe`, `options?`): `UseQueryResult`\<[`PoolHistoryData`](#poolhistorydata) \| `null`, `Error`\>

Defined in: [lib/uniswap/hooks.ts:58](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L58)

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

> **useUniswapServiceStatus**(): `UseQueryResult`\<\{ `available`: `boolean`; `reason`: `string`; \} \| \{ `available`: `boolean`; `reason`: `null`; \}, `Error`\>

Defined in: [lib/uniswap/hooks.ts:77](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/uniswap/hooks.ts#L77)

Check if Uniswap data service is available
This can be used to conditionally enable timeframe filters

#### Returns

`UseQueryResult`\<\{ `available`: `boolean`; `reason`: `string`; \} \| \{ `available`: `boolean`; `reason`: `null`; \}, `Error`\>
