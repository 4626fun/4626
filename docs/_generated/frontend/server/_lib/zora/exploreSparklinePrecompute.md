[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/exploreSparklinePrecompute

# server/\_lib/zora/exploreSparklinePrecompute

## Type Aliases

### ExploreSparklinePrecomputeResult

> **ExploreSparklinePrecomputeResult** = `object`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L15)

#### Properties

##### attempted

> **attempted**: `number`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L16)

##### disabled?

> `optional` **disabled**: `boolean`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L20)

##### failed

> **failed**: `number`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L19)

##### refreshed

> **refreshed**: `number`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L17)

##### skippedFresh

> **skippedFresh**: `number`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L18)

## Variables

### DEFAULT\_SPARKLINE\_PRECOMPUTE\_BUDGET

> `const` **DEFAULT\_SPARKLINE\_PRECOMPUTE\_BUDGET**: `96` = `96`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L12)

***

### DEFAULT\_SPARKLINE\_PRECOMPUTE\_CONCURRENCY

> `const` **DEFAULT\_SPARKLINE\_PRECOMPUTE\_CONCURRENCY**: `8` = `8`

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L13)

## Functions

### listStaleSparklineCoinAddresses()

> **listStaleSparklineCoinAddresses**(`db`, `candidates`): `Promise`\<`Set`\<`string`\>\>

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L54)

#### Parameters

##### db

[`DbPool`](../db/postgres.md#dbpool)

##### candidates

readonly `string`[]

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### listTopVolumeStaleSparklineCoinAddresses()

> **listTopVolumeStaleSparklineCoinAddresses**(`db`, `limit`, `exclude`): `Promise`\<`string`[]\>

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L83)

#### Parameters

##### db

[`DbPool`](../db/postgres.md#dbpool)

##### limit

`number`

##### exclude

`ReadonlySet`\<`string`\>

#### Returns

`Promise`\<`string`[]\>

***

### normalizeSparklineCoinAddresses()

> **normalizeSparklineCoinAddresses**(`addresses`): `string`[]

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L29)

#### Parameters

##### addresses

readonly `string`[]

#### Returns

`string`[]

***

### precomputeExploreSparklinesForCoins()

> **precomputeExploreSparklinesForCoins**(`sdk`, `db`, `options`): `Promise`\<[`ExploreSparklinePrecomputeResult`](#exploresparklineprecomputeresult)\>

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L136)

#### Parameters

##### sdk

`unknown`

##### db

[`DbPool`](../db/postgres.md#dbpool)

##### options

###### budget?

`number`

###### coinAddresses

readonly `string`[]

###### concurrency?

`number`

###### fillFromTopVolume?

`boolean`

#### Returns

`Promise`\<[`ExploreSparklinePrecomputeResult`](#exploresparklineprecomputeresult)\>

***

### prioritizeSparklineCandidates()

> **prioritizeSparklineCandidates**(`orderedCandidates`, `staleAddresses`, `budget`): `string`[]

Defined in: [server/\_lib/zora/exploreSparklinePrecompute.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora/exploreSparklinePrecompute.ts#L39)

#### Parameters

##### orderedCandidates

readonly `string`[]

##### staleAddresses

`ReadonlySet`\<`string`\>

##### budget

`number`

#### Returns

`string`[]
