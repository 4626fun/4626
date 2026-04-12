[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/imageCompositor

# server/\_lib/imageCompositor

## Type Aliases

### ComposeLockedFrameImageParams

> **ComposeLockedFrameImageParams** = `object`

Defined in: [server/\_lib/imageCompositor.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L7)

#### Properties

##### artworkBytes?

> `optional` **artworkBytes**: `Uint8Array`

Defined in: [server/\_lib/imageCompositor.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L8)

##### extractedForegroundBytes?

> `optional` **extractedForegroundBytes**: `Uint8Array` \| `null`

Defined in: [server/\_lib/imageCompositor.ts:11](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L11)

##### forceBreakout?

> `optional` **forceBreakout**: `boolean`

Defined in: [server/\_lib/imageCompositor.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L14)

Skip heuristic subject-detection and always render the breakout layer.

##### frameBytes

> **frameBytes**: `Uint8Array`

Defined in: [server/\_lib/imageCompositor.ts:10](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L10)

##### interiorLayerBytes?

> `optional` **interiorLayerBytes**: `Uint8Array`

Defined in: [server/\_lib/imageCompositor.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L9)

##### layoutHint?

> `optional` **layoutHint**: [`ArtworkLayout`](imageClassifier.md#artworklayout)

Defined in: [server/\_lib/imageCompositor.ts:12](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L12)

***

### ComposeLockedFrameImageResult

> **ComposeLockedFrameImageResult** = `object`

Defined in: [server/\_lib/imageCompositor.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L17)

#### Properties

##### breakoutApplied

> **breakoutApplied**: `boolean`

Defined in: [server/\_lib/imageCompositor.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L20)

##### contentBox

> **contentBox**: [`ImageCompositorBox`](#imagecompositorbox)

Defined in: [server/\_lib/imageCompositor.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L19)

##### imageBytes

> **imageBytes**: `Uint8Array`

Defined in: [server/\_lib/imageCompositor.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L18)

##### layout

> **layout**: [`ArtworkLayout`](imageClassifier.md#artworklayout)

Defined in: [server/\_lib/imageCompositor.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L21)

***

### ImageCompositorBox

> **ImageCompositorBox** = [`FixedContentBox`](imageContentBox.md#fixedcontentbox)

Defined in: [server/\_lib/imageCompositor.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L5)

## Functions

### composeLockedFrameImage()

> **composeLockedFrameImage**(`params`): `Promise`\<[`ComposeLockedFrameImageResult`](#composelockedframeimageresult)\>

Defined in: [server/\_lib/imageCompositor.ts:483](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageCompositor.ts#L483)

#### Parameters

##### params

[`ComposeLockedFrameImageParams`](#composelockedframeimageparams)

#### Returns

`Promise`\<[`ComposeLockedFrameImageResult`](#composelockedframeimageresult)\>
