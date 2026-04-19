[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/image/imageClassifier

# server/\_lib/image/imageClassifier

## Type Aliases

### ArtworkLayout

> **ArtworkLayout** = `"cover"` \| `"contain"` \| `"coin"`

Defined in: [server/\_lib/image/imageClassifier.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageClassifier.ts#L3)

## Functions

### classifyArtwork()

> **classifyArtwork**(`imageBytes`): `Promise`\<[`ArtworkLayout`](#artworklayout)\>

Defined in: [server/\_lib/image/imageClassifier.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageClassifier.ts#L23)

Classifies source artwork into a layout strategy via transparency + shape analysis.

cover   - full-bleed opaque image (photos, paintings, opaque rectangles)
contain - transparent background with non-circular content (logos, cutout mascots, vectors)
coin    - circular/badge-like content centered on a transparent background

#### Parameters

##### imageBytes

`Uint8Array`

#### Returns

`Promise`\<[`ArtworkLayout`](#artworklayout)\>
