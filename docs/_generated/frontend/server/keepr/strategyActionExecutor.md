[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/keepr/strategyActionExecutor

# server/keepr/strategyActionExecutor

## Classes

### KeeprStrategyError

Defined in: [server/keepr/strategyActionExecutor.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L103)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new KeeprStrategyError**(`message`, `retryable`): [`KeeprStrategyError`](#keeprstrategyerror)

Defined in: [server/keepr/strategyActionExecutor.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L106)

###### Parameters

###### message

`string`

###### retryable

`boolean`

###### Returns

[`KeeprStrategyError`](#keeprstrategyerror)

###### Overrides

`Error.constructor`

#### Properties

##### retryable

> **retryable**: `boolean`

Defined in: [server/keepr/strategyActionExecutor.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L104)

## Type Aliases

### ExecuteKeeprStrategyActionInput

> **ExecuteKeeprStrategyActionInput** = `object`

Defined in: [server/keepr/strategyActionExecutor.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L89)

#### Properties

##### action

> **action**: `Record`\<`string`, `unknown`\>

Defined in: [server/keepr/strategyActionExecutor.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L92)

##### actionType?

> `optional` **actionType**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L91)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/keepr/strategyActionExecutor.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L90)

***

### ExecuteKeeprStrategyActionResult

> **ExecuteKeeprStrategyActionResult** = `object`

Defined in: [server/keepr/strategyActionExecutor.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L95)

#### Properties

##### actionType

> **actionType**: [`StrategyActionType`](#strategyactiontype) \| `"unknown"`

Defined in: [server/keepr/strategyActionExecutor.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L98)

##### details?

> `optional` **details**: `Record`\<`string`, `unknown`\>

Defined in: [server/keepr/strategyActionExecutor.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L100)

##### error?

> `optional` **error**: `string`

Defined in: [server/keepr/strategyActionExecutor.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L99)

##### retryable

> **retryable**: `boolean`

Defined in: [server/keepr/strategyActionExecutor.ts:97](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L97)

##### success

> **success**: `boolean`

Defined in: [server/keepr/strategyActionExecutor.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L96)

***

### StrategyActionType

> **StrategyActionType** = `"strategy.ajna.rebucket"` \| `"strategy.charm.rebalance"`

Defined in: [server/keepr/strategyActionExecutor.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L49)

***

### StrategyQueueAgentRow

> **StrategyQueueAgentRow** = `object`

Defined in: [server/keepr/strategyActionExecutor.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L75)

#### Properties

##### agentType

> **agentType**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L81)

##### canonicalOwnerAddress

> **canonicalOwnerAddress**: `string`

Defined in: [server/keepr/strategyActionExecutor.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L78)

##### creatorAddress

> **creatorAddress**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L79)

##### cswAddress

> **cswAddress**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L83)

##### encryptedPrivateKeyB64

> **encryptedPrivateKeyB64**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L84)

##### encryptedPrivateKeyIvB64

> **encryptedPrivateKeyIvB64**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L85)

##### encryptedPrivateKeyTagB64

> **encryptedPrivateKeyTagB64**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L86)

##### groupId

> **groupId**: `string`

Defined in: [server/keepr/strategyActionExecutor.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L77)

##### privyWalletId

> **privyWalletId**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L82)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/keepr/strategyActionExecutor.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L76)

##### xmtpAgentAddress

> **xmtpAgentAddress**: `string` \| `null`

Defined in: [server/keepr/strategyActionExecutor.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L80)

## Functions

### executeKeeprStrategyAction()

> **executeKeeprStrategyAction**(`input`): `Promise`\<[`ExecuteKeeprStrategyActionResult`](#executekeeprstrategyactionresult)\>

Defined in: [server/keepr/strategyActionExecutor.ts:690](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L690)

#### Parameters

##### input

[`ExecuteKeeprStrategyActionInput`](#executekeeprstrategyactioninput)

#### Returns

`Promise`\<[`ExecuteKeeprStrategyActionResult`](#executekeeprstrategyactionresult)\>

***

### executeStrategyAction()

> **executeStrategyAction**(`actionType`, `action`, `options?`): `Promise`\<`Record`\<`string`, `unknown`\>\>

Defined in: [server/keepr/strategyActionExecutor.ts:343](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L343)

#### Parameters

##### actionType

[`StrategyActionType`](#strategyactiontype)

##### action

`Record`\<`string`, `unknown`\>

##### options?

###### queueRow?

[`StrategyQueueAgentRow`](#strategyqueueagentrow) \| `null`

###### vaultAddress?

`` `0x${string}` ``

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\>

***

### isStrategyActionType()

> **isStrategyActionType**(`actionType`): `actionType is StrategyActionType`

Defined in: [server/keepr/strategyActionExecutor.ts:339](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L339)

#### Parameters

##### actionType

`string`

#### Returns

`actionType is StrategyActionType`

***

### loadStrategyQueueAgentRow()

> **loadStrategyQueueAgentRow**(`vaultAddress`): `Promise`\<[`StrategyQueueAgentRow`](#strategyqueueagentrow) \| `null`\>

Defined in: [server/keepr/strategyActionExecutor.ts:294](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/keepr/strategyActionExecutor.ts#L294)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`StrategyQueueAgentRow`](#strategyqueueagentrow) \| `null`\>
