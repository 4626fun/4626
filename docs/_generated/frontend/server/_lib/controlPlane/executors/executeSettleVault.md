[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/controlPlane/executors/executeSettleVault

# server/\_lib/controlPlane/executors/executeSettleVault

## Classes

### SettleVaultExecutionError

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L5)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new SettleVaultExecutionError**(`params`): [`SettleVaultExecutionError`](#settlevaultexecutionerror)

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L10)

###### Parameters

###### params

###### code

`string`

###### message

`string`

###### retryable?

`boolean`

###### statusCode

`number`

###### Returns

[`SettleVaultExecutionError`](#settlevaultexecutionerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L7)

##### retryable

> **retryable**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L8)

##### statusCode

> **statusCode**: `number`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L6)

## Type Aliases

### ExecuteSettleVaultResult

> **ExecuteSettleVaultResult** = `object`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L102)

#### Properties

##### registryBootstrap?

> `optional` **registryBootstrap**: `object`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L106)

###### ajnaSeeded

> **ajnaSeeded**: `boolean`

###### keeprProvisioned

> **keeprProvisioned**: `boolean`

###### warnings

> **warnings**: `string`[]

##### stageUpdated

> **stageUpdated**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L105)

##### updated

> **updated**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L104)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L103)

***

### ParsedSettleVaultInput

> **ParsedSettleVaultInput** = `object`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L18)

#### Properties

##### graduatedAt

> **graduatedAt**: `string`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L20)

##### normalizedStage

> **normalizedStage**: `string`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L22)

##### settledAt

> **settledAt**: `string`

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L21)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L19)

## Functions

### executeSettleVault()

> **executeSettleVault**(`input`): `Promise`\<[`ExecuteSettleVaultResult`](#executesettlevaultresult)\>

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L113)

#### Parameters

##### input

###### graduatedAt?

`string`

###### settledAt?

`string`

###### settlementStage?

`string`

###### vaultAddress

`string`

#### Returns

`Promise`\<[`ExecuteSettleVaultResult`](#executesettlevaultresult)\>

***

### parseSettleVaultInput()

> **parseSettleVaultInput**(`input`): [`ParsedSettleVaultInput`](#parsedsettlevaultinput)

Defined in: [server/\_lib/controlPlane/executors/executeSettleVault.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/executors/executeSettleVault.ts#L25)

#### Parameters

##### input

###### graduatedAt?

`string`

###### settledAt?

`string`

###### settlementStage?

`string`

###### vaultAddress

`string`

#### Returns

[`ParsedSettleVaultInput`](#parsedsettlevaultinput)
