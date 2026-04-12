[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/walletMapping

# server/\_lib/walletMapping

## Type Aliases

### ClassifiedLinkedAccounts

> **ClassifiedLinkedAccounts** = `object`

Defined in: [server/\_lib/walletMapping.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L18)

#### Properties

##### activeOwnerWallet

> **activeOwnerWallet**: \{ `address`: `string`; `provider`: [`WalletProvider`](#walletprovider); `walletType`: [`WalletType`](#wallettype-1); \} \| `null`

Defined in: [server/\_lib/walletMapping.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L20)

##### allWallets

> **allWallets**: [`MappedWallet`](#mappedwallet)[]

Defined in: [server/\_lib/walletMapping.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L24)

##### canonicalSmartWallet

> **canonicalSmartWallet**: \{ `address`: `string`; `provider`: [`WalletProvider`](#walletprovider); \} \| `null`

Defined in: [server/\_lib/walletMapping.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L21)

##### canonicalSolanaWallet

> **canonicalSolanaWallet**: \{ `address`: `string`; `provider`: [`WalletProvider`](#walletprovider); \} \| `null`

Defined in: [server/\_lib/walletMapping.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L22)

##### embeddedEoa

> **embeddedEoa**: \{ `address`: `string`; `chainType`: `string`; `clientType`: `string` \| `null`; \} \| `null`

Defined in: [server/\_lib/walletMapping.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L19)

##### operationalSolanaWallet

> **operationalSolanaWallet**: \{ `address`: `string`; `provider`: [`WalletProvider`](#walletprovider); \} \| `null`

Defined in: [server/\_lib/walletMapping.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L23)

##### primaryWalletAddress

> **primaryWalletAddress**: `string` \| `null`

Defined in: [server/\_lib/walletMapping.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L25)

***

### MappedWallet

> **MappedWallet** = `object`

Defined in: [server/\_lib/walletMapping.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L10)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/walletMapping.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L11)

##### chain

> **chain**: `string`

Defined in: [server/\_lib/walletMapping.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L14)

##### clientType

> **clientType**: `string` \| `null`

Defined in: [server/\_lib/walletMapping.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L15)

##### provider

> **provider**: [`WalletProvider`](#walletprovider)

Defined in: [server/\_lib/walletMapping.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L13)

##### walletType

> **walletType**: [`WalletType`](#wallettype-1)

Defined in: [server/\_lib/walletMapping.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L12)

***

### PrivyUserLike

> **PrivyUserLike** = `object`

Defined in: [server/\_lib/walletMapping.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L28)

#### Properties

##### id?

> `optional` **id**: `string`

Defined in: [server/\_lib/walletMapping.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L29)

##### linked\_accounts?

> `optional` **linked\_accounts**: `unknown`

Defined in: [server/\_lib/walletMapping.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L33)

##### linkedAccounts?

> `optional` **linkedAccounts**: `unknown`

Defined in: [server/\_lib/walletMapping.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L32)

##### wallet?

> `optional` **wallet**: `unknown`

Defined in: [server/\_lib/walletMapping.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L30)

##### wallets?

> `optional` **wallets**: `unknown`

Defined in: [server/\_lib/walletMapping.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L31)

***

### WalletProvider

> **WalletProvider** = `"privy"` \| `"coinbase_wallet"` \| `"metamask"` \| `"rabby"` \| `"walletconnect"` \| `"unknown"`

Defined in: [server/\_lib/walletMapping.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L2)

***

### WalletType

> **WalletType** = `"embedded_eoa"` \| `"external_eoa"` \| `"smart_wallet"`

Defined in: [server/\_lib/walletMapping.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L1)

## Functions

### classifyLinkedAccounts()

> **classifyLinkedAccounts**(`user`): [`ClassifiedLinkedAccounts`](#classifiedlinkedaccounts)

Defined in: [server/\_lib/walletMapping.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/walletMapping.ts#L143)

#### Parameters

##### user

[`PrivyUserLike`](#privyuserlike)

#### Returns

[`ClassifiedLinkedAccounts`](#classifiedlinkedaccounts)
