[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/literalSubjectRenderer

# server/\_lib/literalSubjectRenderer

## Type Aliases

### LiteralSubjectContentBox

> **LiteralSubjectContentBox** = [`FixedContentBox`](imageContentBox.md#fixedcontentbox)

Defined in: [server/\_lib/literalSubjectRenderer.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L6)

***

### RenderLiteralSubjectLayerParams

> **RenderLiteralSubjectLayerParams** = `object`

Defined in: [server/\_lib/literalSubjectRenderer.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L8)

#### Properties

##### height

> **height**: `number`

Defined in: [server/\_lib/literalSubjectRenderer.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L11)

##### layoutHint?

> `optional` **layoutHint**: [`ArtworkLayout`](imageClassifier.md#artworklayout)

Defined in: [server/\_lib/literalSubjectRenderer.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L12)

##### subjectBytes

> **subjectBytes**: `Uint8Array`

Defined in: [server/\_lib/literalSubjectRenderer.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L9)

##### width

> **width**: `number`

Defined in: [server/\_lib/literalSubjectRenderer.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L10)

***

### RenderLiteralSubjectLayerResult

> **RenderLiteralSubjectLayerResult** = `object`

Defined in: [server/\_lib/literalSubjectRenderer.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L15)

#### Properties

##### contentBox

> **contentBox**: [`LiteralSubjectContentBox`](#literalsubjectcontentbox)

Defined in: [server/\_lib/literalSubjectRenderer.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L17)

##### interiorLayerBytes

> **interiorLayerBytes**: `Uint8Array`

Defined in: [server/\_lib/literalSubjectRenderer.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L16)

##### layout

> **layout**: [`ArtworkLayout`](imageClassifier.md#artworklayout)

Defined in: [server/\_lib/literalSubjectRenderer.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L18)

## Functions

### renderLiteralSubjectLayer()

> **renderLiteralSubjectLayer**(`params`): `Promise`\<[`RenderLiteralSubjectLayerResult`](#renderliteralsubjectlayerresult)\>

Defined in: [server/\_lib/literalSubjectRenderer.ts:70](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/literalSubjectRenderer.ts#L70)

#### Parameters

##### params

[`RenderLiteralSubjectLayerParams`](#renderliteralsubjectlayerparams)

#### Returns

`Promise`\<[`RenderLiteralSubjectLayerResult`](#renderliteralsubjectlayerresult)\>
