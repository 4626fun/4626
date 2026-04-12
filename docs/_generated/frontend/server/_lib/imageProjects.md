[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/imageProjects

# server/\_lib/imageProjects

## Type Aliases

### ImageGenerationAsset

> **ImageGenerationAsset** = `object`

Defined in: [server/\_lib/imageProjects.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L31)

#### Properties

##### blobPathname

> **blobPathname**: `string`

Defined in: [server/\_lib/imageProjects.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L37)

##### blobUrl

> **blobUrl**: `string`

Defined in: [server/\_lib/imageProjects.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L38)

##### byteSize

> **byteSize**: `number`

Defined in: [server/\_lib/imageProjects.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L39)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/imageProjects.ts:40](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L40)

##### filename

> **filename**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L35)

##### id

> **id**: `string`

Defined in: [server/\_lib/imageProjects.ts:32](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L32)

##### mimeType

> **mimeType**: `string`

Defined in: [server/\_lib/imageProjects.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L36)

##### projectId

> **projectId**: `string`

Defined in: [server/\_lib/imageProjects.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L33)

##### role

> **role**: [`ImageGenerationAssetRole`](#imagegenerationassetrole-1)

Defined in: [server/\_lib/imageProjects.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L34)

***

### ImageGenerationAssetRole

> **ImageGenerationAssetRole** = `"frame"` \| `"subject"` \| `"output"`

Defined in: [server/\_lib/imageProjects.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L14)

***

### ImageGenerationAttempt

> **ImageGenerationAttempt** = `object`

Defined in: [server/\_lib/imageProjects.ts:43](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L43)

#### Properties

##### attemptNumber

> **attemptNumber**: `number`

Defined in: [server/\_lib/imageProjects.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L47)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/imageProjects.ts:56](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L56)

##### evaluation

> **evaluation**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/imageProjects.ts:52](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L52)

##### id

> **id**: `string`

Defined in: [server/\_lib/imageProjects.ts:44](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L44)

##### jobId

> **jobId**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:46](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L46)

##### kind

> **kind**: `"generate"` \| `"refine"`

Defined in: [server/\_lib/imageProjects.ts:48](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L48)

##### outputAssetId

> **outputAssetId**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:55](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L55)

##### passed

> **passed**: `boolean` \| `null`

Defined in: [server/\_lib/imageProjects.ts:54](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L54)

##### projectId

> **projectId**: `string`

Defined in: [server/\_lib/imageProjects.ts:45](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L45)

##### prompt

> **prompt**: `string`

Defined in: [server/\_lib/imageProjects.ts:49](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L49)

##### responseId

> **responseId**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:51](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L51)

##### revisedPrompt

> **revisedPrompt**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:50](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L50)

##### score

> **score**: `number` \| `null`

Defined in: [server/\_lib/imageProjects.ts:53](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L53)

***

### ImageGenerationProject

> **ImageGenerationProject** = `object`

Defined in: [server/\_lib/imageProjects.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L16)

#### Properties

##### brandContext

> **brandContext**: `string`[]

Defined in: [server/\_lib/imageProjects.ts:22](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L22)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/imageProjects.ts:27](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L27)

##### creatorAddress

> **creatorAddress**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:26](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L26)

##### id

> **id**: `string`

Defined in: [server/\_lib/imageProjects.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L17)

##### instruction

> **instruction**: `string`

Defined in: [server/\_lib/imageProjects.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L20)

##### lastResponseId

> **lastResponseId**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:23](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L23)

##### latestError

> **latestError**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L24)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L18)

##### status

> **status**: [`ImageGenerationProjectStatus`](#imagegenerationprojectstatus-1)

Defined in: [server/\_lib/imageProjects.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L19)

##### stylePreset

> **stylePreset**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:21](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L21)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/imageProjects.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L28)

##### vaultAddress

> **vaultAddress**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:25](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L25)

***

### ImageGenerationProjectSnapshot

> **ImageGenerationProjectSnapshot** = `object`

Defined in: [server/\_lib/imageProjects.ts:59](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L59)

#### Properties

##### assets

> **assets**: [`ImageGenerationAsset`](#imagegenerationasset)[]

Defined in: [server/\_lib/imageProjects.ts:72](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L72)

##### attempts

> **attempts**: [`ImageGenerationAttempt`](#imagegenerationattempt)[]

Defined in: [server/\_lib/imageProjects.ts:73](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L73)

##### brandContext

> **brandContext**: `string`[]

Defined in: [server/\_lib/imageProjects.ts:65](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L65)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/imageProjects.ts:70](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L70)

##### creatorAddress

> **creatorAddress**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:69](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L69)

##### id

> **id**: `string`

Defined in: [server/\_lib/imageProjects.ts:60](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L60)

##### instruction

> **instruction**: `string`

Defined in: [server/\_lib/imageProjects.ts:63](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L63)

##### lastResponseId

> **lastResponseId**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:66](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L66)

##### latestError

> **latestError**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:67](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L67)

##### latestJob

> **latestJob**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/imageProjects.ts:74](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L74)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L61)

##### status

> **status**: [`ImageGenerationProjectStatus`](#imagegenerationprojectstatus-1)

Defined in: [server/\_lib/imageProjects.ts:62](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L62)

##### stylePreset

> **stylePreset**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L64)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/imageProjects.ts:71](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L71)

##### vaultAddress

> **vaultAddress**: `string` \| `null`

Defined in: [server/\_lib/imageProjects.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L68)

