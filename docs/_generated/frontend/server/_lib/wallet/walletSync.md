[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/walletSync

# server/\_lib/wallet/walletSync

## Type Aliases

### PersistedIdentity

> **PersistedIdentity** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:208](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L208)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:210](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L210)

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:211](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L211)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:212](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L212)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:214](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L214)

##### operationalSolanaWallet

> **operationalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:213](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L213)

##### preprovZoraHandle

> **preprovZoraHandle**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:215](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L215)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:209](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L209)

***

### SyncUserWalletsResult

> **SyncUserWalletsResult** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L14)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: \{ `address`: `string`; `provider`: `string`; `walletType`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L17)

##### canonicalSmartWallet

> **canonicalSmartWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L16)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L18)

##### connectedWallets

> **connectedWallets**: `object`[]

Defined in: [server/\_lib/wallet/walletSync.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L21)

###### address

> **address**: `string`

###### provider

> **provider**: `string`

###### walletType

> **walletType**: `string`

##### embeddedEoa

> **embeddedEoa**: \{ `address`: `string`; `chainType`: `string`; `clientType`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L20)

##### operationalSolanaWallet

> **operationalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L19)

##### primaryWalletAddress

> **primaryWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L22)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/walletSync.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L15)

## Functions

### readPersistedIdentity()

> **readPersistedIdentity**(`db`, `profileId`): `Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

Defined in: [server/\_lib/wallet/walletSync.ts:218](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L218)

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

Defined in: [server/\_lib/wallet/walletSync.ts:767](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/wallet/walletSync.ts#L767)

#### Parameters

##### db

`Db`

##### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

#### Returns

`Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>
