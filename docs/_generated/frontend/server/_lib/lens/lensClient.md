[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lens/lensClient

# server/\_lib/lens/lensClient

## Functions

### lensGql()

> **lensGql**\<`T`\>(`query`, `variables?`): `Promise`\<`T`\>

Defined in: [server/\_lib/lens/lensClient.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/lens/lensClient.ts#L13)

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
