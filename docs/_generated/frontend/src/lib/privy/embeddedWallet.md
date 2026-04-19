[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/embeddedWallet

# src/lib/privy/embeddedWallet

## Functions

### extractPrivyWalletsFromUser()

> **extractPrivyWalletsFromUser**(`user`): `Record`\<`string`, `unknown`\>[]

Defined in: [src/lib/privy/embeddedWallet.ts:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L62)

#### Parameters

##### user

`unknown`

#### Returns

`Record`\<`string`, `unknown`\>[]

***

### pickPrivyEmbeddedEoaAddressFromUser()

> **pickPrivyEmbeddedEoaAddressFromUser**(`user`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/privy/embeddedWallet.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L122)

#### Parameters

##### user

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### pickPrivyEmbeddedEoaAddressFromWallets()

> **pickPrivyEmbeddedEoaAddressFromWallets**(`wallets`): `` `0x${string}` `` \| `null`

Defined in: [src/lib/privy/embeddedWallet.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L112)

#### Parameters

##### wallets

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### useEnsurePrivyEmbeddedWallet()

> **useEnsurePrivyEmbeddedWallet**(): `object`

Defined in: [src/lib/privy/embeddedWallet.ts:157](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/embeddedWallet.ts#L157)

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
