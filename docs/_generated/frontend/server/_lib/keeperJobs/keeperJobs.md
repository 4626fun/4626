[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/keeperJobs/keeperJobs

# server/\_lib/keeperJobs/keeperJobs

## Type Aliases

### ClaimKeeperJobsInput

> **ClaimKeeperJobsInput** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L39)

#### Properties

##### kinds?

> `optional` **kinds**: `string`[] \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L43)

##### leaseSeconds?

> `optional` **leaseSeconds**: `number` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L42)

##### limit?

> `optional` **limit**: `number` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L41)

##### workerId

> **workerId**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L40)

***

### CompleteKeeperJobInput

> **CompleteKeeperJobInput** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L46)

#### Properties

##### error?

> `optional` **error**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L50)

##### id

> **id**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L47)

##### result?

> `optional` **result**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L51)

##### retryDelaySeconds?

> `optional` **retryDelaySeconds**: `number` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L52)

##### status

> **status**: `Extract`\<[`KeeperJobStatus`](#keeperjobstatus-1), `"succeeded"` \| `"failed"` \| `"retry"`\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L49)

##### workerId

> **workerId**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L48)

***

### EnqueueKeeperJobInput

> **EnqueueKeeperJobInput** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L27)

#### Properties

##### dedupeKey?

> `optional` **dedupeKey**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L33)

##### kind

> **kind**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L28)

##### maxAttempts?

> `optional` **maxAttempts**: `number` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L36)

##### operationId?

> `optional` **operationId**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L30)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L29)

##### priority?

> `optional` **priority**: `number` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L34)

##### runAt?

> `optional` **runAt**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L35)

##### source?

> `optional` **source**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L32)

##### stageId?

> `optional` **stageId**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L31)

***

### KeeperJob

> **KeeperJob** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L5)

#### Properties

##### attemptCount

> **attemptCount**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L20)

##### claimedAt

> **claimedAt**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L18)

##### claimedBy

> **claimedBy**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L17)

##### claimExpiresAt

> **claimExpiresAt**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L19)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L23)

##### dedupeKey

> **dedupeKey**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L15)

##### id

> **id**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L6)

##### kind

> **kind**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L9)

##### lastError

> **lastError**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L22)

##### maxAttempts

> **maxAttempts**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L21)

##### operationId

> **operationId**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L7)

##### payload

> **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L12)

##### priority

> **priority**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L11)

##### result

> **result**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L13)

##### runAt

> **runAt**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L16)

##### source

> **source**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L14)

##### stageId

> **stageId**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L8)

##### status

> **status**: [`KeeperJobStatus`](#keeperjobstatus-1)

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L10)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L24)

***

### KeeperJobStatus

> **KeeperJobStatus** = `"pending"` \| `"claimed"` \| `"succeeded"` \| `"failed"` \| `"retry"`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L3)

***

### ListKeeperJobsInput

> **ListKeeperJobsInput** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L55)

#### Properties

##### kind?

> `optional` **kind**: `string` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L57)

##### limit?

> `optional` **limit**: `number` \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L58)

##### status?

> `optional` **status**: [`KeeperJobStatus`](#keeperjobstatus-1) \| `null`

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L56)

## Functions

### claimDueKeeperJobs()

> **claimDueKeeperJobs**(`input`): `Promise`\<[`KeeperJob`](#keeperjob)[]\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:191](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L191)

#### Parameters

##### input

[`ClaimKeeperJobsInput`](#claimkeeperjobsinput)

#### Returns

`Promise`\<[`KeeperJob`](#keeperjob)[]\>

***

### completeKeeperJob()

> **completeKeeperJob**(`input`): `Promise`\<[`KeeperJob`](#keeperjob) \| `null`\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:225](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L225)

#### Parameters

##### input

[`CompleteKeeperJobInput`](#completekeeperjobinput)

#### Returns

`Promise`\<[`KeeperJob`](#keeperjob) \| `null`\>

***

### enqueueKeeperJob()

> **enqueueKeeperJob**(`input`): `Promise`\<[`KeeperJob`](#keeperjob)\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L134)

#### Parameters

##### input

[`EnqueueKeeperJobInput`](#enqueuekeeperjobinput)

#### Returns

`Promise`\<[`KeeperJob`](#keeperjob)\>

***

### listKeeperJobs()

> **listKeeperJobs**(`input`): `Promise`\<[`KeeperJob`](#keeperjob)[]\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:298](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L298)

#### Parameters

##### input

[`ListKeeperJobsInput`](#listkeeperjobsinput) = `{}`

#### Returns

`Promise`\<[`KeeperJob`](#keeperjob)[]\>

***

### releaseExpiredKeeperJobClaims()

> **releaseExpiredKeeperJobClaims**(): `Promise`\<`number`\>

Defined in: [server/\_lib/keeperJobs/keeperJobs.ts:268](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobs.ts#L268)

#### Returns

`Promise`\<`number`\>
