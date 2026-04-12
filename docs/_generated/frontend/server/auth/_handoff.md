[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_handoff

# server/auth/\_handoff

## Functions

### consumeHandoffCode()

> **consumeHandoffCode**(`db`, `code`): `Promise`\<\{ `address`: `string`; `privyToken`: `string` \| `null`; \} \| `null`\>

Defined in: [server/auth/\_handoff.ts:73](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_handoff.ts#L73)

#### Parameters

##### db

`DbWithSql`

##### code

`string`

#### Returns

`Promise`\<\{ `address`: `string`; `privyToken`: `string` \| `null`; \} \| `null`\>

***

### createHandoffCode()

> **createHandoffCode**(`db`, `params`): `Promise`\<\{ `code`: `string`; `expiresAt`: `string`; \}\>

Defined in: [server/auth/\_handoff.ts:57](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_handoff.ts#L57)

#### Parameters

##### db

`DbWithSql`

##### params

###### address

`string`

###### now?

`number`

###### privyToken?

`string` \| `null`

#### Returns

`Promise`\<\{ `code`: `string`; `expiresAt`: `string`; \}\>

***

### ensureHandoffSchema()

> **ensureHandoffSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/auth/\_handoff.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_handoff.ts#L31)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### makeHandoffCode()

> **makeHandoffCode**(): `string`

Defined in: [server/auth/\_handoff.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/auth/_handoff.ts#L11)

#### Returns

`string`
