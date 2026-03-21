[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useTokenMetadata

# src/hooks/useTokenMetadata

## Functions

### selectMetadataSourceUri()

> **selectMetadataSourceUri**(`params`): `string` \| `null`

Defined in: [src/hooks/useTokenMetadata.ts:91](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useTokenMetadata.ts#L91)

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

Defined in: [src/hooks/useTokenMetadata.ts:243](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useTokenMetadata.ts#L243)

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

Defined in: [src/hooks/useTokenMetadata.ts:101](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useTokenMetadata.ts#L101)

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
