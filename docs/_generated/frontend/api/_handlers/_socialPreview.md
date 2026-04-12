[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_socialPreview

# api/\_handlers/\_socialPreview

## Type Aliases

### SocialPreviewInput

> **SocialPreviewInput** = `object`

Defined in: [api/\_handlers/\_socialPreview.ts:793](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L793)

#### Properties

##### address

> **address**: `Address` \| `null`

Defined in: [api/\_handlers/\_socialPreview.ts:798](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L798)

##### chain

> **chain**: `string`

Defined in: [api/\_handlers/\_socialPreview.ts:796](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L796)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/\_socialPreview.ts:797](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L797)

##### kind

> **kind**: `PreviewKind`

Defined in: [api/\_handlers/\_socialPreview.ts:795](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L795)

##### origin

> **origin**: `string`

Defined in: [api/\_handlers/\_socialPreview.ts:794](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L794)

##### sort

> **sort**: `TrendsSort`

Defined in: [api/\_handlers/\_socialPreview.ts:799](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L799)

##### time

> **time**: `TrendsTime`

Defined in: [api/\_handlers/\_socialPreview.ts:800](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L800)

***

### SocialRewriteMatch

> **SocialRewriteMatch** = `object`

Defined in: [api/\_handlers/\_socialPreview.ts:201](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L201)

#### Properties

##### destPath

> **destPath**: `string`

Defined in: [api/\_handlers/\_socialPreview.ts:204](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L204)

##### id

> **id**: `SocialRewriteId`

Defined in: [api/\_handlers/\_socialPreview.ts:202](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L202)

##### query

> **query**: `object`

Defined in: [api/\_handlers/\_socialPreview.ts:205](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L205)

###### address?

> `optional` **address**: `string`

###### chain?

> `optional` **chain**: `string`

###### kind

> **kind**: `PreviewKind`

###### sort?

> `optional` **sort**: `TrendsSort`

###### time?

> `optional` **time**: `TrendsTime`

##### sourcePattern

> **sourcePattern**: `string`

Defined in: [api/\_handlers/\_socialPreview.ts:203](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L203)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`void`\>

Defined in: [api/\_handlers/\_socialPreview.ts:875](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L875)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`void`\>

***

### getRequestOrigin()

> **getRequestOrigin**(`req`): `string`

Defined in: [api/\_handlers/\_socialPreview.ts:231](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L231)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string`

***

### isSocialBotUserAgent()

> **isSocialBotUserAgent**(`userAgent`): `boolean`

Defined in: [api/\_handlers/\_socialPreview.ts:252](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L252)

#### Parameters

##### userAgent

`string`

#### Returns

`boolean`

***

### matchSocialPreviewRewrite()

> **matchSocialPreviewRewrite**(`pathOrUrl`, `userAgent`): [`SocialRewriteMatch`](#socialrewritematch) \| `null`

Defined in: [api/\_handlers/\_socialPreview.ts:256](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L256)

#### Parameters

##### pathOrUrl

`string`

##### userAgent

`string`

#### Returns

[`SocialRewriteMatch`](#socialrewritematch) \| `null`

***

### normalizeSocialPreviewInput()

> **normalizeSocialPreviewInput**(`params`): [`SocialPreviewInput`](#socialpreviewinput)

Defined in: [api/\_handlers/\_socialPreview.ts:803](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L803)

#### Parameters

##### params

###### address?

`string` \| `null`

###### chain?

`string` \| `null`

###### kind?

`string` \| `null`

###### origin

`string`

###### sort?

`string` \| `null`

###### time?

`string` \| `null`

#### Returns

[`SocialPreviewInput`](#socialpreviewinput)

***

### resolveSocialPreviewPayload()

> **resolveSocialPreviewPayload**(`input`): `Promise`\<`PreviewPayload`\>

Defined in: [api/\_handlers/\_socialPreview.ts:823](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L823)

#### Parameters

##### input

[`SocialPreviewInput`](#socialpreviewinput)

#### Returns

`Promise`\<`PreviewPayload`\>

***

### resolveSocialPreviewPayloadSafe()

> **resolveSocialPreviewPayloadSafe**(`input`): `Promise`\<`PreviewPayload`\>

Defined in: [api/\_handlers/\_socialPreview.ts:854](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/_socialPreview.ts#L854)

#### Parameters

##### input

[`SocialPreviewInput`](#socialpreviewinput)

#### Returns

`Promise`\<`PreviewPayload`\>
