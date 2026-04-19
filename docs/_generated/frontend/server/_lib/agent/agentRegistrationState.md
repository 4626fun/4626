[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/agentRegistrationState

# server/\_lib/agent/agentRegistrationState

## Type Aliases

### AgentRegistrationStateRow

> **AgentRegistrationStateRow** = `object`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L8)

#### Properties

##### agentKey

> **agentKey**: `string`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L9)

##### gatewayUrl

> **gatewayUrl**: `string` \| `null`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L12)

##### lensUri

> **lensUri**: `string`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L11)

##### payloadHash

> **payloadHash**: `string`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L10)

##### storageKey

> **storageKey**: `string` \| `null`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L13)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/agent/agentRegistrationState.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L14)

## Functions

### ensureAgentRegistrationStateSchema()

> **ensureAgentRegistrationStateSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/agent/agentRegistrationState.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L19)

#### Returns

`Promise`\<`void`\>

***

### getAgentRegistrationState()

> **getAgentRegistrationState**(`agentKey`): `Promise`\<[`AgentRegistrationStateRow`](#agentregistrationstaterow) \| `null`\>

Defined in: [server/\_lib/agent/agentRegistrationState.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L90)

#### Parameters

##### agentKey

`string`

#### Returns

`Promise`\<[`AgentRegistrationStateRow`](#agentregistrationstaterow) \| `null`\>

***

### upsertAgentRegistrationState()

> **upsertAgentRegistrationState**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/agent/agentRegistrationState.ts:118](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistrationState.ts#L118)

#### Parameters

##### params

###### agentKey

`string`

###### gatewayUrl?

`string` \| `null`

###### lensUri

`string`

###### payloadHash

`string`

###### storageKey?

`string` \| `null`

#### Returns

`Promise`\<`void`\>
