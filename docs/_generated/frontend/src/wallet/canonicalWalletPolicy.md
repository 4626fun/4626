[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/wallet/canonicalWalletPolicy

# src/wallet/canonicalWalletPolicy

## Type Aliases

### PolicyAddress

> **PolicyAddress** = `` `0x${string}` ``

Defined in: [src/wallet/canonicalWalletPolicy.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L3)

## Variables

### TARGET\_ALLOWED\_OWNER\_EOA\_ADDRESSES

> `const` **TARGET\_ALLOWED\_OWNER\_EOA\_ADDRESSES**: readonly \[`"0xb05cf01231cf2ff99499682e64d3780d57c80fdd"`, `"0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3"`, `"0xd1780fc23f810b52d8cf277e54842dd8803c9361"`\]

Defined in: [src/wallet/canonicalWalletPolicy.ts:8](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L8)

***

### TARGET\_CANONICAL\_CSW\_ADDRESS

> `const` **TARGET\_CANONICAL\_CSW\_ADDRESS**: `"0xab6d5c10b03300326cd7fab7267ae192842967b5"`

Defined in: [src/wallet/canonicalWalletPolicy.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L5)

## Functions

### hasContractBytecode()

> **hasContractBytecode**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:57](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L57)

#### Parameters

##### value

`unknown`

#### Returns

`boolean`

***

### isAllowedCanonicalSigner()

> **isAllowedCanonicalSigner**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L31)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isAllowedOwnerEoa()

> **isAllowedOwnerEoa**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:25](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L25)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isEoaAddressByCode()

> **isEoaAddressByCode**(`params`): `Promise`\<`boolean`\>

Defined in: [src/wallet/canonicalWalletPolicy.ts:63](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L63)

#### Parameters

##### params

###### address

`string` \| `null` \| `undefined`

###### getBytecode

(`address`) => `Promise`\<`` `0x${string}` `` \| `null` \| `undefined`\>

#### Returns

`Promise`\<`boolean`\>

***

### isTargetCanonicalCsw()

> **isTargetCanonicalCsw**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:21](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L21)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### normalizePolicyAddress()

> **normalizePolicyAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/wallet/canonicalWalletPolicy.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L16)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePolicyCanonicalAddress()

> **resolvePolicyCanonicalAddress**(`params`): `` `0x${string}` `` \| `null`

Defined in: [src/wallet/canonicalWalletPolicy.ts:47](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L47)

#### Parameters

##### params

###### canonicalAddress?

`string` \| `null`

###### signerAddress?

`string` \| `null`

#### Returns

`` `0x${string}` `` \| `null`

***

### shouldApplyCanonicalEnforcement()

> **shouldApplyCanonicalEnforcement**(`params`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:35](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/wallet/canonicalWalletPolicy.ts#L35)

#### Parameters

##### params

###### canonicalAddress?

`string` \| `null`

###### executionAddress?

`string` \| `null`

###### signerAddress?

`string` \| `null`

#### Returns

`boolean`
