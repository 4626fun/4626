[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useTokenMetadata

# src/hooks/useTokenMetadata

## Functions

### selectMetadataSourceUri()

> **selectMetadataSourceUri**(`params`): `string` \| `null`

Defined in: [src/hooks/useTokenMetadata.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useTokenMetadata.ts#L125)

#### Parameters

##### params

###### contractURI?

`unknown`

###### tokenURI?

`unknown`

#### Returns

`string` \| `null`

***

### useTokenImage()

> **useTokenImage**(`tokenAddress`): `object`

Defined in: [src/hooks/useTokenMetadata.ts:277](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useTokenMetadata.ts#L277)

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

Defined in: [src/hooks/useTokenMetadata.ts:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/hooks/useTokenMetadata.ts#L135)

#### Parameters

##### tokenAddress

`` `0x${string}` `` | `undefined`

#### Returns

`object`

##### contractURI

> **contractURI**: `string` \| `undefined`

##### error

> **error**: `string` \| `null`

##### imageUrl

> **imageUrl**: `string` \| `null`

##### isLoading

> **isLoading**: `boolean`

##### metadata

> **metadata**: `TokenMetadata` \| `null`

##### refetch()

> **refetch**: () => `Promise`\<`void`\> = `refetchMetadata`

###### Returns

`Promise`\<`void`\>

##### tokenURI

> **tokenURI**: `string` \| `undefined`
