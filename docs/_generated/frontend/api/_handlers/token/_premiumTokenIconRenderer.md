[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/token/\_premiumTokenIconRenderer

# api/\_handlers/token/\_premiumTokenIconRenderer

## Type Aliases

### PremiumTokenIconParams

> **PremiumTokenIconParams** = `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:14](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L14)

#### Properties

##### allowHeroCutoutBreakoutForNonPixelArt?

> `optional` **allowHeroCutoutBreakoutForNonPixelArt**: `boolean`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L25)

##### heroCutoutSourceImage?

> `optional` **heroCutoutSourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:17](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L17)

##### renderPreset?

> `optional` **renderPreset**: `RenderPreset`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:28](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L28)

##### signatureText?

> `optional` **signatureText**: `string`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:27](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L27)

##### size

> **size**: `number`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L15)

##### sourceImage?

> `optional` **sourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:16](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L16)

##### suppressBreakout?

> `optional` **suppressBreakout**: `boolean`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L18)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:26](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L26)

## Variables

### \_\_testables

> `const` **\_\_testables**: `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:4487](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L4487)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2343](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2343)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1216](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1216)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:3426](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L3426)

#### Parameters

##### params

###### allowFallbackBand?

`boolean`

###### allowHeroCutoutBreakoutForNonPixelArt?

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1454](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1454)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1351](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1351)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1475](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1475)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:4070](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L4070)

#### Parameters

##### params

[`PremiumTokenIconParams`](#premiumtokeniconparams)

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
