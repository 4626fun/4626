[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/canonicalWalletUtils

# src/hooks/canonicalWalletUtils

## Type Aliases

### WaitlistMeData

> **WaitlistMeData** = `object`

Defined in: [src/hooks/canonicalWalletUtils.ts:3](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/canonicalWalletUtils.ts#L3)

#### Properties

##### baseSubAccount?

> `optional` **baseSubAccount**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/canonicalWalletUtils.ts#L6)

##### connectedAccounts?

> `optional` **connectedAccounts**: `object`[]

Defined in: [src/hooks/canonicalWalletUtils.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/canonicalWalletUtils.ts#L7)

###### address?

> `optional` **address**: `string` \| `null`

###### isCanonicalSmartWallet?

> `optional` **isCanonicalSmartWallet**: `boolean`

###### provider?

> `optional` **provider**: `string` \| `null`

###### verifiedAt?

> `optional` **verifiedAt**: `string` \| `null`

###### walletType?

> `optional` **walletType**: `string` \| `null`

##### cswAddress?

> `optional` **cswAddress**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/canonicalWalletUtils.ts#L4)

##### primarySmartWallet?

> `optional` **primarySmartWallet**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/canonicalWalletUtils.ts#L5)

## Functions

### pickCanonicalSmartWalletAddress()

> **pickCanonicalSmartWalletAddress**(`row`): `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/canonicalWalletUtils.ts#L20)

#### Parameters

##### row

[`WaitlistMeData`](#waitlistmedata) | `null` | `undefined`

#### Returns

`string` \| `null`
