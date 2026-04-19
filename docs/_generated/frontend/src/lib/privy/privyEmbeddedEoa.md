[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/privyEmbeddedEoa

# src/lib/privy/privyEmbeddedEoa

## Functions

### getWalletClientType()

> **getWalletClientType**(`wallet`): `string`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/privy/privyEmbeddedEoa.ts#L15)

#### Parameters

##### wallet

`WalletLike` | `null` | `undefined`

#### Returns

`string`

***

### isEmbeddedPrivyEoaCandidate()

> **isEmbeddedPrivyEoaCandidate**(`wallet`, `excludedWalletAddress?`): `boolean`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:34](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/privy/privyEmbeddedEoa.ts#L34)

#### Parameters

##### wallet

`WalletLike` | `null` | `undefined`

##### excludedWalletAddress?

`string` | `null`

#### Returns

`boolean`

***

### isSmartWalletLikeType()

> **isSmartWalletLikeType**(`walletType`): `boolean`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/privy/privyEmbeddedEoa.ts#L29)

#### Parameters

##### walletType

`string`

#### Returns

`boolean`

***

### pickPrivyEmbeddedEoaWallet()

> **pickPrivyEmbeddedEoaWallet**\<`T`\>(`wallets`, `excludedWalletAddress?`): `T` \| `null`

Defined in: [src/lib/privy/privyEmbeddedEoa.ts:49](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/privy/privyEmbeddedEoa.ts#L49)

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
