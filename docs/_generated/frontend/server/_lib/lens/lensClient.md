[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/lens/lensClient

# server/\_lib/lens/lensClient

## Functions

### lensGql()

> **lensGql**\<`T`\>(`query`, `variables?`): `Promise`\<`T`\>

Defined in: [server/\_lib/lens/lensClient.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/lens/lensClient.ts#L13)

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
