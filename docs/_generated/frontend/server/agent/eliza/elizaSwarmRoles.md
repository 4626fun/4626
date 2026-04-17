[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/agent/eliza/elizaSwarmRoles

# server/agent/eliza/elizaSwarmRoles

## Type Aliases

### AgentSwarmRole

> **AgentSwarmRole** = `"general"` \| `"trader"` \| `"social"` \| `"knowledge"`

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L9)

## Variables

### DEFAULT\_SWARM\_CAPABILITIES

> `const` **DEFAULT\_SWARM\_CAPABILITIES**: `Record`\<[`AgentSwarmRole`](#agentswarmrole), `string`[]\>

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L11)

## Functions

### inferSwarmRoleFromAgentKey()

> **inferSwarmRoleFromAgentKey**(`agentKey`): [`AgentSwarmRole`](#agentswarmrole)

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L69)

#### Parameters

##### agentKey

`string`

#### Returns

[`AgentSwarmRole`](#agentswarmrole)

***

### normalizeSwarmRole()

> **normalizeSwarmRole**(`raw`): [`AgentSwarmRole`](#agentswarmrole) \| `null`

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L18)

#### Parameters

##### raw

`string`

#### Returns

[`AgentSwarmRole`](#agentswarmrole) \| `null`

***

### parseSwarmCapabilityMap()

> **parseSwarmCapabilityMap**(`raw`): `Partial`\<`Record`\<[`AgentSwarmRole`](#agentswarmrole), `string`[]\>\>

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L49)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`Partial`\<`Record`\<[`AgentSwarmRole`](#agentswarmrole), `string`[]\>\>

***

### parseSwarmRoleMap()

> **parseSwarmRoleMap**(`raw`): `Record`\<`string`, [`AgentSwarmRole`](#agentswarmrole)\>

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L31)

#### Parameters

##### raw

`string` | `undefined`

#### Returns

`Record`\<`string`, [`AgentSwarmRole`](#agentswarmrole)\>

***

### resolveSwarmProfile()

> **resolveSwarmProfile**(`agentKey`, `roleMap`, `capabilityOverrides`): `object`

Defined in: [server/agent/eliza/elizaSwarmRoles.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/agent/eliza/elizaSwarmRoles.ts#L77)

#### Parameters

##### agentKey

`string`

##### roleMap

`Record`\<`string`, [`AgentSwarmRole`](#agentswarmrole)\>

##### capabilityOverrides

`Partial`\<`Record`\<[`AgentSwarmRole`](#agentswarmrole), `string`[]\>\>

#### Returns

`object`

##### capabilities

> **capabilities**: `string`[]

##### role

> **role**: [`AgentSwarmRole`](#agentswarmrole)
