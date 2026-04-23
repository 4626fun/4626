[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_handoff

# server/auth/\_handoff

## Functions

### consumeHandoffCode()

> **consumeHandoffCode**(`db`, `code`): `Promise`\<\{ `address`: `string`; `privyToken`: `string` \| `null`; \} \| `null`\>

Defined in: [server/auth/\_handoff.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_handoff.ts#L145)

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

Defined in: [server/auth/\_handoff.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_handoff.ts#L127)

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

### decryptPrivyToken()

> **decryptPrivyToken**(`stored`): `string` \| `null`

Defined in: [server/auth/\_handoff.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_handoff.ts#L80)

#### Parameters

##### stored

`string`

#### Returns

`string` \| `null`

***

### encryptPrivyToken()

> **encryptPrivyToken**(`token`): `string`

Defined in: [server/auth/\_handoff.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_handoff.ts#L72)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### ensureHandoffSchema()

> **ensureHandoffSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/auth/\_handoff.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_handoff.ts#L101)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### makeHandoffCode()

> **makeHandoffCode**(): `string`

Defined in: [server/auth/\_handoff.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_handoff.ts#L11)

#### Returns

`string`
