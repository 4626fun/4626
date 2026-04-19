[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/erc8004OperatorStatus

# server/\_lib/agent/erc8004OperatorStatus

## Type Aliases

### AgentOperatorNextAction

> **AgentOperatorNextAction** = `object`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L34)

#### Properties

##### detail

> **detail**: `string`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:37](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L37)

##### id

> **id**: [`AgentOperatorNextActionId`](#agentoperatornextactionid-1)

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L35)

##### label

> **label**: `string`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:36](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L36)

***

### AgentOperatorNextActionId

> **AgentOperatorNextActionId** = `"register_onchain_identity"` \| `"write_token_uri"` \| `"set_agent_wallet"` \| `"repair_mirror"` \| `"repair_domain_proof"` \| `"fix_service_endpoint"` \| `"rerun_discoverability"`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:25](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L25)

***

### AgentOperatorStatus

> **AgentOperatorStatus** = `object`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:40](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L40)

#### Properties

##### checkedAt

> **checkedAt**: `string`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:45](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L45)

##### discoverability

> **discoverability**: [`AgentVerificationData`](../../../api/_handlers/v1/agents/identity/_verification.md#agentverificationdata)

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:43](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L43)

##### nextActions

> **nextActions**: [`AgentOperatorNextAction`](#agentoperatornextaction)[]

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:44](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L44)

##### publish

> **publish**: [`AgentPublishData`](#agentpublishdata)

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L42)

##### registration

> **registration**: [`RegistrationFile`](agentRegistration.md#registrationfile)

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L41)

***

### AgentPublishData

> **AgentPublishData** = `object`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L19)

#### Properties

##### grove?

> `optional` **grove**: [`AgentPublishGroveData`](#agentpublishgrovedata)

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:22](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L22)

##### groveStatus

> **groveStatus**: `"stored"` \| `"unavailable"` \| `"skipped"`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:21](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L21)

##### uriPolicy

> **uriPolicy**: [`AgentUriPolicy`](../../../src/lib/agent/erc8004AgentUriPolicy.md#agenturipolicy)

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:20](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L20)

***

### AgentPublishGroveData

> **AgentPublishGroveData** = `object`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:12](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L12)

#### Properties

##### gatewayUrl

> **gatewayUrl**: `string`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:14](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L14)

##### lensUri

> **lensUri**: `string`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L13)

##### statusUrl

> **statusUrl**: `string` \| `null`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L16)

##### storageKey

> **storageKey**: `string`

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:15](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L15)

## Functions

### buildAgentOperatorStatus()

> **buildAgentOperatorStatus**(`req?`): `Promise`\<[`AgentOperatorStatus`](#agentoperatorstatus)\>

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:235](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L235)

#### Parameters

##### req?

`VercelRequest`

#### Returns

`Promise`\<[`AgentOperatorStatus`](#agentoperatorstatus)\>

***

### buildAgentPublishStatus()

> **buildAgentPublishStatus**(`options`): `Promise`\<`BuildAgentPublishStatusResult`\>

Defined in: [server/\_lib/agent/erc8004OperatorStatus.ts:168](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/erc8004OperatorStatus.ts#L168)

#### Parameters

##### options

`BuildAgentPublishStatusOptions` = `{}`

#### Returns

`Promise`\<`BuildAgentPublishStatusResult`\>
