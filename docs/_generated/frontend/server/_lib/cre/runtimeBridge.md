[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/cre/runtimeBridge

# server/\_lib/cre/runtimeBridge

## Type Aliases

### RuntimeAuthResult

> **RuntimeAuthResult** = \{ `correlationId`: `string`; `ok`: `true`; \} \| \{ `correlationId`: `string`; `error`: `string`; `ok`: `false`; `status`: `number`; \}

Defined in: [server/\_lib/cre/runtimeBridge.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L78)

***

### RuntimeDecision

> **RuntimeDecision** = `object`

Defined in: [server/\_lib/cre/runtimeBridge.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L43)

#### Properties

##### correlationId

> **correlationId**: `string` \| `null`

Defined in: [server/\_lib/cre/runtimeBridge.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L49)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L50)

##### decision

> **decision**: `unknown`

Defined in: [server/\_lib/cre/runtimeBridge.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L47)

##### id

> **id**: `number`

Defined in: [server/\_lib/cre/runtimeBridge.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L44)

##### idempotencyKey

> **idempotencyKey**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L46)

##### status

> **status**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L48)

##### workflow

> **workflow**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L45)

***

### RuntimeDecisionInput

> **RuntimeDecisionInput** = `object`

Defined in: [server/\_lib/cre/runtimeBridge.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L62)

#### Properties

##### correlationId?

> `optional` **correlationId**: `string` \| `null`

Defined in: [server/\_lib/cre/runtimeBridge.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L67)

##### decision

> **decision**: `unknown`

Defined in: [server/\_lib/cre/runtimeBridge.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L65)

##### idempotencyKey

> **idempotencyKey**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L64)

##### status?

> `optional` **status**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L66)

##### workflow

> **workflow**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L63)

***

### RuntimeEnqueueActionInput

> **RuntimeEnqueueActionInput** = `object`

Defined in: [server/\_lib/cre/runtimeBridge.ts:70](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L70)

#### Properties

##### action

> **action**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L74)

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L73)

##### dedupeKey?

> `optional` **dedupeKey**: `string` \| `null`

Defined in: [server/\_lib/cre/runtimeBridge.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L75)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L72)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/cre/runtimeBridge.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L71)

***

### RuntimeRecord

> **RuntimeRecord** = `object`

Defined in: [server/\_lib/cre/runtimeBridge.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L32)

#### Properties

##### correlationId

> **correlationId**: `string` \| `null`

Defined in: [server/\_lib/cre/runtimeBridge.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L39)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L40)

##### id

> **id**: `number`

Defined in: [server/\_lib/cre/runtimeBridge.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L33)

##### idempotencyKey

> **idempotencyKey**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L36)

##### kind

> **kind**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L35)

##### payload

> **payload**: `unknown`

Defined in: [server/\_lib/cre/runtimeBridge.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L37)

##### source

> **source**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L38)

##### workflow

> **workflow**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L34)

***

### RuntimeRecordInput

> **RuntimeRecordInput** = `object`

Defined in: [server/\_lib/cre/runtimeBridge.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L53)

#### Properties

##### correlationId?

> `optional` **correlationId**: `string` \| `null`

Defined in: [server/\_lib/cre/runtimeBridge.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L59)

##### idempotencyKey

> **idempotencyKey**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L56)

##### kind

> **kind**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L55)

##### payload

> **payload**: `unknown`

Defined in: [server/\_lib/cre/runtimeBridge.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L57)

##### source?

> `optional` **source**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L58)

##### workflow

> **workflow**: `string`

Defined in: [server/\_lib/cre/runtimeBridge.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L54)

## Functions

### authenticateRuntimeRequest()

> **authenticateRuntimeRequest**(`req`, `body`, `options`): `Promise`\<[`RuntimeAuthResult`](#runtimeauthresult)\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:207](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L207)

#### Parameters

##### req

`VercelRequest`

##### body

`unknown`

##### options

`RuntimeAuthOptions` = `{}`

#### Returns

`Promise`\<[`RuntimeAuthResult`](#runtimeauthresult)\>

***

### executeCreHttpTrigger()

> **executeCreHttpTrigger**(`input`): `Promise`\<\{ `gatewayUrl`: `string`; `ok`: `boolean`; `requestId`: `string`; `response`: `unknown`; `statusCode`: `number`; \}\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:455](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L455)

#### Parameters

##### input

`ExecuteWorkflowInput`

#### Returns

`Promise`\<\{ `gatewayUrl`: `string`; `ok`: `boolean`; `requestId`: `string`; `response`: `unknown`; `statusCode`: `number`; \}\>

***

### listRuntimeRecords()

> **listRuntimeRecords**(`params`): `Promise`\<[`RuntimeRecord`](#runtimerecord)[]\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:323](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L323)

#### Parameters

##### params

###### kind?

`string`

###### limit?

`number`

###### workflow?

`string`

#### Returns

`Promise`\<[`RuntimeRecord`](#runtimerecord)[]\>

***

### maybeEnqueueRuntimeAction()

> **maybeEnqueueRuntimeAction**(`input`): `Promise`\<`number`\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:416](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L416)

#### Parameters

##### input

[`RuntimeEnqueueActionInput`](#runtimeenqueueactioninput)

#### Returns

`Promise`\<`number`\>

***

### storeRuntimeDecision()

> **storeRuntimeDecision**(`input`): `Promise`\<\{ `decision`: [`RuntimeDecision`](#runtimedecision); `inserted`: `boolean`; \}\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:371](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L371)

#### Parameters

##### input

[`RuntimeDecisionInput`](#runtimedecisioninput)

#### Returns

`Promise`\<\{ `decision`: [`RuntimeDecision`](#runtimedecision); `inserted`: `boolean`; \}\>

***

### storeRuntimeRecord()

> **storeRuntimeRecord**(`input`): `Promise`\<\{ `inserted`: `boolean`; `record`: [`RuntimeRecord`](#runtimerecord); \}\>

Defined in: [server/\_lib/cre/runtimeBridge.ts:276](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/cre/runtimeBridge.ts#L276)

#### Parameters

##### input

[`RuntimeRecordInput`](#runtimerecordinput)

#### Returns

`Promise`\<\{ `inserted`: `boolean`; `record`: [`RuntimeRecord`](#runtimerecord); \}\>
