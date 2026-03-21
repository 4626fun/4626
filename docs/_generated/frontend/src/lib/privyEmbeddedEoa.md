[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/privyEmbeddedEoa

# src/lib/privyEmbeddedEoa

## Functions

### getWalletClientType()

> **getWalletClientType**(`wallet`): `string`

Defined in: [src/lib/privyEmbeddedEoa.ts:15](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privyEmbeddedEoa.ts#L15)

#### Parameters

##### wallet

`WalletLike` | `null` | `undefined`

#### Returns

`string`

***

### isEmbeddedPrivyEoaCandidate()

> **isEmbeddedPrivyEoaCandidate**(`wallet`, `excludedWalletAddress?`): `boolean`

Defined in: [src/lib/privyEmbeddedEoa.ts:34](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privyEmbeddedEoa.ts#L34)

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

Defined in: [src/lib/privyEmbeddedEoa.ts:29](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privyEmbeddedEoa.ts#L29)

#### Parameters

##### walletType

`string`

#### Returns

`boolean`

***

### pickPrivyEmbeddedEoaWallet()

> **pickPrivyEmbeddedEoaWallet**\<`T`\>(`wallets`, `excludedWalletAddress?`): `T` \| `null`

Defined in: [src/lib/privyEmbeddedEoa.ts:49](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privyEmbeddedEoa.ts#L49)

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
