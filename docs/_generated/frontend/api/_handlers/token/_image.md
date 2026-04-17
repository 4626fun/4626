[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_image

# api/\_handlers/token/\_image

## Variables

### \_\_testables

> `const` **\_\_testables**: `object`

Defined in: [api/\_handlers/token/\_image.ts:2712](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_image.ts#L2712)

#### Type Declaration

##### createTopBreakoutMask()

> **createTopBreakoutMask**: (`params`) => `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

###### Parameters

###### params

###### layout

`TokenIconLayout`

###### size

`number`

###### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

##### getTokenIconLayout()

> **getTokenIconLayout**: (`size`, `recipe`) => `TokenIconLayout`

###### Parameters

###### size

`number`

###### recipe

`TokenIconRecipe` = `...`

###### Returns

`TokenIconLayout`

##### isLikelyImagePayload()

> **isLikelyImagePayload**: (`bytes`, `contentType`) => `boolean`

###### Parameters

###### bytes

`Uint8Array`

###### contentType

`string` | `null`

###### Returns

`boolean`

##### isTrustedRawArtworkUrl()

> **isTrustedRawArtworkUrl**: (`upstreamUrl`) => `boolean`

###### Parameters

###### upstreamUrl

`string` | `null` | `undefined`

###### Returns

`boolean`

##### normalizeSourceArtworkUrl()

> **normalizeSourceArtworkUrl**: (`value`) => `string` \| `null`

###### Parameters

###### value

`string` | `null` | `undefined`

###### Returns

`string` \| `null`

##### renderDeterministicFrameLayer()

> **renderDeterministicFrameLayer**: (`params`) => `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

###### Parameters

###### params

###### layout

`TokenIconLayout`

###### size

`number`

###### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

##### renderDeterministicTokenIcon()

> **renderDeterministicTokenIcon**: (`params`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

###### Parameters

###### params

###### heroCutoutSourceBytes?

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

###### renderPreset?

`"hero"` \| `"standard"` \| `"pixel"`

###### signatureText?

`string`

###### size

`number`

###### sourceBytes

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

###### suppressBreakout?

`boolean`

###### symbol

`string`

###### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### resolveCreatorTokenArtwork()

> **resolveCreatorTokenArtwork**: (`coinData`) => [`CreatorTokenArtwork`](../../../server/_lib/image/creatorTokenArtwork.md#creatortokenartwork) \| `null`

###### Parameters

###### coinData

`unknown`

###### Returns

[`CreatorTokenArtwork`](../../../server/_lib/image/creatorTokenArtwork.md#creatortokenartwork) \| `null`

##### resolveHeroCutoutLoadPolicy()

> **resolveHeroCutoutLoadPolicy**: (`params`) => `HeroCutoutLoadPolicy`

###### Parameters

###### params

###### heroCutoutArtworkUrl?

`string` \| `null`

###### heroCutoutSourceBytes?

`Uint8Array`\<`ArrayBufferLike`\> \| `null`

###### Returns

`HeroCutoutLoadPolicy`

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/token/\_image.ts:271](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_image.ts#L271)

Token Image Generator API

Generates the canonical premium 4626 token icon by centering the real
creator coin artwork inside a single branded inner frame.

Query params:
  - address: ShareOFT token address (required)
  - chain: Chain ID (default: 8453 for Base)
  - size: Image size in pixels (default: 512, max: 1024)
  - format: png | svg (default: png)

Response: PNG by default (wallet-friendly), or SVG with `?format=svg`

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
