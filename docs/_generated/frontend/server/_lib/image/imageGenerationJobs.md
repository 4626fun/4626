[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/image/imageGenerationJobs

# server/\_lib/image/imageGenerationJobs

## Type Aliases

### ImageGenerationJob

> **ImageGenerationJob** = `object`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L9)

#### Properties

##### attempts

> **attempts**: `number`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L15)

##### completedAt

> **completedAt**: `string` \| `null`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L21)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L19)

##### id

> **id**: `string`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L10)

##### kind

> **kind**: [`ImageGenerationJobKind`](#imagegenerationjobkind-1)

Defined in: [server/\_lib/image/imageGenerationJobs.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L12)

##### latestError

> **latestError**: `string` \| `null`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L17)

##### maxAttempts

> **maxAttempts**: `number`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L16)

##### projectId

> **projectId**: `string`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L11)

##### refineInstruction

> **refineInstruction**: `string` \| `null`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L14)

##### result

> **result**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L18)

##### status

> **status**: [`ImageGenerationJobStatus`](#imagegenerationjobstatus-1)

Defined in: [server/\_lib/image/imageGenerationJobs.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L13)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L20)

***

### ImageGenerationJobKind

> **ImageGenerationJobKind** = `"generate"` \| `"refine"`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L6)

***

### ImageGenerationJobStatus

> **ImageGenerationJobStatus** = `"pending"` \| `"processing"` \| `"completed"` \| `"failed"`

Defined in: [server/\_lib/image/imageGenerationJobs.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L7)

## Functions

### enqueueImageGenerationJob()

> **enqueueImageGenerationJob**(`input`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

Defined in: [server/\_lib/image/imageGenerationJobs.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L47)

#### Parameters

##### input

###### kind

[`ImageGenerationJobKind`](#imagegenerationjobkind-1)

###### projectId

`string`

###### refineInstruction?

`string` \| `null`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob)\>

***

### getImageGenerationJob()

> **getImageGenerationJob**(`jobId`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob) \| `null`\>

Defined in: [server/\_lib/image/imageGenerationJobs.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L79)

#### Parameters

##### jobId

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob) \| `null`\>

***

### leaseImageGenerationJob()

> **leaseImageGenerationJob**(`jobId`, `workerId`): `Promise`\<[`ImageGenerationJob`](#imagegenerationjob) \| `null`\>

Defined in: [server/\_lib/image/imageGenerationJobs.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L95)

#### Parameters

##### jobId

`string`

##### workerId

`string`

#### Returns

`Promise`\<[`ImageGenerationJob`](#imagegenerationjob) \| `null`\>

***

### updateImageGenerationJob()

> **updateImageGenerationJob**(`input`): `Promise`\<`void`\>

Defined in: [server/\_lib/image/imageGenerationJobs.ts:116](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/image/imageGenerationJobs.ts#L116)

#### Parameters

##### input

###### completed?

`boolean`

###### jobId

`string`

###### latestError?

`string` \| `null`

###### result?

`Record`\<`string`, `unknown`\> \| `null`

###### status?

[`ImageGenerationJobStatus`](#imagegenerationjobstatus-1)

#### Returns

`Promise`\<`void`\>
