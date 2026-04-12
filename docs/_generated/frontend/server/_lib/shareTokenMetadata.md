[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/shareTokenMetadata

# server/\_lib/shareTokenMetadata

## Functions

### buildShareTokenMetadata()

> **buildShareTokenMetadata**(`__namedParameters`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [server/\_lib/shareTokenMetadata.ts:99](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/shareTokenMetadata.ts#L99)

#### Parameters

##### \_\_namedParameters

`ShareTokenMetadataParams`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### resolveShareTokenMetadataUrls()

> **resolveShareTokenMetadataUrls**(`params`): `object`

Defined in: [server/\_lib/shareTokenMetadata.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/shareTokenMetadata.ts#L61)

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
