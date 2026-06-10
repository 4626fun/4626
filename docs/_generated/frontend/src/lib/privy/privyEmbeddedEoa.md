[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/privy/privyEmbeddedEoa

# src/lib/privy/privyEmbeddedEoa

## Functions

### collectPrivySmartWalletAddressesFromWallets()

> **collectPrivySmartWalletAddressesFromWallets**(`wallets`): `string`[]

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:91](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/privyEmbeddedEoa.ts#L91)

#### Parameters

##### wallets

readonly `WalletLike`[] | `null` | `undefined`

#### Returns

`string`[]

***

### getWalletClientType()

> **getWalletClientType**(`wallet`): `string`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/privyEmbeddedEoa.ts#L15)

#### Parameters

##### wallet

`WalletLike` | `null` | `undefined`

#### Returns

`string`

***

### isEmbeddedPrivyEoaCandidate()

> **isEmbeddedPrivyEoaCandidate**(`wallet`, `excludedWalletAddress?`): `boolean`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/privyEmbeddedEoa.ts#L34)

#### Parameters

##### wallet

`WalletLike` | `null` | `undefined`

##### excludedWalletAddress?

`string` | `null`

#### Returns

`boolean`

***

### isPrivyServerManagedWallet()

> **isPrivyServerManagedWallet**(`wallet`): `boolean`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/privyEmbeddedEoa.ts#L81)

#### Parameters

##### wallet

`WalletLike` | `null` | `undefined`

#### Returns

`boolean`

***

### isSmartWalletLikeType()

> **isSmartWalletLikeType**(`walletType`): `boolean`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/privyEmbeddedEoa.ts#L29)

#### Parameters

##### walletType

`string`

#### Returns

`boolean`

***

### pickPrivyEmbeddedEoaWallet()

> **pickPrivyEmbeddedEoaWallet**\<`T`\>(`wallets`, `excludedWalletAddress?`): `T` \| `null`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:108](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/privyEmbeddedEoa.ts#L108)

#### Type Parameters

##### T

`T` *extends* `WalletLike`

#### Parameters

##### wallets

readonly `T`[] | `null` | `undefined`

##### excludedWalletAddress?

`string` | `null`

#### Returns

`T` \| `null`
