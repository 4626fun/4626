[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/creatorMetricsSync

# server/\_lib/zora/creatorMetricsSync

## Type Aliases

### CreatorMetricsExploreBackfillResult

> **CreatorMetricsExploreBackfillResult** = `object`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:571](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L571)

#### Properties

##### checkpoints

> **checkpoints**: [`ExploreBackfillCheckpoints`](creatorMetricsSyncHelpers.md#explorebackfillcheckpoints)

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:577](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L577)

##### coinsUpserted

> **coinsUpserted**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:574](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L574)

##### error?

> `optional` **error**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:579](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L579)

##### ethosProjectionRefreshedRows?

> `optional` **ethosProjectionRefreshedRows**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:578](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L578)

##### exploreBackfillComplete

> **exploreBackfillComplete**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:576](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L576)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:572](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L572)

##### pagesFetched

> **pagesFetched**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:575](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L575)

##### runId

> **runId**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:573](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L573)

***

### CreatorMetricsHotSyncResult

> **CreatorMetricsHotSyncResult** = `object`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1278](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1278)

#### Properties

##### coinsRefreshed

> **coinsRefreshed**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1281](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1281)

##### error?

> `optional` **error**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1288](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1288)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1279](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1279)

##### pagesFetched

> **pagesFetched**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1282](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1282)

##### runId

> **runId**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1280](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1280)

##### skipped?

> `optional` **skipped**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1287](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1287)

##### sparklinesAttempted?

> `optional` **sparklinesAttempted**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1284](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1284)

##### sparklinesFailed?

> `optional` **sparklinesFailed**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1286](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1286)

##### sparklinesRefreshed?

> `optional` **sparklinesRefreshed**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1283](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1283)

##### sparklinesSkippedFresh?

> `optional` **sparklinesSkippedFresh**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1285](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1285)

***

### CreatorMetricsSyncResult

> **CreatorMetricsSyncResult** = `object`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L36)

#### Properties

##### backfillComplete

> **backfillComplete**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L44)

##### coinsUpserted

> **coinsUpserted**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L42)

##### deadLetters

> **deadLetters**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L48)

##### driftEstimateTotal

> **driftEstimateTotal**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L46)

##### driftPct

> **driftPct**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L47)

##### error?

> `optional` **error**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L49)

##### mode

> **mode**: `SyncMode`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L39)

##### nextCursor

> **nextCursor**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L43)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L37)

##### pagesProcessed

> **pagesProcessed**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L40)

##### runId

> **runId**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L38)

##### sampledCreators

> **sampledCreators**: `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L41)

##### syncStatus

> **syncStatus**: `SyncStatus`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L45)

## Functions

### cachedTotalsMaxAgeMs()

> **cachedTotalsMaxAgeMs**(): `number`

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:915](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L915)

#### Returns

`number`

***

### ensureCreatorMetricsSchema()

> **ensureCreatorMetricsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:260](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L260)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### recomputeAndCacheCreatorMetricsTotals()

> **recomputeAndCacheCreatorMetricsTotals**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:890](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L890)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### recomputeCreatorCounts()

> **recomputeCreatorCounts**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1170](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1170)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### runCreatorEthosProjectionRefresh()

> **runCreatorEthosProjectionRefresh**(`options`): `Promise`\<\{ `appliedLimit`: `number`; `available`: `boolean`; `error?`: `string`; `ok`: `boolean`; `refreshedRows`: `number`; \}\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:613](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L613)

#### Parameters

##### options

###### limit?

`number`

#### Returns

`Promise`\<\{ `appliedLimit`: `number`; `available`: `boolean`; `error?`: `string`; `ok`: `boolean`; `refreshedRows`: `number`; \}\>

***

### runCreatorMetricsExploreBackfill()

> **runCreatorMetricsExploreBackfill**(`options`): `Promise`\<[`CreatorMetricsExploreBackfillResult`](#creatormetricsexplorebackfillresult)\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:658](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L658)

#### Parameters

##### options

`ExploreBackfillOptions` = `{}`

#### Returns

`Promise`\<[`CreatorMetricsExploreBackfillResult`](#creatormetricsexplorebackfillresult)\>

***

### runCreatorMetricsHotSync()

> **runCreatorMetricsHotSync**(): `Promise`\<[`CreatorMetricsHotSyncResult`](#creatormetricshotsyncresult)\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:919](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L919)

#### Returns

`Promise`\<[`CreatorMetricsHotSyncResult`](#creatormetricshotsyncresult)\>

***

### runCreatorMetricsSync()

> **runCreatorMetricsSync**(`options`): `Promise`\<[`CreatorMetricsSyncResult`](#creatormetricssyncresult)\>

Defined in: [server/\_lib/zora/creatorMetricsSync.ts:1294](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSync.ts#L1294)

#### Parameters

##### options

`RunOptions` = `{}`

#### Returns

`Promise`\<[`CreatorMetricsSyncResult`](#creatormetricssyncresult)\>
