[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/operations

# server/\_lib/controlPlane/operations

## Classes

### ControlPlaneOperationError

Defined in: [server/\_lib/controlPlane/operations.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L104)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ControlPlaneOperationError**(`params`): [`ControlPlaneOperationError`](#controlplaneoperationerror)

Defined in: [server/\_lib/controlPlane/operations.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L108)

###### Parameters

###### params

###### code

`string`

###### message

`string`

###### statusCode?

`number`

###### Returns

[`ControlPlaneOperationError`](#controlplaneoperationerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L105)

##### statusCode

> **statusCode**: `number`

Defined in: [server/\_lib/controlPlane/operations.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L106)

## Type Aliases

### CompleteControlPlaneOperationInput

> **CompleteControlPlaneOperationInput** = `object`

Defined in: [server/\_lib/controlPlane/operations.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L66)

#### Properties

##### actor?

> `optional` **actor**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L72)

##### errorCode?

> `optional` **errorCode**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L70)

##### errorMessage?

> `optional` **errorMessage**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L71)

##### operationId

> **operationId**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L67)

##### result?

> `optional` **result**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L69)

##### status

> **status**: `Exclude`\<[`OperationStatus`](#operationstatus), `"requested"` \| `"queued"` \| `"running"` \| `"blocked"` \| `"retrying"` \| `"manual_review"`\>

Defined in: [server/\_lib/controlPlane/operations.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L68)

***

### CreateOperationStageInput

> **CreateOperationStageInput** = `object`

Defined in: [server/\_lib/controlPlane/operations.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L75)

#### Properties

##### input?

> `optional` **input**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L79)

##### operationId

> **operationId**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L76)

##### stageKind

> **stageKind**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L77)

##### status?

> `optional` **status**: [`StageStatus`](#stagestatus)

Defined in: [server/\_lib/controlPlane/operations.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L78)

***

### OperationStatus

> **OperationStatus** = `"requested"` \| `"queued"` \| `"running"` \| `"blocked"` \| `"retrying"` \| `"manual_review"` \| `"succeeded"` \| `"failed"` \| `"cancelled"` \| `"expired"`

Defined in: [server/\_lib/controlPlane/operations.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L12)

***

### StageStatus

> **StageStatus** = [`OperationStatus`](#operationstatus)

Defined in: [server/\_lib/controlPlane/operations.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L24)

***

### StartControlPlaneOperationInput

> **StartControlPlaneOperationInput** = `object`

Defined in: [server/\_lib/controlPlane/operations.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L52)

#### Properties

##### idempotencyKey?

> `optional` **idempotencyKey**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L60)

##### input?

> `optional` **input**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L62)

##### lockKey?

> `optional` **lockKey**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L58)

##### lockScope?

> `optional` **lockScope**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L57)

##### operationKind

> **operationKind**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L53)

##### policyVersion?

> `optional` **policyVersion**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L63)

##### requestedBy?

> `optional` **requestedBy**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L59)

##### schemaVersion?

> `optional` **schemaVersion**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L61)

##### scopeId?

> `optional` **scopeId**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L56)

##### scopeType?

> `optional` **scopeType**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L55)

##### vaultAddress?

> `optional` **vaultAddress**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L54)

***

### TransitionOperationStatusInput

> **TransitionOperationStatusInput** = `object`

Defined in: [server/\_lib/controlPlane/operations.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L82)

#### Properties

##### actor?

> `optional` **actor**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L86)

##### data?

> `optional` **data**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L87)

##### errorCode?

> `optional` **errorCode**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L88)

##### errorMessage?

> `optional` **errorMessage**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L89)

##### nextStatus

> **nextStatus**: [`OperationStatus`](#operationstatus)

Defined in: [server/\_lib/controlPlane/operations.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L84)

##### operationId

> **operationId**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L83)

##### reason

> **reason**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L85)

##### result?

> `optional` **result**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L90)

***

### TransitionStageStatusInput

> **TransitionStageStatusInput** = `object`

Defined in: [server/\_lib/controlPlane/operations.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L93)

#### Properties

##### actor?

> `optional` **actor**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:97](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L97)

##### data?

> `optional` **data**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L98)

##### errorCode?

> `optional` **errorCode**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L100)

