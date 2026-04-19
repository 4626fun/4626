[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/image/openaiImage

# server/\_lib/image/openaiImage

## Type Aliases

### ImageEvaluation

> **ImageEvaluation** = `object`

Defined in: [server/\_lib/image/openaiImage.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L6)

#### Properties

##### brandFit

> **brandFit**: `number`

Defined in: [server/\_lib/image/openaiImage.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L12)

##### breakoutApplied?

> `optional` **breakoutApplied**: `boolean`

Defined in: [server/\_lib/image/openaiImage.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L15)

##### cleanliness

> **cleanliness**: `number`

Defined in: [server/\_lib/image/openaiImage.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L11)

##### frameProminence

> **frameProminence**: `number`

Defined in: [server/\_lib/image/openaiImage.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L8)

##### insideFrame

> **insideFrame**: `number`

Defined in: [server/\_lib/image/openaiImage.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L7)

##### modernElegantStyle

> **modernElegantStyle**: `number`

Defined in: [server/\_lib/image/openaiImage.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L10)

##### pass

> **pass**: `boolean`

Defined in: [server/\_lib/image/openaiImage.ts:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L13)

##### reasons

> **reasons**: `string`[]

Defined in: [server/\_lib/image/openaiImage.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L14)

##### subjectProminence

> **subjectProminence**: `number`

Defined in: [server/\_lib/image/openaiImage.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L9)

## Functions

### buildImageGenerationPrompt()

> **buildImageGenerationPrompt**(`input`): `string`

Defined in: [server/\_lib/image/openaiImage.ts:110](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L110)

#### Parameters

##### input

###### brandContext?

`string`[]

###### instruction

`string`

###### retryReasons?

`string`[]

###### stylePreset?

`string` \| `null`

#### Returns

`string`

***

### evaluateImageGenerationOutput()

> **evaluateImageGenerationOutput**(`params`): `Promise`\<[`ImageEvaluation`](#imageevaluation)\>

Defined in: [server/\_lib/image/openaiImage.ts:215](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L215)

#### Parameters

##### params

`EvaluateParams`

#### Returns

`Promise`\<[`ImageEvaluation`](#imageevaluation)\>

***

### generateImageWithOpenAi()

> **generateImageWithOpenAi**(`params`): `Promise`\<\{ `imageBytes`: `Uint8Array`; `responseId`: `string`; `revisedPrompt`: `string` \| `null`; \}\>

Defined in: [server/\_lib/image/openaiImage.ts:143](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L143)

#### Parameters

##### params

`GenerateParams`

#### Returns

`Promise`\<\{ `imageBytes`: `Uint8Array`; `responseId`: `string`; `revisedPrompt`: `string` \| `null`; \}\>

***

### getRetryReasonsFromEvaluation()

> **getRetryReasonsFromEvaluation**(`evaluation`): `string`[]

Defined in: [server/\_lib/image/openaiImage.ts:254](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L254)

#### Parameters

##### evaluation

[`ImageEvaluation`](#imageevaluation)

#### Returns

`string`[]

***

### shouldRunImageEvaluation()

> **shouldRunImageEvaluation**(): `boolean`

Defined in: [server/\_lib/image/openaiImage.ts:57](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/image/openaiImage.ts#L57)

#### Returns

`boolean`
