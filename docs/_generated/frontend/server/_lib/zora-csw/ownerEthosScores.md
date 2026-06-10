[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-csw/ownerEthosScores

# server/\_lib/zora-csw/ownerEthosScores

## Type Aliases

### OwnerEthosRefreshResult

> **OwnerEthosRefreshResult** = `object`

Defined in: [server/\_lib/zora-csw/ownerEthosScores.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/ownerEthosScores.ts#L10)

#### Properties

##### attempted

> **attempted**: `number`

Defined in: [server/\_lib/zora-csw/ownerEthosScores.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/ownerEthosScores.ts#L11)

##### failed

> **failed**: `number`

Defined in: [server/\_lib/zora-csw/ownerEthosScores.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/ownerEthosScores.ts#L13)

##### skipped

> **skipped**: `number`

Defined in: [server/\_lib/zora-csw/ownerEthosScores.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/ownerEthosScores.ts#L14)

##### updated

> **updated**: `number`

Defined in: [server/\_lib/zora-csw/ownerEthosScores.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/ownerEthosScores.ts#L12)

## Functions

### refreshZoraOwnerEthosScores()

> **refreshZoraOwnerEthosScores**(`params`): `Promise`\<[`OwnerEthosRefreshResult`](#ownerethosrefreshresult)\>

Defined in: [server/\_lib/zora-csw/ownerEthosScores.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora-csw/ownerEthosScores.ts#L26)

#### Parameters

##### params

###### db

`SupabaseClient`

###### maxAddresses?

`number`

###### ownerAddresses

readonly `string`[]

#### Returns

`Promise`\<[`OwnerEthosRefreshResult`](#ownerethosrefreshresult)\>
