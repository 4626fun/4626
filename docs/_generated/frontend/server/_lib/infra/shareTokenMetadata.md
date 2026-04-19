[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/shareTokenMetadata

# server/\_lib/infra/shareTokenMetadata

## Functions

### buildShareTokenMetadata()

> **buildShareTokenMetadata**(`__namedParameters`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [server/\_lib/infra/shareTokenMetadata.ts:99](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/infra/shareTokenMetadata.ts#L99)

#### Parameters

##### \_\_namedParameters

`ShareTokenMetadataParams`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### resolveShareTokenMetadataUrls()

> **resolveShareTokenMetadataUrls**(`params`): `object`

Defined in: [server/\_lib/infra/shareTokenMetadata.ts:61](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/infra/shareTokenMetadata.ts#L61)

#### Parameters

##### params

###### address

`` `0x${string}` ``

###### apiHost?

`string`

###### appHost?

`string`

###### chainId

`number`

#### Returns

`object`

##### apiBaseUrl

> **apiBaseUrl**: `string`

##### appBaseUrl

> **appBaseUrl**: `string`

##### imagePngUrl

> **imagePngUrl**: `string`

##### imageSvgUrl

> **imageSvgUrl**: `string`

##### lensMetadataPreviewUrl

> **lensMetadataPreviewUrl**: `string`

##### lensMetadataStoreUrl

> **lensMetadataStoreUrl**: `string`

##### metadataUrl

> **metadataUrl**: `string`
