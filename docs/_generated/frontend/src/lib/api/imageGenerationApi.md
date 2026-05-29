[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/api/imageGenerationApi

# src/lib/api/imageGenerationApi

## Type Aliases

### ImageGenerationJob

> **ImageGenerationJob** = `object`

Defined in: [src/lib/api/imageGenerationApi.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L25)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/api/imageGenerationApi.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L26)

##### latestError?

> `optional` **latestError**: `string` \| `null`

Defined in: [src/lib/api/imageGenerationApi.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L28)

##### status

> **status**: `JobStatus`

Defined in: [src/lib/api/imageGenerationApi.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L27)

***

### ImageGenerationProject

> **ImageGenerationProject** = `object`

Defined in: [src/lib/api/imageGenerationApi.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L8)

#### Properties

##### assets?

> `optional` **assets**: `object`[]

Defined in: [src/lib/api/imageGenerationApi.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L11)

###### blobUrl

> **blobUrl**: `string`

###### filename

> **filename**: `string` \| `null`

###### id

> **id**: `string`

###### mimeType

> **mimeType**: `string`

###### role

> **role**: `"frame"` \| `"subject"` \| `"output"`

##### attempts?

> `optional` **attempts**: `object`[]

Defined in: [src/lib/api/imageGenerationApi.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L18)

###### id

> **id**: `string`

###### passed

> **passed**: `boolean` \| `null`

###### score

> **score**: `number` \| `null`

##### id

> **id**: `string`

Defined in: [src/lib/api/imageGenerationApi.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L9)

##### status

> **status**: `ProjectStatus`

Defined in: [src/lib/api/imageGenerationApi.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L10)

## Functions

### associateImageProjectToVault()

> **associateImageProjectToVault**(`input`): `Promise`\<`void`\>

Defined in: [src/lib/api/imageGenerationApi.ts:157](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L157)

#### Parameters

##### input

###### projectId

`string`

###### vaultAddress

`string`

#### Returns

`Promise`\<`void`\>

***

### autoProvisionProjectAssets()

> **autoProvisionProjectAssets**(`input`): `Promise`\<\{ `subjectImageUrl`: `string`; \}\>

Defined in: [src/lib/api/imageGenerationApi.ts:134](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L134)

#### Parameters

##### input

###### chainId?

`number`

###### creatorCoinAddress

`string`

###### projectId

`string`

#### Returns

`Promise`\<\{ `subjectImageUrl`: `string`; \}\>

***

### createImageGenerationProject()

> **createImageGenerationProject**(`input`): `Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

Defined in: [src/lib/api/imageGenerationApi.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L52)

#### Parameters

##### input

###### brandContext?

`string`[]

###### instruction

`string`

###### stylePreset?

`string` \| `null`

#### Returns

`Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

***

### directComposeProject()

> **directComposeProject**(`projectId`): `Promise`\<\{ `breakoutApplied`: `boolean`; `outputBlobUrl`: `string`; \}\>

Defined in: [src/lib/api/imageGenerationApi.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L121)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<\{ `breakoutApplied`: `boolean`; `outputBlobUrl`: `string`; \}\>

***

### enqueueImageGeneration()

> **enqueueImageGeneration**(`projectId`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [src/lib/api/imageGenerationApi.ts:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L86)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

***

### enqueueImageRefine()

> **enqueueImageRefine**(`input`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [src/lib/api/imageGenerationApi.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L96)

#### Parameters

##### input

###### projectId

`string`

###### refineInstruction

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

***

### fileToBase64()

> **fileToBase64**(`file`): `Promise`\<`string`\>

Defined in: [src/lib/api/imageGenerationApi.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L47)

#### Parameters

##### file

`File`

#### Returns

`Promise`\<`string`\>

***

### getImageGenerationJob()

> **getImageGenerationJob**(`jobId`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [src/lib/api/imageGenerationApi.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L109)

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

***

### getImageGenerationProject()

> **getImageGenerationProject**(`projectId`): `Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

Defined in: [src/lib/api/imageGenerationApi.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L115)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

***

### getVaultImage()

> **getVaultImage**(`vaultAddress`): `Promise`\<\{ `outputBlobUrl`: `string`; \} \| `null`\>

Defined in: [src/lib/api/imageGenerationApi.ts:148](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L148)

#### Parameters

##### vaultAddress

`string`

#### Returns

`Promise`\<\{ `outputBlobUrl`: `string`; \} \| `null`\>

***

### uploadImageGenerationAsset()

> **uploadImageGenerationAsset**(`input`): `Promise`\<`void`\>

Defined in: [src/lib/api/imageGenerationApi.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/imageGenerationApi.ts#L66)

#### Parameters

##### input

###### file

`File`

###### projectId

`string`

###### role

`"frame"` \| `"subject"`

#### Returns

`Promise`\<`void`\>