##### errorMessage?

> `optional` **errorMessage**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L101)

##### nextStatus

> **nextStatus**: [`StageStatus`](#stagestatus)

Defined in: [server/\_lib/controlPlane/operations.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L95)

##### reason

> **reason**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L96)

##### result?

> `optional` **result**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/operations.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L99)

##### stageId

> **stageId**: `string`

Defined in: [server/\_lib/controlPlane/operations.ts:94](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L94)

## Functions

### addControlPlaneEvent()

> **addControlPlaneEvent**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/controlPlane/operations.ts:251](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L251)

#### Parameters

##### params

###### data?

`Record`\<`string`, `unknown`\> \| `null`

###### eventType

`string`

###### message

`string`

###### operationId

`string`

###### stageId?

`string` \| `null`

#### Returns

`Promise`\<`void`\>

***

### beginOperationExecution()

> **beginOperationExecution**(`input`): `Promise`\<\{ `resumedFromTerminal`: `boolean`; `status`: [`OperationStatus`](#operationstatus) \| `null`; \}\>

Defined in: [server/\_lib/controlPlane/operations.ts:501](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L501)

Move an operation into `running` for a new execution attempt.
Reuses idempotent rows stuck in terminal `failed` / `expired` via `retrying`.

#### Parameters

##### input

###### actor?

`string` \| `null`

###### data?

`Record`\<`string`, `unknown`\> \| `null`

###### operationId

`string`

###### reason

`string`

#### Returns

`Promise`\<\{ `resumedFromTerminal`: `boolean`; `status`: [`OperationStatus`](#operationstatus) \| `null`; \}\>

***

### completeControlPlaneOperation()

> **completeControlPlaneOperation**(`input`): `Promise`\<`void`\>

Defined in: [server/\_lib/controlPlane/operations.ts:687](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L687)

#### Parameters

##### input

[`CompleteControlPlaneOperationInput`](#completecontrolplaneoperationinput)

#### Returns

`Promise`\<`void`\>

***

### createControlPlaneStage()

> **createControlPlaneStage**(`input`): `Promise`\<\{ `persisted`: `boolean`; `stageId`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/operations.ts:412](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L412)

#### Parameters

##### input

[`CreateOperationStageInput`](#createoperationstageinput)

#### Returns

`Promise`\<\{ `persisted`: `boolean`; `stageId`: `string`; \}\>

***

### createOperationId()

> **createOperationId**(`kind`, `subject?`): `string`

Defined in: [server/\_lib/controlPlane/operations.ts:168](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L168)

#### Parameters

##### kind

`string`

##### subject?

`string`

#### Returns

`string`

***

### getOperationStatus()

> **getOperationStatus**(`operationId`): `Promise`\<[`OperationStatus`](#operationstatus) \| `null`\>

Defined in: [server/\_lib/controlPlane/operations.ts:476](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L476)

#### Parameters

##### operationId

`string`

#### Returns

`Promise`\<[`OperationStatus`](#operationstatus) \| `null`\>

***

### startControlPlaneOperation()

> **startControlPlaneOperation**(`input`): `Promise`\<\{ `operationId`: `string`; `persisted`: `boolean`; `reused`: `boolean`; \}\>

Defined in: [server/\_lib/controlPlane/operations.ts:272](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L272)

#### Parameters

##### input

[`StartControlPlaneOperationInput`](#startcontrolplaneoperationinput)

#### Returns

`Promise`\<\{ `operationId`: `string`; `persisted`: `boolean`; `reused`: `boolean`; \}\>

***

### transitionOperationStatus()

> **transitionOperationStatus**(`input`): `Promise`\<`void`\>

Defined in: [server/\_lib/controlPlane/operations.ts:542](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L542)

#### Parameters

##### input

[`TransitionOperationStatusInput`](#transitionoperationstatusinput)

#### Returns

`Promise`\<`void`\>

***

### transitionStageStatus()

> **transitionStageStatus**(`input`): `Promise`\<`void`\>

Defined in: [server/\_lib/controlPlane/operations.ts:613](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/operations.ts#L613)

#### Parameters

##### input

[`TransitionStageStatusInput`](#transitionstagestatusinput)

#### Returns

`Promise`\<`void`\>
