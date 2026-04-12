[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/profileSync

# server/\_lib/profileSync

## Type Aliases

### ProfileWalletUpsertInput

> **ProfileWalletUpsertInput** = `object`

Defined in: [server/\_lib/profileSync.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L25)

#### Properties

##### baseSubAccount?

> `optional` **baseSubAccount**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L33)

##### cswAddress?

> `optional` **cswAddress**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:32](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L32)

##### email?

> `optional` **email**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L26)

##### embeddedWallet?

> `optional` **embeddedWallet**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L28)

##### embeddedWalletChain?

> `optional` **embeddedWalletChain**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L29)

##### embeddedWalletClientType?

> `optional` **embeddedWalletClientType**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L30)

##### primaryWallet?

> `optional` **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L27)

##### privyUserId?

> `optional` **privyUserId**: `string` \| `null`

Defined in: [server/\_lib/profileSync.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L31)

## Functions

### upsertProfileByWallet()

> **upsertProfileByWallet**(`db`, `input`): `Promise`\<`void`\>

Defined in: [server/\_lib/profileSync.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/profileSync.ts#L36)

#### Parameters

##### db

`Db`

##### input

[`ProfileWalletUpsertInput`](#profilewalletupsertinput)

#### Returns

`Promise`\<`void`\>
