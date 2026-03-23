[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_premiumTokenIconRenderer

# api/\_handlers/token/\_premiumTokenIconRenderer

## Type Aliases

### PremiumTokenIconParams

> **PremiumTokenIconParams** = `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:13](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L13)

#### Properties

##### heroCutoutSourceImage?

> `optional` **heroCutoutSourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:16](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L16)

##### renderPreset?

> `optional` **renderPreset**: `RenderPreset`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:19](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L19)

##### size

> **size**: `number`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:14](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L14)

##### sourceImage?

> `optional` **sourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L15)

##### suppressBreakout?

> `optional` **suppressBreakout**: `boolean`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:17](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L17)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L18)

## Variables

### \_\_testables

> `const` **\_\_testables**: `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:3595](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L3595)

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

> **isSegmentationBreakoutCoverageAcceptable**: (`coverage`) => `boolean`

###### Parameters

###### coverage

`number`

###### Returns

`boolean`

##### measureBreakoutMaskCoverage()

> **measureBreakoutMaskCoverage**: (`params`) => `Promise`\<`number`\>

###### Parameters

###### params

###### layout

`PremiumLayout`

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2118](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2118)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1032](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1032)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2801](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2801)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1270](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1270)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1167](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1167)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1291](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1291)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:3206](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L3206)

#### Parameters

##### params

[`PremiumTokenIconParams`](#premiumtokeniconparams)

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
