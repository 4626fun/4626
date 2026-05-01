[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/agentRegistration

# server/\_lib/agent/agentRegistration

## Type Aliases

### RegistrationFile

> **RegistrationFile** = `object`

Defined in: [server/\_lib/agent/agentRegistration.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L20)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### active?

> `optional` **active**: `boolean`

Defined in: [server/\_lib/agent/agentRegistration.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L27)

##### description?

> `optional` **description**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L23)

##### image?

> `optional` **image**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L24)

##### name?

> `optional` **name**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L22)

##### registrations?

> `optional` **registrations**: `object`[]

Defined in: [server/\_lib/agent/agentRegistration.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L28)

###### agentId

> **agentId**: `number`

###### agentRegistry

> **agentRegistry**: `string`

##### reputationRegistry?

> `optional` **reputationRegistry**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L29)

##### services?

> `optional` **services**: [`RegistrationService`](#registrationservice)[]

Defined in: [server/\_lib/agent/agentRegistration.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L25)

##### supportedTrust?

> `optional` **supportedTrust**: `string`[]

Defined in: [server/\_lib/agent/agentRegistration.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L30)

##### type?

> `optional` **type**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L21)

##### x402Support?

> `optional` **x402Support**: `boolean`

Defined in: [server/\_lib/agent/agentRegistration.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L26)

***

### RegistrationService

> **RegistrationService** = `object`

Defined in: [server/\_lib/agent/agentRegistration.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L13)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### endpoint

> **endpoint**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L15)

##### name

> **name**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L14)

##### version?

> `optional` **version**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L16)

## Variables

### STRICT\_IMMUTABLE\_AGENT\_URI\_HINT

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_HINT**: `"Canonical onchain URI should stay strict immutable (data:, ipfs://, or ar://). Keep /.well-known/agent-registration.json as the public mirror and use HTTPS gateway URLs only as compatibility fallback links."` = `STRICT_IMMUTABLE_AGENT_URI_SUMMARY`

Defined in: [server/\_lib/agent/agentRegistration.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L37)

## Functions

### buildAgentRegistration()

> **buildAgentRegistration**(`origin`): `object`

Defined in: [server/\_lib/agent/agentRegistration.ts:283](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L283)

#### Parameters

##### origin

`string`

#### Returns

`object`

##### error?

> `optional` **error**: `string`

##### missing?

> `optional` **missing**: `string`[]

##### payload?

> `optional` **payload**: [`RegistrationFile`](#registrationfile)

## References

### AGENT\_REGISTRATION\_WELL\_KNOWN\_PATH

Re-exports [AGENT_REGISTRATION_WELL_KNOWN_PATH](../../../src/lib/agent/erc8004AgentUriPolicy.md#agent_registration_well_known_path)

***

### buildPublicAgentRegistrationUrl

Re-exports [buildPublicAgentRegistrationUrl](../../../src/lib/agent/erc8004AgentUriPolicy.md#buildpublicagentregistrationurl)

***

### buildPublicDomainVerificationUrl

Re-exports [buildPublicDomainVerificationUrl](../../../src/lib/agent/erc8004AgentUriPolicy.md#buildpublicdomainverificationurl)

***

### ERC8004\_DOMAIN\_VERIFICATION\_PATH

Re-exports [ERC8004_DOMAIN_VERIFICATION_PATH](../../../src/lib/agent/erc8004AgentUriPolicy.md#erc8004_domain_verification_path)
