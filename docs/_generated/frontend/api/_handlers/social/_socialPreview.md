[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/social/\_socialPreview

# api/\_handlers/social/\_socialPreview

## Type Aliases

### PreviewKind

> **PreviewKind** = `"creator"` \| `"content"` \| `"vault"` \| `"trends"`

Defined in: [api/\_handlers/social/\_socialPreview.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L13)

***

### PreviewPayload

> **PreviewPayload** = `object`

Defined in: [api/\_handlers/social/\_socialPreview.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L17)

#### Properties

##### description

> **description**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L19)

##### imageUrl

> **imageUrl**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L20)

##### pageUrl

> **pageUrl**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L21)

##### title

> **title**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L18)

***

### SocialPreviewInput

> **SocialPreviewInput** = `object`

Defined in: [api/\_handlers/social/\_socialPreview.ts:793](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L793)

#### Properties

##### address

> **address**: `Address` \| `null`

Defined in: [api/\_handlers/social/\_socialPreview.ts:798](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L798)

##### chain

> **chain**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:796](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L796)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/social/\_socialPreview.ts:797](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L797)

##### kind

> **kind**: [`PreviewKind`](#previewkind)

Defined in: [api/\_handlers/social/\_socialPreview.ts:795](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L795)

##### origin

> **origin**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:794](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L794)

##### sort

> **sort**: [`TrendsSort`](#trendssort)

Defined in: [api/\_handlers/social/\_socialPreview.ts:799](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L799)

##### time

> **time**: [`TrendsTime`](#trendstime)

Defined in: [api/\_handlers/social/\_socialPreview.ts:800](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L800)

***

### SocialRewriteId

> **SocialRewriteId** = `"explore-creators-list"` \| `"explore-creator-detail"` \| `"explore-content-list"` \| `"explore-content-detail"` \| `"explore-vaults-list"` \| `"vault-detail"` \| `"explore-trends-list"`

Defined in: [api/\_handlers/social/\_socialPreview.ts:192](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L192)

***

### SocialRewriteMatch

> **SocialRewriteMatch** = `object`

Defined in: [api/\_handlers/social/\_socialPreview.ts:201](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L201)

#### Properties

##### destPath

> **destPath**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:204](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L204)

##### id

> **id**: [`SocialRewriteId`](#socialrewriteid)

Defined in: [api/\_handlers/social/\_socialPreview.ts:202](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L202)

##### query

> **query**: `object`

Defined in: [api/\_handlers/social/\_socialPreview.ts:205](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L205)

###### address?

> `optional` **address**: `string`

###### chain?

> `optional` **chain**: `string`

###### kind

> **kind**: [`PreviewKind`](#previewkind)

###### sort?

> `optional` **sort**: [`TrendsSort`](#trendssort)

###### time?

> `optional` **time**: [`TrendsTime`](#trendstime)

##### sourcePattern

> **sourcePattern**: `string`

Defined in: [api/\_handlers/social/\_socialPreview.ts:203](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L203)

***

### TrendsSort

> **TrendsSort** = `"volume"` \| `"marketCap"` \| `"priceChange"` \| `"new"`

Defined in: [api/\_handlers/social/\_socialPreview.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L14)

***

### TrendsTime

> **TrendsTime** = `"1d"` \| `"1w"` \| `"1y"`

Defined in: [api/\_handlers/social/\_socialPreview.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L15)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`void`\>

Defined in: [api/\_handlers/social/\_socialPreview.ts:875](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L875)

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

Defined in: [api/\_handlers/social/\_socialPreview.ts:231](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L231)

#### Parameters

##### req

`VercelRequest`

#### Returns

`string`

***

### isSocialBotUserAgent()

> **isSocialBotUserAgent**(`userAgent`): `boolean`

Defined in: [api/\_handlers/social/\_socialPreview.ts:252](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L252)

#### Parameters

##### userAgent

`string`

#### Returns

`boolean`

***

### matchSocialPreviewRewrite()

> **matchSocialPreviewRewrite**(`pathOrUrl`, `userAgent`): [`SocialRewriteMatch`](#socialrewritematch) \| `null`

Defined in: [api/\_handlers/social/\_socialPreview.ts:256](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L256)

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

Defined in: [api/\_handlers/social/\_socialPreview.ts:803](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L803)

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

> **resolveSocialPreviewPayload**(`input`): `Promise`\<[`PreviewPayload`](#previewpayload)\>

Defined in: [api/\_handlers/social/\_socialPreview.ts:823](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L823)

#### Parameters

##### input

[`SocialPreviewInput`](#socialpreviewinput)

#### Returns

`Promise`\<[`PreviewPayload`](#previewpayload)\>

***

### resolveSocialPreviewPayloadSafe()

> **resolveSocialPreviewPayloadSafe**(`input`): `Promise`\<[`PreviewPayload`](#previewpayload)\>

Defined in: [api/\_handlers/social/\_socialPreview.ts:854](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/social/_socialPreview.ts#L854)

#### Parameters

##### input

[`SocialPreviewInput`](#socialpreviewinput)

#### Returns

`Promise`\<[`PreviewPayload`](#previewpayload)\>
