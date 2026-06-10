[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/walletSync

# server/\_lib/wallet/walletSync

## Type Aliases

### Db

> **Db** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L15)

#### Properties

##### sql()

> **sql**: (`strings`, ...`values`) => `Promise`\<\{ `rowCount?`: `number`; `rows`: `any`[]; \}\>

Defined in: [server/\_lib/wallet/walletSync.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L16)

###### Parameters

###### strings

`TemplateStringsArray`

###### values

...`any`[]

###### Returns

`Promise`\<\{ `rowCount?`: `number`; `rows`: `any`[]; \}\>

***

### PersistedIdentity

> **PersistedIdentity** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:254](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L254)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:256](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L256)

##### canonicalSmartWallet

> **canonicalSmartWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:257](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L257)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:258](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L258)

##### embeddedEoa

> **embeddedEoa**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:260](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L260)

##### operationalSolanaWallet

> **operationalSolanaWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:259](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L259)

##### preprovZoraHandle

> **preprovZoraHandle**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:261](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L261)

##### primaryWallet

> **primaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:255](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L255)

***

### SyncUserWalletsResult

> **SyncUserWalletsResult** = `object`

Defined in: [server/\_lib/wallet/walletSync.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L21)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: \{ `address`: `string`; `provider`: `string`; `walletType`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L24)

##### canonicalSmartWallet

> **canonicalSmartWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L23)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L25)

##### connectedWallets

> **connectedWallets**: `object`[]

Defined in: [server/\_lib/wallet/walletSync.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L28)

###### address

> **address**: `string`

###### provider

> **provider**: `string`

###### walletType

> **walletType**: `string`

##### embeddedEoa

> **embeddedEoa**: \{ `address`: `string`; `chainType`: `string`; `clientType`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L27)

##### operationalSolanaWallet

> **operationalSolanaWallet**: \{ `address`: `string`; `provider`: `string`; \} \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L26)

##### primaryWalletAddress

> **primaryWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/wallet/walletSync.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L29)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/walletSync.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L22)

## Functions

### readPersistedIdentity()

> **readPersistedIdentity**(`db`, `profileId`): `Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

Defined in: [server/\_lib/wallet/walletSync.ts:264](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L264)

#### Parameters

##### db

[`Db`](#db)

##### profileId

`number`

#### Returns

`Promise`\<[`PersistedIdentity`](#persistedidentity) \| `null`\>

***

### syncUserWallets()

> **syncUserWallets**(`db`, `privyUser`): `Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>

Defined in: [server/\_lib/wallet/walletSync.ts:890](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/walletSync.ts#L890)

#### Parameters

##### db

[`Db`](#db)

##### privyUser

[`PrivyUserLike`](walletMapping.md#privyuserlike)

#### Returns

`Promise`\<[`SyncUserWalletsResult`](#syncuserwalletsresult)\>
