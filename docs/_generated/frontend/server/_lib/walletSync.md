[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/walletSync

# server/\_lib/walletSync

## Type Aliases

### PersistedIdentity

> **PersistedIdentity** = `object`

Defined in: [server/\_lib/walletSync.ts:164](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L164)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:166](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L166)

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:167](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L167)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:168](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L168)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:170](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L170)

##### operationalSolanaWallet

> **operationalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:169](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L169)

##### preprovZoraHandle

> **preprovZoraHandle**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:171](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L171)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:165](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L165)

***

### SyncUserWalletsResult

> **SyncUserWalletsResult** = `object`

Defined in: [server/\_lib/walletSync.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L11)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: \{ `address`: `string`; `provider`: `string`; `walletType`: `string`; \} \| `null`

Defined in: [server/\_lib/walletSync.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L14)

##### canonicalSmartWallet

> **canonicalSmartWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/walletSync.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L13)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/walletSync.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L15)

##### connectedWallets

> **connectedWallets**: `object`[]

Defined in: [server/\_lib/walletSync.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L18)

###### address

> **address**: `string`

###### provider

> **provider**: `string`

###### walletType

> **walletType**: `string`

##### embeddedEoa

> **embeddedEoa**: \{ `address`: `string`; `chainType`: `string`; `clientType`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/walletSync.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L17)

##### operationalSolanaWallet

> **operationalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/walletSync.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L16)

##### primaryWalletAddress

> **primaryWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/walletSync.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L19)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/walletSync.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L12)

## Functions

### readPersistedIdentity()

> **readPersistedIdentity**(`db`, `profileId`): `Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

Defined in: [server/\_lib/walletSync.ts:174](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L174)

#### Parameters

##### db

`Db`

##### profileId

`number`

#### Returns

`Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

***

### syncUserWallets()

> **syncUserWallets**(`db`, `privyUser`): `Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>

Defined in: [server/\_lib/walletSync.ts:707](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/walletSync.ts#L707)

#### Parameters

##### db

`Db`

##### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

#### Returns

`Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>
