[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/deploy/workflow/runner

# server/\_lib/deploy/workflow/runner

## Type Aliases

### DeployWorkflowCallbacks

> **DeployWorkflowCallbacks** = `object`

Defined in: [server/\_lib/deploy/workflow/runner.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L16)

#### Properties

##### invokeContinue()

> **invokeContinue**: () => `Promise`\<[`WorkflowInvocationResult`](#workflowinvocationresult)\>

Defined in: [server/\_lib/deploy/workflow/runner.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L17)

###### Returns

`Promise`\<[`WorkflowInvocationResult`](#workflowinvocationresult)\>

##### invokeStatus()

> **invokeStatus**: () => `Promise`\<[`WorkflowInvocationResult`](#workflowinvocationresult)\>

Defined in: [server/\_lib/deploy/workflow/runner.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L18)

###### Returns

`Promise`\<[`WorkflowInvocationResult`](#workflowinvocationresult)\>

***

### WorkflowInvocationResult

> **WorkflowInvocationResult** = `object`

Defined in: [server/\_lib/deploy/workflow/runner.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L11)

#### Properties

##### payload

> **payload**: `any`

Defined in: [server/\_lib/deploy/workflow/runner.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L13)

##### statusCode

> **statusCode**: `number`

Defined in: [server/\_lib/deploy/workflow/runner.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L12)

## Functions

### runDeployWorkflow()

> **runDeployWorkflow**(`params`): `Promise`\<`DeployWorkflowResult`\>

Defined in: [server/\_lib/deploy/workflow/runner.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/deploy/workflow/runner.ts#L83)

#### Parameters

##### params

###### callbacks

[`DeployWorkflowCallbacks`](#deployworkflowcallbacks)

###### leaseMs?

`number`

###### maxTicks?

`number`

###### sessionId

`string`

###### workerId

`string`

#### Returns

`Promise`\<`DeployWorkflowResult`\>
