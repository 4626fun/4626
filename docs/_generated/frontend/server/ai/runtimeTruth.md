[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/ai/runtimeTruth

# server/ai/runtimeTruth

## Type Aliases

### AssistantRuntimeTruth

> **AssistantRuntimeTruth** = `object`

Defined in: [server/ai/runtimeTruth.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L3)

#### Properties

##### deploymentFlowSource

> **deploymentFlowSource**: [`TrustedDeploymentSource`](#trusteddeploymentsource) \| `null`

Defined in: [server/ai/runtimeTruth.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L8)

##### deploymentFlowSummary

> **deploymentFlowSummary**: `string` \| `null`

Defined in: [server/ai/runtimeTruth.ts:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L9)

##### hasConversationMemory

> **hasConversationMemory**: `boolean`

Defined in: [server/ai/runtimeTruth.ts:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L5)

##### hasPersistentMemory

> **hasPersistentMemory**: `boolean`

Defined in: [server/ai/runtimeTruth.ts:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L6)

##### hasVerifiedDeploymentFlow

> **hasVerifiedDeploymentFlow**: `boolean`

Defined in: [server/ai/runtimeTruth.ts:7](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L7)

##### isElizaConnected

> **isElizaConnected**: `boolean`

Defined in: [server/ai/runtimeTruth.ts:4](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L4)

***

### AssistantRuntimeTruthInput

> **AssistantRuntimeTruthInput** = `Partial`\<[`AssistantRuntimeTruth`](#assistantruntimetruth)\>

Defined in: [server/ai/runtimeTruth.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L12)

***

### TrustedDeploymentSource

> **TrustedDeploymentSource** = `"app_state"` \| `"docs"` \| `"config"` \| `"api"` \| `"code"`

Defined in: [server/ai/runtimeTruth.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L1)

## Functions

### hasVerifiedMemoryContinuity()

> **hasVerifiedMemoryContinuity**(`runtimeTruth`): `boolean`

Defined in: [server/ai/runtimeTruth.ts:31](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L31)

#### Parameters

##### runtimeTruth

[`AssistantRuntimeTruth`](#assistantruntimetruth)

#### Returns

`boolean`

***

### resolveAssistantRuntimeTruth()

> **resolveAssistantRuntimeTruth**(`input?`): [`AssistantRuntimeTruth`](#assistantruntimetruth)

Defined in: [server/ai/runtimeTruth.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/ai/runtimeTruth.ts#L14)

#### Parameters

##### input?

`Partial`\<[`AssistantRuntimeTruth`](#assistantruntimetruth)\>

#### Returns

[`AssistantRuntimeTruth`](#assistantruntimetruth)
