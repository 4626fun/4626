[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/lens/grove

# src/lib/lens/grove

## Type Aliases

### GroveUploadResult

> **GroveUploadResult** = `object`

Defined in: [src/lib/lens/grove.ts:28](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L28)

#### Properties

##### gatewayUrl

> **gatewayUrl**: `string`

Defined in: [src/lib/lens/grove.ts:30](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L30)

##### lensUri

> **lensUri**: `string`

Defined in: [src/lib/lens/grove.ts:31](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L31)

##### statusUrl

> **statusUrl**: `string` \| `null`

Defined in: [src/lib/lens/grove.ts:32](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L32)

##### storageKey

> **storageKey**: `string`

Defined in: [src/lib/lens/grove.ts:29](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L29)

## Variables

### BASE\_CHAIN\_ID

> `const` **BASE\_CHAIN\_ID**: `8453` = `8453`

Defined in: [src/lib/lens/grove.ts:9](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L9)

***

### LENS\_MAINNET\_CHAIN\_ID

> `const` **LENS\_MAINNET\_CHAIN\_ID**: `232` = `232`

Defined in: [src/lib/lens/grove.ts:8](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L8)

## Functions

### fetchLensJson()

> **fetchLensJson**\<`T`\>(`uri`, `init?`): `Promise`\<`T`\>

Defined in: [src/lib/lens/grove.ts:103](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L103)

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### uri

`string`

##### init?

`RequestInit`

#### Returns

`Promise`\<`T`\>

***

### fetchLensResource()

> **fetchLensResource**(`uri`, `init?`): `Promise`\<`Response`\>

Defined in: [src/lib/lens/grove.ts:90](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L90)

#### Parameters

##### uri

`string`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

***

### resolveLensUri()

> **resolveLensUri**(`uri`): `string`

Defined in: [src/lib/lens/grove.ts:78](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L78)

#### Parameters

##### uri

`string`

#### Returns

`string`

***

### uploadImmutableBlob()

> **uploadImmutableBlob**(`input`, `contentType`, `chainId`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [src/lib/lens/grove.ts:51](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L51)

Upload a Blob (binary file) immutably to Grove.

#### Parameters

##### input

`Blob`

##### contentType

`string`

##### chainId

`number` = `LENS_MAINNET_CHAIN_ID`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

***

### uploadImmutableJson()

> **uploadImmutableJson**(`data`, `chainId`): `Promise`\<[`GroveUploadResult`](#groveuploadresult)\>

Defined in: [src/lib/lens/grove.ts:65](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/lens/grove.ts#L65)

Upload JSON data immutably to Grove.

#### Parameters

##### data

`unknown`

##### chainId

`number` = `LENS_MAINNET_CHAIN_ID`

#### Returns

`Promise`\<[`GroveUploadResult`](#groveuploadresult)\>
