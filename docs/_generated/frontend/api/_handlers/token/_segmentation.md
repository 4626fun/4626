[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_segmentation

# api/\_handlers/token/\_segmentation

## Type Aliases

### GenerateSegmentationMaskOptions

> **GenerateSegmentationMaskOptions** = `object`

Defined in: [api/\_handlers/token/\_segmentation.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L22)

#### Properties

##### alphaMatting?

> `optional` **alphaMatting**: `boolean`

Defined in: [api/\_handlers/token/\_segmentation.ts:24](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L24)

##### binCandidates?

> `optional` **binCandidates**: `string`[]

Defined in: [api/\_handlers/token/\_segmentation.ts:28](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L28)

##### extraParamsJson?

> `optional` **extraParamsJson**: `string`

Defined in: [api/\_handlers/token/\_segmentation.ts:27](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L27)

##### maskOnly?

> `optional` **maskOnly**: `boolean`

Defined in: [api/\_handlers/token/\_segmentation.ts:25](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L25)

##### model

> **model**: [`SegmentationModel`](#segmentationmodel)

Defined in: [api/\_handlers/token/\_segmentation.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L23)

##### timeoutMs?

> `optional` **timeoutMs**: `number`

Defined in: [api/\_handlers/token/\_segmentation.ts:26](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L26)

***

### SegmentationModel

> **SegmentationModel** = `"bria-rmbg"` \| `"birefnet-general"` \| `"birefnet-portrait"` \| `"isnet-general-use"` \| `"isnet-anime"` \| `"u2net"` \| `"u2netp"` \| `"u2net_human_seg"` \| `"sam"`

Defined in: [api/\_handlers/token/\_segmentation.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L11)

***

### SegmentationResult

> **SegmentationResult** = `object`

Defined in: [api/\_handlers/token/\_segmentation.ts:31](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L31)

#### Properties

##### cutoutPng?

> `optional` **cutoutPng**: `Buffer`

Defined in: [api/\_handlers/token/\_segmentation.ts:36](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L36)

##### executable

> **executable**: `string`

Defined in: [api/\_handlers/token/\_segmentation.ts:34](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L34)

##### maskPngRgba

> **maskPngRgba**: `Buffer`

Defined in: [api/\_handlers/token/\_segmentation.ts:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L35)

##### model

> **model**: [`SegmentationModel`](#segmentationmodel)

Defined in: [api/\_handlers/token/\_segmentation.ts:33](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L33)

##### provider

> **provider**: `"rembg"`

Defined in: [api/\_handlers/token/\_segmentation.ts:32](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L32)

## Functions

### generateSegmentationMask()

> **generateSegmentationMask**(`pngBytes`, `options`): `Promise`\<[`SegmentationResult`](#segmentationresult) \| `null`\>

Defined in: [api/\_handlers/token/\_segmentation.ts:92](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/token/_segmentation.ts#L92)

#### Parameters

##### pngBytes

`Buffer`

##### options

[`GenerateSegmentationMaskOptions`](#generatesegmentationmaskoptions)

#### Returns

`Promise`\<[`SegmentationResult`](#segmentationresult) \| `null`\>
