[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/walletSync

# server/\_lib/wallet/walletSync

## Type Aliases

### PersistedIdentity

> **PersistedIdentity** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:247](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L247)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:249](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L249)

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:250](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L250)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:251](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L251)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:253](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L253)

##### operationalSolanaWallet

> **operationalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:252](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L252)

##### preprovZoraHandle

> **preprovZoraHandle**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:254](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L254)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:248](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L248)

***

### SyncUserWalletsResult

> **SyncUserWalletsResult** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L14)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: \{ `address`: `string`; `provider`: `string`; `walletType`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L17)

##### canonicalSmartWallet

> **canonicalSmartWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L16)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L18)

##### connectedWallets

> **connectedWallets**: `object`[]

Defined in: [server/\_lib/wallet/walletSync.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L21)

###### address

> **address**: `string`

###### provider

> **provider**: `string`

###### walletType

> **walletType**: `string`

##### embeddedEoa

> **embeddedEoa**: \{ `address`: `string`; `chainType`: `string`; `clientType`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L20)

##### operationalSolanaWallet

> **operationalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L19)

##### primaryWalletAddress

> **primaryWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L22)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/walletSync.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L15)

## Functions

### readPersistedIdentity()

> **readPersistedIdentity**(`db`, `profileId`): `Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

Defined in: [server/\_lib/wallet/walletSync.ts:257](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L257)

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

Defined in: [server/\_lib/wallet/walletSync.ts:806](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L806)

#### Parameters

##### db

`Db`

##### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

#### Returns

`Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>
