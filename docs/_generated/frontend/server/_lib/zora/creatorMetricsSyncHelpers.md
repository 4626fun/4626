[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora/creatorMetricsSyncHelpers

# server/\_lib/zora/creatorMetricsSyncHelpers

## Type Aliases

### ExploreBackfillCheckpoints

> **ExploreBackfillCheckpoints** = `Record`\<[`ExploreList`](#explorelist), [`ExploreListCheckpoint`](#explorelistcheckpoint)\>

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L126)

***

### ExploreCoinFinancialSnapshot

> **ExploreCoinFinancialSnapshot** = `object`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L4)

#### Properties

##### coinAddress

> **coinAddress**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L5)

##### createdAt

> **createdAt**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L7)

##### creatorAddress

> **creatorAddress**: `string`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L6)

##### feeModel

> **feeModel**: [`FeeModel`](#feemodel-1)

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L13)

##### fees24hUsd

> **fees24hUsd**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L10)

##### marketCapDelta24h

> **marketCapDelta24h**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L12)

##### marketCapUsd

> **marketCapUsd**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L8)

##### uniqueHolders

> **uniqueHolders**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L11)

##### volume24hUsd

> **volume24hUsd**: `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L9)

***

### ExploreList

> **ExploreList** = `"NEW_CREATORS"` \| `"TOP_VOLUME_CREATORS_24H"` \| `"MOST_VALUABLE_CREATORS"`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L1)

***

### ExploreListCheckpoint

> **ExploreListCheckpoint** = `object`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:121](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L121)

#### Properties

##### after

> **after**: `string` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L122)

##### complete

> **complete**: `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L123)

***

### FeeModel

> **FeeModel** = `"legacy"` \| `"v4"`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L2)

## Variables

### DEFAULT\_HOT\_REFRESH\_LISTS

> `const` **DEFAULT\_HOT\_REFRESH\_LISTS**: readonly [`ExploreList`](#explorelist)[]

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L38)

## Functions

### computeFees24hUsd()

> **computeFees24hUsd**(`volume24hUsd`, `feeModel`): `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L82)

#### Parameters

##### volume24hUsd

`number` | `null`

##### feeModel

[`FeeModel`](#feemodel-1)

#### Returns

`number` \| `null`

***

### createDefaultExploreBackfillCheckpoints()

> **createDefaultExploreBackfillCheckpoints**(): [`ExploreBackfillCheckpoints`](#explorebackfillcheckpoints)

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L132)

#### Returns

[`ExploreBackfillCheckpoints`](#explorebackfillcheckpoints)

***

### detectFeeModel()

> **detectFeeModel**(`coin`): [`FeeModel`](#feemodel-1)

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L63)

#### Parameters

##### coin

`CoinCandidate`

#### Returns

[`FeeModel`](#feemodel-1)

***

### extractExploreListEdges()

> **extractExploreListEdges**(`response`): `object`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:167](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L167)

#### Parameters

##### response

`unknown`

#### Returns

`object`

##### edges

> **edges**: `object`[]

##### pageInfo

> **pageInfo**: `object`

###### pageInfo.endCursor

> **endCursor**: `string` \| `null`

###### pageInfo.hasNextPage

> **hasNextPage**: `boolean`

***

### feeRateFromModel()

> **feeRateFromModel**(`feeModel`): `number`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L78)

#### Parameters

##### feeModel

[`FeeModel`](#feemodel-1)

#### Returns

`number`

***

### isExploreBackfillComplete()

> **isExploreBackfillComplete**(`checkpoints`): `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L163)

#### Parameters

##### checkpoints

[`ExploreBackfillCheckpoints`](#explorebackfillcheckpoints)

#### Returns

`boolean`

***

### isStaleRunningLock()

> **isStaleRunningLock**(`lastSyncStartedAt`, `nowMs`, `thresholdMs`): `boolean`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L110)

#### Parameters

##### lastSyncStartedAt

`string` | `null` | `undefined`

##### nowMs

`number`

##### thresholdMs

`number`

#### Returns

`boolean`

***

### normalizeAddress()

> **normalizeAddress**(`v`): `string` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L50)

#### Parameters

##### v

`unknown`

#### Returns

`string` \| `null`

***

### parseExploreBackfillCheckpoints()

> **parseExploreBackfillCheckpoints**(`raw`): [`ExploreBackfillCheckpoints`](#explorebackfillcheckpoints)

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L140)

#### Parameters

##### raw

`unknown`

#### Returns

[`ExploreBackfillCheckpoints`](#explorebackfillcheckpoints)

***

### parseExploreCoinFinancialSnapshot()

> **parseExploreCoinFinancialSnapshot**(`coin`): [`ExploreCoinFinancialSnapshot`](#explorecoinfinancialsnapshot) \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L87)

#### Parameters

##### coin

`unknown`

#### Returns

[`ExploreCoinFinancialSnapshot`](#explorecoinfinancialsnapshot) \| `null`

***

### parseTimestamp()

> **parseTimestamp**(`v`): `string` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L56)

#### Parameters

##### v

`unknown`

#### Returns

`string` \| `null`

***

### serializeExploreBackfillCheckpoints()

> **serializeExploreBackfillCheckpoints**(`checkpoints`): `string`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:159](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L159)

#### Parameters

##### checkpoints

[`ExploreBackfillCheckpoints`](#explorebackfillcheckpoints)

#### Returns

`string`

***

### toFiniteNumber()

> **toFiniteNumber**(`v`): `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L44)

#### Parameters

##### v

`unknown`

#### Returns

`number` \| `null`

***

### toIntegerOrNull()

> **toIntegerOrNull**(`v`): `number` \| `null`

Defined in: [server/\_lib/zora/creatorMetricsSyncHelpers.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/creatorMetricsSyncHelpers.ts#L28)

#### Parameters

##### v

`unknown`

#### Returns

`number` \| `null`