***

### ImageGenerationProjectStatus

> **ImageGenerationProjectStatus** = `"draft"` \| `"queued"` \| `"generating"` \| `"evaluating"` \| `"completed"` \| `"failed"`

Defined in: [server/\_lib/imageProjects.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L6)

## Functions

### attachImageGenerationAsset()

> **attachImageGenerationAsset**(`input`): `Promise`\<[`ImageGenerationAsset`](#imagegenerationasset)\>

Defined in: [server/\_lib/imageProjects.ts:300](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L300)

#### Parameters

##### input

###### bytes

`Uint8Array`

###### contentType

`string`

###### filename?

`string` \| `null`

###### projectId

`string`

###### role

`"frame"` \| `"subject"`

#### Returns

`Promise`\<[`ImageGenerationAsset`](#imagegenerationasset)\>

***

### createImageGenerationProject()

> **createImageGenerationProject**(`input`): `Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

Defined in: [server/\_lib/imageProjects.ts:264](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L264)

#### Parameters

##### input

###### brandContext?

`string`[]

###### creatorAddress?

`string` \| `null`

###### instruction?

`string`

###### ownerAddress

`string`

###### stylePreset?

`string` \| `null`

#### Returns

`Promise`\<[`ImageGenerationProject`](#imagegenerationproject)\>

***

### createOutputImageGenerationAsset()

> **createOutputImageGenerationAsset**(`input`): `Promise`\<[`ImageGenerationAsset`](#imagegenerationasset)\>

Defined in: [server/\_lib/imageProjects.ts:346](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L346)

#### Parameters

##### input

###### bytes

`Uint8Array`

###### contentType

`string`

###### filename?

`string` \| `null`

###### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationAsset`](#imagegenerationasset)\>

***

### ensureImageGenerationSchema()

> **ensureImageGenerationSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/imageProjects.ts:79](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L79)

#### Returns

`Promise`\<`void`\>

***

### getCompletedImageProjectForVault()

> **getCompletedImageProjectForVault**(`vaultAddress`): `Promise`\<\{ `outputBlobUrl`: `string`; `projectId`: `string`; \} \| `null`\>

Defined in: [server/\_lib/imageProjects.ts:520](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L520)

#### Parameters

##### vaultAddress

`string`

#### Returns

`Promise`\<\{ `outputBlobUrl`: `string`; `projectId`: `string`; \} \| `null`\>

***

### getCompletedImageProjectForVaultOwner()

> **getCompletedImageProjectForVaultOwner**(`vaultAddress`, `ownerAddress`): `Promise`\<\{ `outputBlobUrl`: `string`; `projectId`: `string`; \} \| `null`\>

Defined in: [server/\_lib/imageProjects.ts:547](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L547)

#### Parameters

##### vaultAddress

`string`

##### ownerAddress

`string`

#### Returns

`Promise`\<\{ `outputBlobUrl`: `string`; `projectId`: `string`; \} \| `null`\>

***

### getImageGenerationAssetsForProject()

> **getImageGenerationAssetsForProject**(`projectId`): `Promise`\<[`ImageGenerationAsset`](#imagegenerationasset)[]\>

Defined in: [server/\_lib/imageProjects.ts:491](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L491)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationAsset`](#imagegenerationasset)[]\>

***

### getImageGenerationProject()

> **getImageGenerationProject**(`projectId`): `Promise`\<[`ImageGenerationProjectSnapshot`](#imagegenerationprojectsnapshot) \| `null`\>

Defined in: [server/\_lib/imageProjects.ts:447](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L447)

#### Parameters

##### projectId

`string`

#### Returns

`Promise`\<[`ImageGenerationProjectSnapshot`](#imagegenerationprojectsnapshot) \| `null`\>

***

### recordImageGenerationAttempt()

> **recordImageGenerationAttempt**(`input`): `Promise`\<[`ImageGenerationAttempt`](#imagegenerationattempt)\>

Defined in: [server/\_lib/imageProjects.ts:405](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L405)

#### Parameters

##### input

###### attemptNumber

`number`

###### evaluation?

`Record`\<`string`, `unknown`\> \| `null`

###### jobId?

`string` \| `null`

###### kind

`"generate"` \| `"refine"`

###### outputAssetId?

`string` \| `null`

###### passed?

`boolean` \| `null`

###### projectId

`string`

###### prompt

`string`

###### responseId?

`string` \| `null`

###### revisedPrompt?

`string` \| `null`

###### score?

`number` \| `null`

#### Returns

`Promise`\<[`ImageGenerationAttempt`](#imagegenerationattempt)\>

***

### setImageProjectVaultAddress()

> **setImageProjectVaultAddress**(`projectId`, `vaultAddress`): `Promise`\<`void`\>

Defined in: [server/\_lib/imageProjects.ts:506](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L506)

#### Parameters

##### projectId

`string`

##### vaultAddress

`string`

#### Returns

`Promise`\<`void`\>

***

### updateImageGenerationProject()

> **updateImageGenerationProject**(`input`): `Promise`\<`void`\>

Defined in: [server/\_lib/imageProjects.ts:385](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/imageProjects.ts#L385)

#### Parameters

##### input

###### lastResponseId?

`string` \| `null`

###### latestError?

`string` \| `null`

###### projectId

`string`

###### status?

[`ImageGenerationProjectStatus`](#imagegenerationprojectstatus-1)

#### Returns

`Promise`\<`void`\>
