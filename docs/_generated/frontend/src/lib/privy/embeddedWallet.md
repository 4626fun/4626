[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/privy/embeddedWallet

# src/lib/privy/embeddedWallet

## Functions

### extractPrivyWalletsFromUser()

> **extractPrivyWalletsFromUser**(`user`): `Record`\<`string`, `unknown`\>[]

Defined in: [src/lib/privy/embeddedWallet.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/embeddedWallet.ts#L62)

#### Parameters

##### user

`unknown`

#### Returns

`Record`\<`string`, `unknown`\>[]

***

### pickPrivyEmbeddedEoaAddressFromUser()

> **pickPrivyEmbeddedEoaAddressFromUser**(`user`): `string` \| `null`

Defined in: [src/lib/privy/embeddedWallet.ts:282](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/embeddedWallet.ts#L282)

#### Parameters

##### user

`unknown`

#### Returns

`string` \| `null`

***

### pickPrivyEmbeddedEoaAddressFromWallets()

> **pickPrivyEmbeddedEoaAddressFromWallets**(`wallets`, `excludedWalletAddresses`): `string` \| `null`

Defined in: [src/lib/privy/embeddedWallet.ts:255](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/embeddedWallet.ts#L255)

#### Parameters

##### wallets

`unknown`

##### excludedWalletAddresses

readonly `string`[] = `[]`

#### Returns

`string` \| `null`

***

### useEnsurePrivyEmbeddedWallet()

> **useEnsurePrivyEmbeddedWallet**(): `object`

Defined in: [src/lib/privy/embeddedWallet.ts:350](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/embeddedWallet.ts#L350)

#### Returns

`object`

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null`

##### ensureEmbeddedWallet()

> **ensureEmbeddedWallet**: () => `Promise`\<\{ `address`: `string`; `created`: `boolean`; \}\>

###### Returns

`Promise`\<\{ `address`: `string`; `created`: `boolean`; \}\>

##### isCreatingEmbeddedWallet

> **isCreatingEmbeddedWallet**: `boolean`
