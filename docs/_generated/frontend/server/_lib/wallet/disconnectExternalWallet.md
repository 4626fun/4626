[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/disconnectExternalWallet

# server/\_lib/wallet/disconnectExternalWallet

## Type Aliases

### DisconnectExternalWalletResult

> **DisconnectExternalWalletResult** = `object`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L3)

#### Properties

##### clearedPrimaryWallet

> **clearedPrimaryWallet**: `boolean`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L5)

##### clearedProfileWalletRows

> **clearedProfileWalletRows**: `number`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L6)

##### nextPrimaryWallet

> **nextPrimaryWallet**: `string` \| `null`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L7)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L4)

## Functions

### disconnectExternalWalletFromProfile()

> **disconnectExternalWalletFromProfile**(`params`): `Promise`\<[`DisconnectExternalWalletResult`](#disconnectexternalwalletresult)\>

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L37)

#### Parameters

##### params

###### db

[`Db`](walletSync.md#db)

###### externalAddress

`string`

###### profileId

`number`

#### Returns

`Promise`\<[`DisconnectExternalWalletResult`](#disconnectexternalwalletresult)\>

***

### resolveProfilesPrimaryWalletColumn()

> **resolveProfilesPrimaryWalletColumn**(`input`): `string` \| `null`

Defined in: [server/\_lib/wallet/disconnectExternalWallet.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/disconnectExternalWallet.ts#L23)

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
