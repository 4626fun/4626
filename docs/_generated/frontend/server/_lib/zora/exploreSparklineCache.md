[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/exploreSparklineCache

# server/\_lib/zora/exploreSparklineCache

## Variables

### SPARKLINE\_DB\_TTL\_MS

> `const` **SPARKLINE\_DB\_TTL\_MS**: `number`

Defined in: [server/\_lib/zora/exploreSparklineCache.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/exploreSparklineCache.ts#L9)

Reuse cached sparklines on explore reads for this long before forcing a Zora refetch.

## Functions

### isSparklineDbRowFresh()

> **isSparklineDbRowFresh**(`updatedAt`, `nowMs`): `boolean`

Defined in: [server/\_lib/zora/exploreSparklineCache.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/exploreSparklineCache.ts#L21)

#### Parameters

##### updatedAt

`unknown`

##### nowMs

`number` = `...`

#### Returns

`boolean`

***

### parseSparklineValuesFromDb()

> **parseSparklineValuesFromDb**(`raw`): `number`[]

Defined in: [server/\_lib/zora/exploreSparklineCache.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/exploreSparklineCache.ts#L11)

#### Parameters

##### raw

`unknown`

#### Returns

`number`[]

***

### persistExploreSparklinesToDb()

> **persistExploreSparklinesToDb**(`db`, `rows`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/exploreSparklineCache.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/exploreSparklineCache.ts#L28)

#### Parameters

##### db

[`DbPool`](../db/postgres.md#dbpool)

##### rows

readonly [`CoinPriceSparklineResult`](coinPriceSparkline.md#coinpricesparklineresult)[]

#### Returns

`Promise`\<`void`\>
