[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_premiumTokenIconRenderer

# api/\_handlers/token/\_premiumTokenIconRenderer

## Type Aliases

### PremiumTokenIconParams

> **PremiumTokenIconParams** = `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:10](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L10)

#### Properties

##### heroCutoutSourceImage?

> `optional` **heroCutoutSourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:13](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L13)

##### renderPreset?

> `optional` **renderPreset**: `RenderPreset`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L15)

##### size

> **size**: `number`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:11](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L11)

##### sourceImage?

> `optional` **sourceImage**: `Uint8Array`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:12](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L12)

##### symbol?

> `optional` **symbol**: `string`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:14](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L14)

## Variables

### \_\_testables

> `const` **\_\_testables**: `object`

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2455](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2455)

#### Type Declaration

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

## Functions

### renderArtworkLayer()

> **renderArtworkLayer**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:1666](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L1666)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:718](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L718)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2097](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2097)

#### Parameters

##### params

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

###### topBiasPx?

`number`

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

***

### renderFrameBloom()

> **renderFrameBloom**(`params`): `Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:946](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L946)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:853](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L853)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:967](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L967)

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

Defined in: [api/\_handlers/token/\_premiumTokenIconRenderer.ts:2249](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/token/_premiumTokenIconRenderer.ts#L2249)

#### Parameters

##### params

[`PremiumTokenIconParams`](#premiumtokeniconparams)

#### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>
