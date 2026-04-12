[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/creatorMetricsSync

# server/\_lib/creatorMetricsSync

## Type Aliases

### CreatorMetricsSyncResult

> **CreatorMetricsSyncResult** = `object`

Defined in: [server/\_lib/creatorMetricsSync.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L17)

#### Properties

##### backfillComplete

> **backfillComplete**: `boolean`

Defined in: [server/\_lib/creatorMetricsSync.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L25)

##### coinsUpserted

> **coinsUpserted**: `number`

Defined in: [server/\_lib/creatorMetricsSync.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L23)

##### deadLetters

> **deadLetters**: `number`

Defined in: [server/\_lib/creatorMetricsSync.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L29)

##### driftEstimateTotal

> **driftEstimateTotal**: `number` \| `null`

Defined in: [server/\_lib/creatorMetricsSync.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L27)

##### driftPct

> **driftPct**: `number` \| `null`

Defined in: [server/\_lib/creatorMetricsSync.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L28)

##### error?

> `optional` **error**: `string`

Defined in: [server/\_lib/creatorMetricsSync.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L30)

##### mode

> **mode**: `SyncMode`

Defined in: [server/\_lib/creatorMetricsSync.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L20)

##### nextCursor

> **nextCursor**: `string` \| `null`

Defined in: [server/\_lib/creatorMetricsSync.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L24)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/creatorMetricsSync.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L18)

##### pagesProcessed

> **pagesProcessed**: `number`

Defined in: [server/\_lib/creatorMetricsSync.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L21)

##### runId

> **runId**: `string`

Defined in: [server/\_lib/creatorMetricsSync.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L19)

##### sampledCreators

> **sampledCreators**: `number`

Defined in: [server/\_lib/creatorMetricsSync.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L22)

##### syncStatus

> **syncStatus**: `SyncStatus`

Defined in: [server/\_lib/creatorMetricsSync.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L26)

## Functions

### ensureCreatorMetricsSchema()

> **ensureCreatorMetricsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/creatorMetricsSync.ts:208](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L208)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### runCreatorMetricsSync()

> **runCreatorMetricsSync**(`options`): `Promise`\<[`CreatorMetricsSyncResult`](#creatormetricssyncresult)\>

Defined in: [server/\_lib/creatorMetricsSync.ts:433](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/creatorMetricsSync.ts#L433)

#### Parameters

##### options

`RunOptions` = `{}`

#### Returns

`Promise`\<[`CreatorMetricsSyncResult`](#creatormetricssyncresult)\>
