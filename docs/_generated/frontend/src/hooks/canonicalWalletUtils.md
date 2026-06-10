[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/canonicalWalletUtils

# src/hooks/canonicalWalletUtils

## Type Aliases

### WaitlistMeData

> **WaitlistMeData** = `object`

Defined in: [src/hooks/canonicalWalletUtils.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L3)

#### Properties

##### appAccessStatus?

> `optional` **appAccessStatus**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L4)

##### baseSubAccount?

> `optional` **baseSubAccount**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L8)

##### connectedAccounts?

> `optional` **connectedAccounts**: `object`[]

Defined in: [src/hooks/canonicalWalletUtils.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L9)

###### address?

> `optional` **address**: `string` \| `null`

###### isCanonicalSmartWallet?

> `optional` **isCanonicalSmartWallet**: `boolean`

###### isExecutionSubAccount?

> `optional` **isExecutionSubAccount**: `boolean`

###### provider?

> `optional` **provider**: `string` \| `null`

###### verifiedAt?

> `optional` **verifiedAt**: `string` \| `null`

###### walletType?

> `optional` **walletType**: `string` \| `null`

##### cswAddress?

> `optional` **cswAddress**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L6)

##### primaryEmbeddedEoa?

> `optional` **primaryEmbeddedEoa**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L5)

##### primarySmartWallet?

> `optional` **primarySmartWallet**: `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L7)

## Functions

### pickCanonicalSmartWalletAddress()

> **pickCanonicalSmartWalletAddress**(`row`): `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L23)

#### Parameters

##### row

[`WaitlistMeData`](#waitlistmedata) | `null` | `undefined`

#### Returns

`string` \| `null`

***

### pickExecutionSubAccountAddress()

> **pickExecutionSubAccountAddress**(`row`): `string` \| `null`

Defined in: [src/hooks/canonicalWalletUtils.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/canonicalWalletUtils.ts#L54)

#### Parameters

##### row

[`WaitlistMeData`](#waitlistmedata) | `null` | `undefined`

#### Returns

`string` \| `null`
