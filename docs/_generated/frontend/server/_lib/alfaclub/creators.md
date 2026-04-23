[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/creators

# server/\_lib/alfaclub/creators

## Type Aliases

### AlfaClubCreator

> **AlfaClubCreator** = `object`

Defined in: [server/\_lib/alfaclub/creators.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L51)

#### Properties

##### creatorAddress

> **creatorAddress**: `Address`

Defined in: [server/\_lib/alfaclub/creators.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L53)

##### mintedAtBlock

> **mintedAtBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L54)

##### stakingPool

> **stakingPool**: `Address` \| `null`

Defined in: [server/\_lib/alfaclub/creators.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L55)

##### tokenId

> **tokenId**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L52)

***

### IndexerReport

> **IndexerReport** = `object`

Defined in: [server/\_lib/alfaclub/creators.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L58)

#### Properties

##### dbConfigured

> **dbConfigured**: `boolean`

Defined in: [server/\_lib/alfaclub/creators.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L61)

##### newCreators

> **newCreators**: `number`

Defined in: [server/\_lib/alfaclub/creators.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L64)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/creators.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L59)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/creators.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L60)

##### scannedFromBlock

> **scannedFromBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L62)

##### scannedToBlock

> **scannedToBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L63)

##### totalKnownCreators

> **totalKnownCreators**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/creators.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L65)

***

### RunIndexerOptions

> **RunIndexerOptions** = `object`

Defined in: [server/\_lib/alfaclub/creators.ts:303](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L303)

#### Properties

##### client?

> `optional` **client**: [`AlfaClubPublicClientLike`](../wallet/alfaclub.md#alfaclubpublicclientlike)

Defined in: [server/\_lib/alfaclub/creators.ts:304](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L304)

##### fromBlock?

> `optional` **fromBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:305](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L305)

##### maxChunks?

> `optional` **maxChunks**: `number`

Defined in: [server/\_lib/alfaclub/creators.ts:307](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L307)

##### skipSchemaBootstrap?

> `optional` **skipSchemaBootstrap**: `boolean`

Defined in: [server/\_lib/alfaclub/creators.ts:308](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L308)

##### toBlock?

> `optional` **toBlock**: `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:306](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L306)

## Functions

### getAlfaClubDeployBlock()

> **getAlfaClubDeployBlock**(): `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L127)

Returns the configured deploy-block floor.

#### Returns

`bigint`

***

### getAlfaClubMaxChunks()

> **getAlfaClubMaxChunks**(): `number`

Defined in: [server/\_lib/alfaclub/creators.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L137)

Returns the max chunks per run.

#### Returns

`number`

***

### getAlfaClubScanChunk()

> **getAlfaClubScanChunk**(): `bigint`

Defined in: [server/\_lib/alfaclub/creators.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L132)

Returns the scan chunk size.

#### Returns

`bigint`

***

### listAllCreators()

> **listAllCreators**(): `Promise`\<[`AlfaClubCreator`](#alfaclubcreator)[]\>

Defined in: [server/\_lib/alfaclub/creators.ts:234](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L234)

Return all known (tokenId, creator) pairs, lowercased.

#### Returns

`Promise`\<[`AlfaClubCreator`](#alfaclubcreator)[]\>

***

### runCreatorIndexer()

> **runCreatorIndexer**(`opts`): `Promise`\<[`IndexerReport`](#indexerreport)\>

Defined in: [server/\_lib/alfaclub/creators.ts:316](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creators.ts#L316)

Scan FriendKey for new creators between the stored cursor (or deploy block)
and the chain head. Persists newly-discovered creators in Supabase and
advances the cursor. Safe to re-run.

#### Parameters

##### opts

[`RunIndexerOptions`](#runindexeroptions) = `{}`

#### Returns

`Promise`\<[`IndexerReport`](#indexerreport)\>
