[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/chatTokenStore

# server/\_lib/alfaclub/chatTokenStore

## Type Aliases

### AlfaClubChatTokenMeta

> **AlfaClubChatTokenMeta** = `object`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L60)

#### Properties

##### expiresAt

> **expiresAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L63)

##### hasToken

> **hasToken**: `boolean`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L61)

##### isExpired

> **isExpired**: `boolean` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L65)

##### updatedAt

> **updatedAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L62)

##### updatedBy

> **updatedBy**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L64)

***

### AlfaClubChatTokenRecord

> **AlfaClubChatTokenRecord** = `object`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L46)

#### Properties

##### expiresAt

> **expiresAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L49)

##### jwt

> **jwt**: `string`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L47)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L48)

##### updatedBy

> **updatedBy**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L50)

***

### AlfaClubPrivySecretRecord

> **AlfaClubPrivySecretRecord** = `object`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L53)

#### Properties

##### expiresAt

> **expiresAt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L56)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L55)

##### updatedBy

> **updatedBy**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L57)

##### value

> **value**: `string`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L54)

## Functions

### clearAlfaClubChatToken()

> **clearAlfaClubChatToken**(`params?`): `Promise`\<[`AlfaClubChatTokenMeta`](#alfaclubchattokenmeta) \| `null`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:395](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L395)

#### Parameters

##### params?

###### clearedBy?

`string` \| `null`

#### Returns

`Promise`\<[`AlfaClubChatTokenMeta`](#alfaclubchattokenmeta) \| `null`\>

***

### extractJwtExpiryIso()

> **extractJwtExpiryIso**(`jwt`): `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L93)

Returns an ISO timestamp for JWT exp when present/valid, otherwise null.

#### Parameters

##### jwt

`string`

#### Returns

`string` \| `null`

***

### readAlfaClubChatToken()

> **readAlfaClubChatToken**(): `Promise`\<[`AlfaClubChatTokenRecord`](#alfaclubchattokenrecord) \| `null`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L126)

#### Returns

`Promise`\<[`AlfaClubChatTokenRecord`](#alfaclubchattokenrecord) \| `null`\>

***

### readAlfaClubChatTokenMeta()

> **readAlfaClubChatTokenMeta**(): `Promise`\<[`AlfaClubChatTokenMeta`](#alfaclubchattokenmeta)\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:153](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L153)

#### Returns

`Promise`\<[`AlfaClubChatTokenMeta`](#alfaclubchattokenmeta)\>

***

### readAlfaClubPrivyAccessToken()

> **readAlfaClubPrivyAccessToken**(): `Promise`\<[`AlfaClubPrivySecretRecord`](#alfaclubprivysecretrecord) \| `null`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:360](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L360)

#### Returns

`Promise`\<[`AlfaClubPrivySecretRecord`](#alfaclubprivysecretrecord) \| `null`\>

***

### readAlfaClubPrivyRefreshToken()

> **readAlfaClubPrivyRefreshToken**(): `Promise`\<[`AlfaClubPrivySecretRecord`](#alfaclubprivysecretrecord) \| `null`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:364](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L364)

#### Returns

`Promise`\<[`AlfaClubPrivySecretRecord`](#alfaclubprivysecretrecord) \| `null`\>

***

### upsertAlfaClubChatToken()

> **upsertAlfaClubChatToken**(`params`): `Promise`\<[`AlfaClubChatTokenMeta`](#alfaclubchattokenmeta) \| `null`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:188](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L188)

#### Parameters

##### params

###### jwt

`string`

###### updatedBy?

`string` \| `null`

#### Returns

`Promise`\<[`AlfaClubChatTokenMeta`](#alfaclubchattokenmeta) \| `null`\>

***

### upsertAlfaClubPrivyAccessToken()

> **upsertAlfaClubPrivyAccessToken**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:368](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L368)

#### Parameters

##### params

###### accessToken

`string`

###### updatedBy?

`string` \| `null`

#### Returns

`Promise`\<`boolean`\>

***

### upsertAlfaClubPrivyRefreshToken()

> **upsertAlfaClubPrivyRefreshToken**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/chatTokenStore.ts:380](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatTokenStore.ts#L380)

#### Parameters

##### params

###### refreshToken

`string`

###### updatedBy?

`string` \| `null`

#### Returns

`Promise`\<`boolean`\>
