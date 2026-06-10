[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/wallet/canonicalWalletPolicy

# src/wallet/canonicalWalletPolicy

## Type Aliases

### PolicyAddress

> **PolicyAddress** = `` `0x${string}` ``

Defined in: [src/wallet/canonicalWalletPolicy.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L3)

## Variables

### TARGET\_ALLOWED\_OWNER\_EOA\_ADDRESSES

> `const` **TARGET\_ALLOWED\_OWNER\_EOA\_ADDRESSES**: readonly \[`"0xb05cf01231cf2ff99499682e64d3780d57c80fdd"`, `"0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3"`, `"0xd1780fc23f810b52d8cf277e54842dd8803c9361"`, `"0xceca13f2686ed061c57620ecdf67e1b8c0f285e9"`, `"0x858c01556ec5a8531fa4118d595430ac7fd0baf0"`\]

Defined in: [src/wallet/canonicalWalletPolicy.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L17)

***

### TARGET\_CANONICAL\_CSW\_ADDRESS

> `const` **TARGET\_CANONICAL\_CSW\_ADDRESS**: `"0xab6d5c10b03300326cd7fab7267ae192842967b5"`

Defined in: [src/wallet/canonicalWalletPolicy.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L14)

## Functions

### hasContractBytecode()

> **hasContractBytecode**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L83)

#### Parameters

##### value

`unknown`

#### Returns

`boolean`

***

### isAllowedCanonicalSigner()

> **isAllowedCanonicalSigner**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L50)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isAllowedOwnerEoa()

> **isAllowedOwnerEoa**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L44)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isEoaAddressByCode()

> **isEoaAddressByCode**(`params`): `Promise`\<`boolean`\>

Defined in: [src/wallet/canonicalWalletPolicy.ts:89](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L89)

#### Parameters

##### params

###### address

`string` \| `null` \| `undefined`

###### getBytecode

(`address`) => `Promise`\<`` `0x${string}` `` \| `null` \| `undefined`\>

#### Returns

`Promise`\<`boolean`\>

***

### isCanonicalCsw()

> **isCanonicalCsw**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L40)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### normalizePolicyAddress()

> **normalizePolicyAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/wallet/canonicalWalletPolicy.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L35)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePolicyCanonicalAddress()

> **resolvePolicyCanonicalAddress**(`params`): `` `0x${string}` `` \| `null`

Defined in: [src/wallet/canonicalWalletPolicy.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L66)

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

Defined in: [src/wallet/canonicalWalletPolicy.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L54)

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
