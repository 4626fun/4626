[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_handoff

# server/auth/\_handoff

## Functions

### consumeHandoffCode()

> **consumeHandoffCode**(`db`, `code`): `Promise`\<\{ `address`: `string`; `privyToken`: `string` \| `null`; \} \| `null`\>

Defined in: [server/auth/\_handoff.ts:82](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_handoff.ts#L82)

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

Defined in: [server/auth/\_handoff.ts:66](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_handoff.ts#L66)

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

Defined in: [server/auth/\_handoff.ts:40](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_handoff.ts#L40)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### makeHandoffCode()

> **makeHandoffCode**(): `string`

Defined in: [server/auth/\_handoff.ts:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_handoff.ts#L11)

#### Returns

`string`
