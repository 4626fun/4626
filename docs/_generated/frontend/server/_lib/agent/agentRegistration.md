[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/agent/agentRegistration

# server/\_lib/agent/agentRegistration

## Type Aliases

### RegistrationFile

> **RegistrationFile** = `object`

Defined in: [server/\_lib/agent/agentRegistration.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L22)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### active?

> `optional` **active**: `boolean`

Defined in: [server/\_lib/agent/agentRegistration.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L29)

##### description?

> `optional` **description**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L25)

##### image?

> `optional` **image**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L26)

##### name?

> `optional` **name**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L24)

##### registrations?

> `optional` **registrations**: `object`[]

Defined in: [server/\_lib/agent/agentRegistration.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L30)

###### agentId

> **agentId**: `number`

###### agentRegistry

> **agentRegistry**: `string`

##### reputationRegistry?

> `optional` **reputationRegistry**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L31)

##### services?

> `optional` **services**: [`RegistrationService`](#registrationservice)[]

Defined in: [server/\_lib/agent/agentRegistration.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L27)

##### supportedTrust?

> `optional` **supportedTrust**: `string`[]

Defined in: [server/\_lib/agent/agentRegistration.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L32)

##### type?

> `optional` **type**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L23)

##### x402Support?

> `optional` **x402Support**: `boolean`

Defined in: [server/\_lib/agent/agentRegistration.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L28)

***

### RegistrationService

> **RegistrationService** = `object`

Defined in: [server/\_lib/agent/agentRegistration.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L15)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### endpoint

> **endpoint**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L17)

##### name

> **name**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L16)

##### version?

> `optional` **version**: `string`

Defined in: [server/\_lib/agent/agentRegistration.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L18)

## Variables

### STRICT\_IMMUTABLE\_AGENT\_URI\_HINT

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_HINT**: `"Canonical onchain URI should stay strict immutable (data:, ipfs://, or ar://). Keep /.well-known/agent-registration.json as the public mirror and use HTTPS gateway URLs only as compatibility fallback links."` = `STRICT_IMMUTABLE_AGENT_URI_SUMMARY`

Defined in: [server/\_lib/agent/agentRegistration.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L39)

## Functions

### buildAgentRegistration()

> **buildAgentRegistration**(`origin`): `object`

Defined in: [server/\_lib/agent/agentRegistration.ts:288](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/agentRegistration.ts#L288)

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
