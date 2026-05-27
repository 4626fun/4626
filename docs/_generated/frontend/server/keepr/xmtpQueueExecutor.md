[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/keepr/xmtpQueueExecutor

# server/keepr/xmtpQueueExecutor

## Type Aliases

### ExecuteKeeprActionInput

> **ExecuteKeeprActionInput** = `object`

Defined in: [server/keepr/xmtpQueueExecutor.ts:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L124)

#### Properties

##### action

> **action**: `Record`\<`string`, `unknown`\>

Defined in: [server/keepr/xmtpQueueExecutor.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L129)

##### actionType?

> `optional` **actionType**: `string` \| `null`

Defined in: [server/keepr/xmtpQueueExecutor.ts:128](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L128)

##### groupId

> **groupId**: `string`

Defined in: [server/keepr/xmtpQueueExecutor.ts:127](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L127)

##### id

> **id**: `number`

Defined in: [server/keepr/xmtpQueueExecutor.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L125)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/keepr/xmtpQueueExecutor.ts:126](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L126)

***

### ExecuteKeeprActionResult

> **ExecuteKeeprActionResult** = `object`

Defined in: [server/keepr/xmtpQueueExecutor.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L132)

#### Properties

##### actionType

> **actionType**: `SupportedActionType` \| `"unknown"`

Defined in: [server/keepr/xmtpQueueExecutor.ts:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L135)

##### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/keepr/xmtpQueueExecutor.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L137)

##### error?

> `optional` **error**: `string`

Defined in: [server/keepr/xmtpQueueExecutor.ts:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L136)

##### retryable

> **retryable**: `boolean`

Defined in: [server/keepr/xmtpQueueExecutor.ts:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L134)

##### success

> **success**: `boolean`

Defined in: [server/keepr/xmtpQueueExecutor.ts:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L133)

## Functions

### executeKeeprAction()

> **executeKeeprAction**(`input`): `Promise`\<[`ExecuteKeeprActionResult`](#executekeepractionresult)\>

Defined in: [server/keepr/xmtpQueueExecutor.ts:657](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/xmtpQueueExecutor.ts#L657)

#### Parameters

##### input

[`ExecuteKeeprActionInput`](#executekeepractioninput)

#### Returns

`Promise`\<[`ExecuteKeeprActionResult`](#executekeepractionresult)\>
