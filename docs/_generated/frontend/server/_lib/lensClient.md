[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/lensClient

# server/\_lib/lensClient

## Functions

### lensGql()

> **lensGql**\<`T`\>(`query`, `variables?`): `Promise`\<`T`\>

Defined in: [server/\_lib/lensClient.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lensClient.ts#L13)

Execute a typed GraphQL query against the Lens V3 API.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### query

`string`

##### variables?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`T`\>
