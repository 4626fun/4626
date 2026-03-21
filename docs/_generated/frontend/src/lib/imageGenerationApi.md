[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/imageGenerationApi

# src/lib/imageGenerationApi

## Type Aliases

### ImageGenerationJob

> **ImageGenerationJob** = `object`

Defined in: [src/lib/imageGenerationApi.ts:23](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L23)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/imageGenerationApi.ts:24](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L24)

##### latestError?

> `optional` **latestError**: `string` \| `null`

Defined in: [src/lib/imageGenerationApi.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L26)

##### status

> **status**: `JobStatus`

Defined in: [src/lib/imageGenerationApi.ts:25](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L25)

***

### ImageGenerationProject

> **ImageGenerationProject** = `object`

Defined in: [src/lib/imageGenerationApi.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L6)

#### Properties

##### assets?

> `optional` **assets**: `object`[]

Defined in: [src/lib/imageGenerationApi.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L9)

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

Defined in: [src/lib/imageGenerationApi.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L16)

###### id

> **id**: `string`

###### passed

> **passed**: `boolean` \| `null`

###### score

> **score**: `number` \| `null`

##### id

> **id**: `string`

Defined in: [src/lib/imageGenerationApi.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L7)

##### status

> **status**: `ProjectStatus`

Defined in: [src/lib/imageGenerationApi.ts:8](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L8)

## Functions

### associateImageProjectToVault()

> **associateImageProjectToVault**(`input`): `Promise`\<`void`\>

Defined in: [src/lib/imageGenerationApi.ts:155](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L155)

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

Defined in: [src/lib/imageGenerationApi.ts:132](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L132)

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

Defined in: [src/lib/imageGenerationApi.ts:50](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L50)

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

Defined in: [src/lib/imageGenerationApi.ts:119](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L119)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<\{ `breakoutApplied`: `boolean`; `outputBlobUrl`: `string`; \}\>

***

### enqueueImageGeneration()

> **enqueueImageGeneration**(`projectId`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [src/lib/imageGenerationApi.ts:84](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L84)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

***

### enqueueImageRefine()

> **enqueueImageRefine**(`input`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [src/lib/imageGenerationApi.ts:94](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L94)

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

Defined in: [src/lib/imageGenerationApi.ts:45](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L45)

#### Parameters

##### file

`File`

#### Returns

`Promise`\<`string`\>

***

### getImageGenerationJob()

> **getImageGenerationJob**(`jobId`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [src/lib/imageGenerationApi.ts:107](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L107)

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

***

### getImageGenerationProject()

> **getImageGenerationProject**(`projectId`): `Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

Defined in: [src/lib/imageGenerationApi.ts:113](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L113)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

***

### getVaultImage()

> **getVaultImage**(`vaultAddress`): `Promise`\<\{ `outputBlobUrl`: `string`; \} \| `null`\>

Defined in: [src/lib/imageGenerationApi.ts:146](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L146)

#### Parameters

##### vaultAddress

`string`

#### Returns

`Promise`\<\{ `outputBlobUrl`: `string`; \} \| `null`\>

***

### uploadImageGenerationAsset()

> **uploadImageGenerationAsset**(`input`): `Promise`\<`void`\>

Defined in: [src/lib/imageGenerationApi.ts:64](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/imageGenerationApi.ts#L64)

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
