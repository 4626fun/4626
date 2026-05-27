[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/infra/shareTokenMetadata

# server/\_lib/infra/shareTokenMetadata

## Functions

### buildShareTokenMetadata()

> **buildShareTokenMetadata**(`__namedParameters`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [server/\_lib/infra/shareTokenMetadata.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/shareTokenMetadata.ts#L99)

#### Parameters

##### \_\_namedParameters

`ShareTokenMetadataParams`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### resolveShareTokenMetadataUrls()

> **resolveShareTokenMetadataUrls**(`params`): `object`

Defined in: [server/\_lib/infra/shareTokenMetadata.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/shareTokenMetadata.ts#L61)

#### Parameters

##### params

###### address

`string`

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
