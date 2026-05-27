[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/disconnectExternalWallet

# server/\_lib/wallet/disconnectExternalWallet

## Type Aliases

### DisconnectExternalWalletResult

> **DisconnectExternalWalletResult** = `object`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L5)

#### Properties

##### clearedPrimaryWallet

> **clearedPrimaryWallet**: `boolean`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L7)

##### clearedProfileWalletRows

> **clearedProfileWalletRows**: `number`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L8)

##### nextPrimaryWallet

> **nextPrimaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L9)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L6)

## Functions

### disconnectExternalWalletFromProfile()

> **disconnectExternalWalletFromProfile**(`params`): `Promise`\<[`DisconnectExternalWalletResult`](#disconnectexternalwalletresult)\>

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L39)

#### Parameters

##### params

###### db

`Db`

###### externalAddress

`string`

###### profileId

`number`

#### Returns

`Promise`\<[`DisconnectExternalWalletResult`](#disconnectexternalwalletresult)\>

***

### resolveProfilesPrimaryWalletColumn()

> **resolveProfilesPrimaryWalletColumn**(`input`): `string` \| `null`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L25)

#### Parameters

##### input

###### activeOwner

`string` \| `null`

###### canonical

`string` \| `null`

###### classificationPrimary

`string` \| `null`

###### embedded

`string` \| `null`

#### Returns

`string` \| `null`
