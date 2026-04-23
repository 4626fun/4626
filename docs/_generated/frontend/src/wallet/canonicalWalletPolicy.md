[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/wallet/canonicalWalletPolicy

# src/wallet/canonicalWalletPolicy

## Type Aliases

### PolicyAddress

> **PolicyAddress** = `` `0x${string}` ``

Defined in: [src/wallet/canonicalWalletPolicy.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L3)

## Variables

### TARGET\_ALLOWED\_OWNER\_EOA\_ADDRESSES

> `const` **TARGET\_ALLOWED\_OWNER\_EOA\_ADDRESSES**: readonly \[`"0xb05cf01231cf2ff99499682e64d3780d57c80fdd"`, `"0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3"`, `"0xd1780fc23f810b52d8cf277e54842dd8803c9361"`, `"0xceca13f2686ed061c57620ecdf67e1b8c0f285e9"`\]

Defined in: [src/wallet/canonicalWalletPolicy.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L8)

***

### TARGET\_CANONICAL\_CSW\_ADDRESS

> `const` **TARGET\_CANONICAL\_CSW\_ADDRESS**: `"0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef"`

Defined in: [src/wallet/canonicalWalletPolicy.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L5)

## Functions

### hasContractBytecode()

> **hasContractBytecode**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:64](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L64)

#### Parameters

##### value

`unknown`

#### Returns

`boolean`

***

### isAllowedCanonicalSigner()

> **isAllowedCanonicalSigner**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L38)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isAllowedOwnerEoa()

> **isAllowedOwnerEoa**(`value`): `boolean`

Defined in: [src/wallet/canonicalWalletPolicy.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L32)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### isEoaAddressByCode()

> **isEoaAddressByCode**(`params`): `Promise`\<`boolean`\>

Defined in: [src/wallet/canonicalWalletPolicy.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L70)

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

Defined in: [src/wallet/canonicalWalletPolicy.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L28)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### normalizePolicyAddress()

> **normalizePolicyAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [src/wallet/canonicalWalletPolicy.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L23)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`` `0x${string}` `` \| `null`

***

### resolvePolicyCanonicalAddress()

> **resolvePolicyCanonicalAddress**(`params`): `` `0x${string}` `` \| `null`

Defined in: [src/wallet/canonicalWalletPolicy.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L54)

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

Defined in: [src/wallet/canonicalWalletPolicy.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/wallet/canonicalWalletPolicy.ts#L42)

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
