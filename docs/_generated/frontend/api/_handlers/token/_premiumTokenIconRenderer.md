[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_premiumTokenIconRenderer

# api/\_handlers/token/\_premiumTokenIconRenderer

## Type Aliases

### PremiumTokenIconParams

> **PremiumTokenIconParams** = `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L14)

#### Properties

##### heroCutoutSourceImage?

> `optional` **heroCutoutSourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L17)

##### renderPreset?

> `optional` **renderPreset**: `RenderPreset`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L21)

##### signatureText?

> `optional` **signatureText**: `string`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L20)

##### size

> **size**: `number`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L15)

##### sourceImage?

> `optional` **sourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L16)

##### suppressBreakout?

> `optional` **suppressBreakout**: `boolean`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L18)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L19)

## Variables

### \_\_testables

> `const` **\_\_testables**: `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:4470](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L4470)

#### Type Declaration

##### computeAlignedTopBiasPx()

> **computeAlignedTopBiasPx**: (`params`) => `Promise`\<`SegmentationAlignmentResult`\>

###### Parameters

###### params

###### baseTopBiasPx

`number`

###### fit

`ArtworkFitMode`

###### layout

`PremiumLayout`

###### maskRgbaPng

`Buffer`

###### scale

`number`

###### sourceClass

`SourceClass`

###### Returns

`Promise`\<`SegmentationAlignmentResult`\>

##### decideBreakoutPlan()

> **decideBreakoutPlan**: (`params`) => `BreakoutPlan`

###### Parameters

###### params

###### analysis

`SourceAnalysis`

###### breakoutSourceKind

`BreakoutSourceKind`

###### rembgAvailable

`boolean`

###### suppressBreakout?

`boolean`

###### Returns

`BreakoutPlan`

##### getTokenIconLayout()

> **getTokenIconLayout**: (`size`, `preset`) => `PremiumLayout`

###### Parameters

###### size

`number`

###### preset

`RenderPreset` = `'standard'`

###### Returns

`PremiumLayout`

##### isSegmentationBreakoutCoverageAcceptable()

> **isSegmentationBreakoutCoverageAcceptable**: (`coverage`, `sourceClass?`) => `boolean`

###### Parameters

###### coverage

`number`

###### sourceClass?

`SourceClass`

###### Returns

`boolean`

##### measureBreakoutMaskCoverage()

> **measureBreakoutMaskCoverage**: (`params`) => `Promise`\<`number`\>

###### Parameters

###### params

###### layout

`PremiumLayout`

###### maskKind?

`"heroCutout"` \| `"sourceAlpha"` \| `"rembgCutout"`

###### maskRgbaPng

`Buffer`

###### scale

`number`

###### sourceClass

`SourceClass`

###### topBiasPx

`number`

###### Returns

`Promise`\<`number`\>

##### resolveBreakoutSourceKind()

> **resolveBreakoutSourceKind**: (`params`) => `BreakoutSourceKind`

###### Parameters

###### params

###### preparedHeroCutoutAvailable

`boolean`

###### preparedHeroCutoutBreakoutAllowed

`boolean`

###### sourceAlphaBreakoutAllowed

`boolean`

###### Returns

`BreakoutSourceKind`

##### resolveSourceAlphaBreakoutAllowed()

> **resolveSourceAlphaBreakoutAllowed**: (`params`) => `boolean`

###### Parameters

###### params

###### allowBreakout

`boolean`

###### suppressBreakout?

`boolean`

###### Returns

`boolean`

## Functions

### renderArtworkLayer()

> **renderArtworkLayer**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2336](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2336)

#### Parameters

##### params

###### fit?

`ArtworkFitMode`

###### layout

`PremiumLayout`

###### scale?

`number`

###### size

`number`

###### sourceClass?

`SourceClass`

###### sourceImage?

`Uint8Array`\<`ArrayBufferLike`\>

###### symbol?

`string`

###### tone?

`"default"` \| `"bright"`

###### topBiasPx?

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderBackgroundCard()

> **renderBackgroundCard**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1209](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1209)

#### Parameters

##### params

###### layout

`PremiumLayout`

###### size

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderBreakoutLayer()

> **renderBreakoutLayer**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:3419](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L3419)

#### Parameters

##### params

###### allowFallbackBand?

`boolean`

###### layout

`PremiumLayout`

###### opacity?

`number`

###### scale?

`number`

###### size

`number`

###### sourceClass?

`SourceClass`

###### sourceImage?

`Uint8Array`\<`ArrayBufferLike`\>

###### subjectMaskKind?

`"heroCutout"` \| `"sourceAlpha"` \| `"rembgCutout"`

###### subjectMaskSourceImage?

`Uint8Array`\<`ArrayBufferLike`\>

###### topBiasPx?

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderFrameBloom()

> **renderFrameBloom**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1447](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1447)

#### Parameters

##### params

###### layout

`PremiumLayout`

###### size

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderOuterGlow()

> **renderOuterGlow**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1344](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1344)

#### Parameters

##### params

###### layout

`PremiumLayout`

###### size

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderPremiumFrame()

> **renderPremiumFrame**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1468](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1468)

#### Parameters

##### params

###### layout

`PremiumLayout`

###### size

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderPremiumTokenIcon()

> **renderPremiumTokenIcon**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:4054](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L4054)

#### Parameters

##### params

[`PremiumTokenIconParams`](#premiumtokeniconparams)

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
