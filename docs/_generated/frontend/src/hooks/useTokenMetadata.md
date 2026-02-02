[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/hooks/useTokenMetadata

# src/hooks/useTokenMetadata

## Functions

### useTokenImage()

> **useTokenImage**(`tokenAddress`): `object`

Defined in: [hooks/useTokenMetadata.ts:156](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/hooks/useTokenMetadata.ts#L156)

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

Defined in: [hooks/useTokenMetadata.ts:64](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/hooks/useTokenMetadata.ts#L64)

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
