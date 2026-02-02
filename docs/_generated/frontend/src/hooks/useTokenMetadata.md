[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useTokenMetadata

# src/hooks/useTokenMetadata

## Functions

### useTokenImage()

> **useTokenImage**(`tokenAddress`): `object`

Defined in: [hooks/useTokenMetadata.ts:156](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/hooks/useTokenMetadata.ts#L156)

#### Parameters

##### tokenAddress

`` `0x${string}` `` | `undefined`

#### Returns

`object`

##### error

> **error**: `string` \| `null`

##### imageUrl

> **imageUrl**: `string` \| `null`

##### isLoading

> **isLoading**: `boolean`

***

### useTokenMetadata()

> **useTokenMetadata**(`tokenAddress`): `object`

Defined in: [hooks/useTokenMetadata.ts:64](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/hooks/useTokenMetadata.ts#L64)

#### Parameters

##### tokenAddress

`` `0x${string}` `` | `undefined`

#### Returns

`object`

##### error

> **error**: `string` \| `null`

##### imageUrl

> **imageUrl**: `string` \| `null`

##### isLoading

> **isLoading**: `boolean`

##### metadata

> **metadata**: `TokenMetadata` \| `null`

##### refetch()

> **refetch**: (`options?`) => `Promise`\<`QueryObserverResult`\<`string`, `ReadContractErrorType`\>\>

###### Parameters

###### options?

`RefetchOptions`

###### Returns

`Promise`\<`QueryObserverResult`\<`string`, `ReadContractErrorType`\>\>

##### tokenURI

> **tokenURI**: `string` \| `undefined`
