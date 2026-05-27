[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/uniswap/hooks

# src/lib/uniswap/hooks

## Type Aliases

### PoolHistoryData

> **PoolHistoryData** = `object`

Defined in: [src/lib/uniswap/hooks.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L15)

#### Properties

##### dataPoints

> **dataPoints**: `object`[]

Defined in: [src/lib/uniswap/hooks.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L23)

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

Defined in: [src/lib/uniswap/hooks.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L20)

##### pool?

> `optional` **pool**: [`PoolTokenComposition`](#pooltokencomposition) \| `null`

Defined in: [src/lib/uniswap/hooks.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L33)

##### poolId

> **poolId**: `string` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L18)

##### priceChangePercent

> **priceChangePercent**: `number`

Defined in: [src/lib/uniswap/hooks.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L22)

##### timeframe

> **timeframe**: `string`

Defined in: [src/lib/uniswap/hooks.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L17)

##### tokenAddress

> **tokenAddress**: `string`

Defined in: [src/lib/uniswap/hooks.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L16)

##### tvlUSD

> **tvlUSD**: `number`

Defined in: [src/lib/uniswap/hooks.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L21)

##### volumeUSD

> **volumeUSD**: `number`

Defined in: [src/lib/uniswap/hooks.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L19)

***

### PoolTokenComposition

> **PoolTokenComposition** = `object`

Defined in: [src/lib/uniswap/hooks.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L5)

#### Properties

##### isQueriedTokenToken0

> **isQueriedTokenToken0**: `boolean`

Defined in: [src/lib/uniswap/hooks.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L12)

##### token0Symbol

> **token0Symbol**: `string` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L6)

##### token0UsdShare

> **token0UsdShare**: `number` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L8)

##### token0UsdTVL

> **token0UsdTVL**: `number` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L10)

##### token1Symbol

> **token1Symbol**: `string` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L7)

##### token1UsdShare

> **token1UsdShare**: `number` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L9)

##### token1UsdTVL

> **token1UsdTVL**: `number` \| `null`

Defined in: [src/lib/uniswap/hooks.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L11)

## Functions

### usePoolHistory()

> **usePoolHistory**(`tokenAddress`, `timeframe`, `options?`): `UseQueryResult`\<[`PoolHistoryData`](#poolhistorydata) \| `null`, `Error`\>

Defined in: [src/lib/uniswap/hooks.ts:146](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L146)

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

Defined in: [src/lib/uniswap/hooks.ts:165](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/uniswap/hooks.ts#L165)

Check if Uniswap data service is available
This can be used to conditionally enable timeframe filters

#### Returns

`UseQueryResult`\<\{ `available`: `boolean`; `reason`: `null`; \} \| \{ `available`: `boolean`; `reason`: `string`; \}, `Error`\>
