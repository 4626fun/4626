[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/zora/cswGateVerification

# server/\_lib/zora/cswGateVerification

## Type Aliases

### ZoraCswGateVerifyTokenRow

> **ZoraCswGateVerifyTokenRow** = `object`

Defined in: [server/\_lib/zora/cswGateVerification.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L10)

#### Properties

##### consumedAt

> **consumedAt**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L16)

##### consumedTelegramUserId

> **consumedTelegramUserId**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L17)

##### consumedTelegramUsername

> **consumedTelegramUsername**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L18)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L19)

##### cswAddress

> **cswAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/zora/cswGateVerification.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L12)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L15)

##### requestedTelegramUsername

> **requestedTelegramUsername**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L13)

##### sourceUrl

> **sourceUrl**: `string` \| `null`

Defined in: [server/\_lib/zora/cswGateVerification.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L14)

##### tokenHash

> **tokenHash**: `string`

Defined in: [server/\_lib/zora/cswGateVerification.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L11)

## Functions

### consumeZoraCswGateVerificationToken()

> **consumeZoraCswGateVerificationToken**(`params`): `Promise`\<\{ `ok`: `true`; `row`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \} \| \{ `ok`: `false`; `reason`: `"expired"` \| `"consumed"` \| `"invalid"`; `row?`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \}\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:168](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L168)

#### Parameters

##### params

###### db

`Db`

###### telegramUserId

`string`

###### telegramUsername

`string` \| `null`

###### token

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; `row`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \} \| \{ `ok`: `false`; `reason`: `"expired"` \| `"consumed"` \| `"invalid"`; `row?`: [`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow); \}\>

***

### ensureZoraCswGateVerificationSchema()

> **ensureZoraCswGateVerificationSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L50)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### issueZoraCswGateVerificationToken()

> **issueZoraCswGateVerificationToken**(`params`): `Promise`\<\{ `expiresAt`: `string`; `token`: `string`; `tokenHash`: `string`; \}\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L107)

#### Parameters

##### params

###### cswAddress

`` `0x${string}` ``

###### db

`Db`

###### requestedTelegramUsername?

`string` \| `null`

###### sourceUrl?

`string` \| `null`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `token`: `string`; `tokenHash`: `string`; \}\>

***

### readZoraCswGateVerificationToken()

> **readZoraCswGateVerificationToken**(`params`): `Promise`\<[`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow) \| `null`\>

Defined in: [server/\_lib/zora/cswGateVerification.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/zora/cswGateVerification.ts#L149)

#### Parameters

##### params

###### db

`Db`

###### token

`string`

#### Returns

`Promise`\<[`ZoraCswGateVerifyTokenRow`](#zoracswgateverifytokenrow) \| `null`\>
