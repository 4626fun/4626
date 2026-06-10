[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/explore/exploreCreatorsMetrics

# src/features/explore/exploreCreatorsMetrics

## Type Aliases

### ExploreCreatorsMetrics

> **ExploreCreatorsMetrics** = `object`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L13)

#### Properties

##### exact

> **exact**: `boolean`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L16)

##### history30d

> **history30d**: `object`[]

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L42)

###### creatorCoinsMarketCapUsd

> **creatorCoinsMarketCapUsd**: `number` \| `null`

###### date

> **date**: `string`

##### scope

> **scope**: `"creators"`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L14)

##### sync

> **sync**: `object`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L18)

###### backfillComplete

> **backfillComplete**: `boolean`

###### driftEstimateTotal

> **driftEstimateTotal**: `number` \| `null`

###### driftPct

> **driftPct**: `number` \| `null`

###### exploreBackfillComplete

> **exploreBackfillComplete**: `boolean`

###### lastFullSyncAt

> **lastFullSyncAt**: `string` \| `null`

###### lastSyncFinishedAt

> **lastSyncFinishedAt**: `string` \| `null`

###### lastSyncStartedAt

> **lastSyncStartedAt**: `string` \| `null`

###### sampledCreators

> **sampledCreators**: `number`

###### syncError

> **syncError**: `string` \| `null`

##### syncStatus

> **syncStatus**: `"idle"` \| `"running"` \| `"error"`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L17)

##### totals

> **totals**: `object`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L29)

###### creatorCoinsFees24hUsd

> **creatorCoinsFees24hUsd**: `number` \| `null`

###### creatorCoinsMarketCapUsd

> **creatorCoinsMarketCapUsd**: `number` \| `null`

###### creatorCoinsVolume24hUsd

> **creatorCoinsVolume24hUsd**: `number` \| `null`

###### creatorsNew24h

> **creatorsNew24h**: `number` \| `null`

###### creatorsTotal

> **creatorsTotal**: `number` \| `null`

###### ethos1200Creators

> **ethos1200Creators**: `number` \| `null`

###### ethos1600Creators

> **ethos1600Creators**: `number` \| `null`

###### ethos1800Creators

> **ethos1800Creators**: `number` \| `null`

###### ethosScoredCreators

> **ethosScoredCreators**: `number` \| `null`

###### partial

> **partial**: `boolean`

###### sampledCreators

> **sampledCreators**: `number`

##### updatedAt

> **updatedAt**: `string`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L15)

## Variables

### EXPLORE\_CREATORS\_METRICS\_QUERY\_KEY

> `const` **EXPLORE\_CREATORS\_METRICS\_QUERY\_KEY**: readonly \[`"explore"`, `"creators"`, `"metrics"`, `"shared-dashboard"`\]

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L5)

***

### LIVE\_HERO\_METRICS\_REFETCH\_MS

> `const` **LIVE\_HERO\_METRICS\_REFETCH\_MS**: `120000` = `120_000`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L7)

Align with server metrics cache (~5 min) to avoid redundant polls.

## Functions

### buildExploreHeroStatusLine()

> **buildExploreHeroStatusLine**(`input`): `string`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L92)

#### Parameters

##### input

###### creatorsTotal

`number` \| `null`

###### exact

`boolean`

###### syncMeta

\{ `backfillComplete`: `boolean`; `driftEstimateTotal`: `number` \| `null`; `driftPct`: `number` \| `null`; `exploreBackfillComplete`: `boolean`; `lastFullSyncAt`: `string` \| `null`; `lastSyncFinishedAt`: `string` \| `null`; `lastSyncStartedAt`: `string` \| `null`; `sampledCreators`: `number`; `syncError`: `string` \| `null`; \} \| `null`

###### syncStatus

`"error"` \| `"idle"` \| `"running"`

###### updatedAt

`string` \| `null`

#### Returns

`string`

***

### fetchExploreCreatorsMetrics()

> **fetchExploreCreatorsMetrics**(): `Promise`\<[`ExploreCreatorsMetrics`](#explorecreatorsmetrics) \| `null`\>

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L81)

#### Returns

`Promise`\<[`ExploreCreatorsMetrics`](#explorecreatorsmetrics) \| `null`\>

***

### readCachedExploreCreatorsMetrics()

> **readCachedExploreCreatorsMetrics**(): [`ExploreCreatorsMetrics`](#explorecreatorsmetrics) \| `null`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L64)

#### Returns

[`ExploreCreatorsMetrics`](#explorecreatorsmetrics) \| `null`

***

### writeCachedExploreCreatorsMetrics()

> **writeCachedExploreCreatorsMetrics**(`metrics`): `void`

Defined in: [src/features/explore/exploreCreatorsMetrics.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreCreatorsMetrics.ts#L68)

#### Parameters

##### metrics

[`ExploreCreatorsMetrics`](#explorecreatorsmetrics) | `null`

#### Returns

`void`
