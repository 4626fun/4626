[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/embeddedWallet

# src/lib/privy/embeddedWallet

## Functions

### pickPrivyEmbeddedEoaAddressFromUser()

> **pickPrivyEmbeddedEoaAddressFromUser**(`user`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/privy/embeddedWallet.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L42)

#### Parameters

##### user

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### pickPrivyEmbeddedEoaAddressFromWallets()

> **pickPrivyEmbeddedEoaAddressFromWallets**(`wallets`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/privy/embeddedWallet.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L32)

#### Parameters

##### wallets

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### useEnsurePrivyEmbeddedWallet()

> **useEnsurePrivyEmbeddedWallet**(): `object`

Defined in: [src/lib/privy/embeddedWallet.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L118)

#### Returns

`object`

##### embeddedEoaAddress

> **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

##### ensureEmbeddedWallet()

> **ensureEmbeddedWallet**: () => `Promise`\<\{ `address`: `` `0x${string}` ``; `created`: `boolean`; \}\>

###### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; `created`: `boolean`; \}\>

##### isCreatingEmbeddedWallet

> **isCreatingEmbeddedWallet**: `boolean`
