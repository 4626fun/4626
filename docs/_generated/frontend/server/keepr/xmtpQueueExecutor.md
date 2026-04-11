[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/keepr/xmtpQueueExecutor

# server/keepr/xmtpQueueExecutor

## Type Aliases

### ExecuteKeeprActionInput

> **ExecuteKeeprActionInput** = `object`

Defined in: [server/keepr/xmtpQueueExecutor.ts:122](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L122)

#### Properties

##### action

> **action**: `Record`\<`string`, `unknown`\>

Defined in: [server/keepr/xmtpQueueExecutor.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L127)

##### actionType?

> `optional` **actionType**: `string` \| `null`

Defined in: [server/keepr/xmtpQueueExecutor.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L126)

##### groupId

> **groupId**: `string`

Defined in: [server/keepr/xmtpQueueExecutor.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L125)

##### id

> **id**: `number`

Defined in: [server/keepr/xmtpQueueExecutor.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L123)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/keepr/xmtpQueueExecutor.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L124)

***

### ExecuteKeeprActionResult

> **ExecuteKeeprActionResult** = `object`

Defined in: [server/keepr/xmtpQueueExecutor.ts:130](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L130)

#### Properties

##### actionType

> **actionType**: `SupportedActionType` \| `"unknown"`

Defined in: [server/keepr/xmtpQueueExecutor.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L133)

##### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/keepr/xmtpQueueExecutor.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L135)

##### error?

> `optional` **error**: `string`

Defined in: [server/keepr/xmtpQueueExecutor.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L134)

##### retryable

> **retryable**: `boolean`

Defined in: [server/keepr/xmtpQueueExecutor.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L132)

##### success

> **success**: `boolean`

Defined in: [server/keepr/xmtpQueueExecutor.ts:131](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L131)

## Functions

### executeKeeprAction()

> **executeKeeprAction**(`input`): `Promise`\<[`ExecuteKeeprActionResult`](#executekeepractionresult)\>

Defined in: [server/keepr/xmtpQueueExecutor.ts:944](https://github.com/wenakita/4626/blob/main/frontend/server/keepr/xmtpQueueExecutor.ts#L944)

#### Parameters

##### input

[`ExecuteKeeprActionInput`](#executekeepractioninput)

#### Returns

`Promise`\<[`ExecuteKeeprActionResult`](#executekeepractionresult)\>
