[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-profiles/scanTopProfiles

# server/\_lib/zora-profiles/scanTopProfiles

## Type Aliases

### ProfileScanResult

> **ProfileScanResult** = `object`

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L15)

#### Properties

##### coinsFetched

> **coinsFetched**: `number`

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L16)

##### listType

> **listType**: `string`

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L20)

##### pages

> **pages**: `number`

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L19)

##### profilesUpserted

> **profilesUpserted**: `number`

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L17)

##### skippedNoHandle

> **skippedNoHandle**: `number`

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L18)

## Functions

### chunkProfileRows()

> **chunkProfileRows**\<`T`\>(`items`, `batchSize`): `T`[][]

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L72)

#### Type Parameters

##### T

`T`

#### Parameters

##### items

`T`[]

##### batchSize

`number`

#### Returns

`T`[][]

***

### scanTopProfilesFromExplore()

> **scanTopProfilesFromExplore**(`db`, `apiKey`): `Promise`\<[`ProfileScanResult`](#profilescanresult)\>

Defined in: [server/\_lib/zora-profiles/scanTopProfiles.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-profiles/scanTopProfiles.ts#L92)

#### Parameters

##### db

`SupabaseUpsertClient`

##### apiKey

`string`

#### Returns

`Promise`\<[`ProfileScanResult`](#profilescanresult)\>
