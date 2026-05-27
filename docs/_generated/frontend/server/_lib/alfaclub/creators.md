[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/creators

# server/\_lib/alfaclub/creators

## Type Aliases

### AlfaClubCreator

> **AlfaClubCreator** = `object`

Defined in: [server/\_lib/alfaclub/creators.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L62)

#### Properties

##### creatorAddress

> **creatorAddress**: `Address`

Defined in: [server/\_lib/alfaclub/creators.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L64)

##### mintedAtBlock

> **mintedAtBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L65)

##### stakingPool

> **stakingPool**: `Address` \| `null`

Defined in: [server/\_lib/alfaclub/creators.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L66)

##### tokenId

> **tokenId**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L63)

***

### IndexerReport

> **IndexerReport** = `object`

Defined in: [server/\_lib/alfaclub/creators.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L69)

#### Properties

##### dbConfigured

> **dbConfigured**: `boolean`

Defined in: [server/\_lib/alfaclub/creators.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L72)

##### newCreators

> **newCreators**: `number`

Defined in: [server/\_lib/alfaclub/creators.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L75)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/creators.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L70)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/creators.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L71)

##### scannedFromBlock

> **scannedFromBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L73)

##### scannedToBlock

> **scannedToBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L74)

##### totalKnownCreators

> **totalKnownCreators**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/creators.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L76)

***

### RunIndexerOptions

> **RunIndexerOptions** = `object`

Defined in: [server/\_lib/alfaclub/creators.ts:314](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L314)

#### Properties

##### client?

> `optional` **client**: [`AlfaClubPublicClientLike`](../wallet/alfaclub.md#alfaclubpublicclientlike)

Defined in: [server/\_lib/alfaclub/creators.ts:315](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L315)

##### fromBlock?

> `optional` **fromBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:316](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L316)

##### maxChunks?

> `optional` **maxChunks**: `number`

Defined in: [server/\_lib/alfaclub/creators.ts:318](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L318)

##### skipSchemaBootstrap?

> `optional` **skipSchemaBootstrap**: `boolean`

Defined in: [server/\_lib/alfaclub/creators.ts:319](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L319)

##### toBlock?

> `optional` **toBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:317](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L317)

## Functions

### getAlfaClubDeployBlock()

> **getAlfaClubDeployBlock**(): `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:138](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L138)

Returns the configured deploy-block floor.

#### Returns

`bigint`

***

### getAlfaClubMaxChunks()

> **getAlfaClubMaxChunks**(): `number`

Defined in: [server/\_lib/alfaclub/creators.ts:148](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L148)

Returns the max chunks per run.

#### Returns

`number`

***

### getAlfaClubScanChunk()

> **getAlfaClubScanChunk**(): `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:143](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L143)

Returns the scan chunk size.

#### Returns

`bigint`

***

### listAllCreators()

> **listAllCreators**(): `Promise`\<[`AlfaClubCreator`](#alfaclubcreator)[]\>

Defined in: [server/\_lib/alfaclub/creators.ts:245](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L245)

Return all known (tokenId, creator) pairs, lowercased.

#### Returns

`Promise`\<[`AlfaClubCreator`](#alfaclubcreator)[]\>

***

### runCreatorIndexer()

> **runCreatorIndexer**(`opts`): `Promise`\<[`IndexerReport`](#indexerreport)\>

Defined in: [server/\_lib/alfaclub/creators.ts:327](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/creators.ts#L327)

Scan FriendKey for new creators between the stored cursor (or deploy block)
and the chain head. Persists newly-discovered creators in Supabase and
advances the cursor. Safe to re-run.

#### Parameters

##### opts

[`RunIndexerOptions`](#runindexeroptions) = `{}`

#### Returns

`Promise`\<[`IndexerReport`](#indexerreport)\>
