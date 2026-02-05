[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/dexscreener/client

# src/lib/dexscreener/client

## Type Aliases

### DexscreenerTokenStats

> **DexscreenerTokenStats** = `object`

Defined in: [lib/dexscreener/client.ts:3](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L3)

#### Properties

##### address

> **address**: `string`

Defined in: [lib/dexscreener/client.ts:4](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L4)

##### chainId

> **chainId**: `string`

Defined in: [lib/dexscreener/client.ts:5](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L5)

##### change1h?

> `optional` **change1h**: `number`

Defined in: [lib/dexscreener/client.ts:17](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L17)

##### change24h?

> `optional` **change24h**: `number`

Defined in: [lib/dexscreener/client.ts:19](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L19)

##### change5m?

> `optional` **change5m**: `number`

Defined in: [lib/dexscreener/client.ts:16](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L16)

Fractions (0.05 == +5%)

##### change6h?

> `optional` **change6h**: `number`

Defined in: [lib/dexscreener/client.ts:18](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L18)

##### fdvUsd?

> `optional` **fdvUsd**: `number`

Defined in: [lib/dexscreener/client.ts:9](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L9)

##### liquidityUsd?

> `optional` **liquidityUsd**: `number`

Defined in: [lib/dexscreener/client.ts:10](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L10)

##### marketCapUsd?

> `optional` **marketCapUsd**: `number`

Defined in: [lib/dexscreener/client.ts:8](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L8)

##### pairAddress?

> `optional` **pairAddress**: `string`

Defined in: [lib/dexscreener/client.ts:6](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L6)

##### url?

> `optional` **url**: `string`

Defined in: [lib/dexscreener/client.ts:7](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L7)

##### volumeUsd1h?

> `optional` **volumeUsd1h**: `number`

Defined in: [lib/dexscreener/client.ts:12](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L12)

##### volumeUsd24h?

> `optional` **volumeUsd24h**: `number`

Defined in: [lib/dexscreener/client.ts:14](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L14)

##### volumeUsd5m?

> `optional` **volumeUsd5m**: `number`

Defined in: [lib/dexscreener/client.ts:11](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L11)

##### volumeUsd6h?

> `optional` **volumeUsd6h**: `number`

Defined in: [lib/dexscreener/client.ts:13](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L13)

***

### DexscreenerTokenStatsBatch

> **DexscreenerTokenStatsBatch** = `object`

Defined in: [lib/dexscreener/client.ts:22](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L22)

#### Properties

##### asOf

> **asOf**: `number`

Defined in: [lib/dexscreener/client.ts:23](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L23)

##### chainId

> **chainId**: `string`

Defined in: [lib/dexscreener/client.ts:24](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L24)

##### results

> **results**: `Record`\<`string`, [`DexscreenerTokenStats`](#dexscreenertokenstats) \| `null`\>

Defined in: [lib/dexscreener/client.ts:25](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L25)

## Functions

### fetchDexscreenerTokenStatsBatch()

> **fetchDexscreenerTokenStatsBatch**(`params`): `Promise`\<[`DexscreenerTokenStatsBatch`](#dexscreenertokenstatsbatch) \| `null`\>

Defined in: [lib/dexscreener/client.ts:58](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/dexscreener/client.ts#L58)

#### Parameters

##### params

###### addresses

`string`[]

###### chainId?

`string`

#### Returns

`Promise`\<[`DexscreenerTokenStatsBatch`](#dexscreenertokenstatsbatch) \| `null`\>
