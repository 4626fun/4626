[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/walletSync

# server/\_lib/wallet/walletSync

## Type Aliases

### PersistedIdentity

> **PersistedIdentity** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:252](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L252)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:254](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L254)

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:255](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L255)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:256](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L256)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:258](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L258)

##### operationalSolanaWallet

> **operationalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:257](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L257)

##### preprovZoraHandle

> **preprovZoraHandle**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:259](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L259)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:253](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L253)

***

### SyncUserWalletsResult

> **SyncUserWalletsResult** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L19)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: \{ `address`: `string`; `provider`: `string`; `walletType`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L22)

##### canonicalSmartWallet

> **canonicalSmartWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L21)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L23)

##### connectedWallets

> **connectedWallets**: `object`[]

Defined in: [server/\_lib/wallet/walletSync.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L26)

###### address

> **address**: `string`

###### provider

> **provider**: `string`

###### walletType

> **walletType**: `string`

##### embeddedEoa

> **embeddedEoa**: \{ `address`: `string`; `chainType`: `string`; `clientType`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L25)

##### operationalSolanaWallet

> **operationalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L24)

##### primaryWalletAddress

> **primaryWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L27)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/walletSync.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L20)

## Functions

### readPersistedIdentity()

> **readPersistedIdentity**(`db`, `profileId`): `Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

Defined in: [server/\_lib/wallet/walletSync.ts:262](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L262)

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

Defined in: [server/\_lib/wallet/walletSync.ts:888](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/walletSync.ts#L888)

#### Parameters

##### db

`Db`

##### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

#### Returns

`Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>
