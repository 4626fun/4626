[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/blob

# server/\_lib/infra/blob

## Type Aliases

### BlobHead

> **BlobHead** = `object`

Defined in: [server/\_lib/infra/blob.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L9)

#### Properties

##### contentType

> **contentType**: `string` \| `null`

Defined in: [server/\_lib/infra/blob.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L9)

##### size

> **size**: `number`

Defined in: [server/\_lib/infra/blob.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L9)

##### url

> **url**: `string`

Defined in: [server/\_lib/infra/blob.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L9)

## Functions

### blobHeadOrNull()

> **blobHeadOrNull**(`pathname`): `Promise`\<[`BlobHead`](#blobhead) \| `null`\>

Defined in: [server/\_lib/infra/blob.ts:163](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L163)

#### Parameters

##### pathname

`string`

#### Returns

`Promise`\<[`BlobHead`](#blobhead) \| `null`\>

***

### blobPutBytes()

> **blobPutBytes**(`params`): `Promise`\<\{ `url`: `string`; \}\>

Defined in: [server/\_lib/infra/blob.ts:243](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L243)

#### Parameters

##### params

###### bytes

`Uint8Array`

###### cacheControlMaxAgeSeconds?

`number`

###### contentType

`string`

###### pathname

`string`

#### Returns

`Promise`\<\{ `url`: `string`; \}\>

***

### fetchBytes()

> **fetchBytes**(`url`, `options`): `Promise`\<\{ `bytes`: `Uint8Array`; `contentType`: `string` \| `null`; \}\>

Defined in: [server/\_lib/infra/blob.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L176)

#### Parameters

##### url

`string`

##### options

`FetchBytesOptions` = `{}`

#### Returns

`Promise`\<\{ `bytes`: `Uint8Array`; `contentType`: `string` \| `null`; \}\>

***

### requireBlobToken()

> **requireBlobToken**(): `string`

Defined in: [server/\_lib/infra/blob.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L23)

#### Returns

`string`

***

### sha256Hex()

> **sha256Hex**(`input`): `string`

Defined in: [server/\_lib/infra/blob.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/blob.ts#L29)

#### Parameters

##### input

`string`

#### Returns

`string`
