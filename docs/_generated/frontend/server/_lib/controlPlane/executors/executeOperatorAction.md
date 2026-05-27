[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/controlPlane/executors/executeOperatorAction

# server/\_lib/controlPlane/executors/executeOperatorAction

## Classes

### OperatorActionExecutionError

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L12)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new OperatorActionExecutionError**(`message`, `params?`): [`OperatorActionExecutionError`](#operatoractionexecutionerror)

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L16)

###### Parameters

###### message

`string`

###### params?

###### code?

`string`

###### retryable?

`boolean`

###### Returns

[`OperatorActionExecutionError`](#operatoractionexecutionerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L13)

##### retryable

> **retryable**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L14)

## Type Aliases

### ExecuteOperatorActionResult

> **ExecuteOperatorActionResult** = `object`

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L23)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L24)

##### executed

> **executed**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L25)

##### result

> **result**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L26)

## Functions

### executeOperatorAction()

> **executeOperatorAction**(`input`): `Promise`\<[`ExecuteOperatorActionResult`](#executeoperatoractionresult)\>

Defined in: [server/\_lib/controlPlane/executors/executeOperatorAction.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeOperatorAction.ts#L125)

#### Parameters

##### input

###### action

[`OperatorAction`](../operatorActions.md#operatoraction)

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`ExecuteOperatorActionResult`](#executeoperatoractionresult)\>

## References

### KeeperVaultActionError

Re-exports [KeeperVaultActionError](keeperVaultActions.md#keepervaultactionerror)
