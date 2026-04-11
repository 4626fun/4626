[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/agentRegistration

# server/\_lib/agentRegistration

## Type Aliases

### RegistrationFile

> **RegistrationFile** = `object`

Defined in: [server/\_lib/agentRegistration.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L19)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### active?

> `optional` **active**: `boolean`

Defined in: [server/\_lib/agentRegistration.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L26)

##### description?

> `optional` **description**: `string`

Defined in: [server/\_lib/agentRegistration.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L22)

##### image?

> `optional` **image**: `string`

Defined in: [server/\_lib/agentRegistration.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L23)

##### name?

> `optional` **name**: `string`

Defined in: [server/\_lib/agentRegistration.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L21)

##### registrations?

> `optional` **registrations**: `object`[]

Defined in: [server/\_lib/agentRegistration.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L27)

###### agentId

> **agentId**: `number`

###### agentRegistry

> **agentRegistry**: `string`

##### reputationRegistry?

> `optional` **reputationRegistry**: `string`

Defined in: [server/\_lib/agentRegistration.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L28)

##### services?

> `optional` **services**: [`RegistrationService`](#registrationservice)[]

Defined in: [server/\_lib/agentRegistration.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L24)

##### supportedTrust?

> `optional` **supportedTrust**: `string`[]

Defined in: [server/\_lib/agentRegistration.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L29)

##### type?

> `optional` **type**: `string`

Defined in: [server/\_lib/agentRegistration.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L20)

##### x402Support?

> `optional` **x402Support**: `boolean`

Defined in: [server/\_lib/agentRegistration.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L25)

***

### RegistrationService

> **RegistrationService** = `object`

Defined in: [server/\_lib/agentRegistration.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L12)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### endpoint

> **endpoint**: `string`

Defined in: [server/\_lib/agentRegistration.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L14)

##### name

> **name**: `string`

Defined in: [server/\_lib/agentRegistration.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L13)

##### version?

> `optional` **version**: `string`

Defined in: [server/\_lib/agentRegistration.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L15)

## Variables

### STRICT\_IMMUTABLE\_AGENT\_URI\_HINT

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_HINT**: `"Canonical onchain URI should stay strict immutable (data:, ipfs://, or ar://). Keep /.well-known/agent-registration.json as the public mirror and use HTTPS gateway URLs only as compatibility fallback links."` = `STRICT_IMMUTABLE_AGENT_URI_SUMMARY`

Defined in: [server/\_lib/agentRegistration.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L36)

## Functions

### buildAgentRegistration()

> **buildAgentRegistration**(`origin`): `object`

Defined in: [server/\_lib/agentRegistration.ts:278](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentRegistration.ts#L278)

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

Re-exports [AGENT_REGISTRATION_WELL_KNOWN_PATH](../../src/lib/erc8004AgentUriPolicy.md#agent_registration_well_known_path)

***

### buildPublicAgentRegistrationUrl

Re-exports [buildPublicAgentRegistrationUrl](../../src/lib/erc8004AgentUriPolicy.md#buildpublicagentregistrationurl)

***

### buildPublicDomainVerificationUrl

Re-exports [buildPublicDomainVerificationUrl](../../src/lib/erc8004AgentUriPolicy.md#buildpublicdomainverificationurl)

***

### ERC8004\_DOMAIN\_VERIFICATION\_PATH

Re-exports [ERC8004_DOMAIN_VERIFICATION_PATH](../../src/lib/erc8004AgentUriPolicy.md#erc8004_domain_verification_path)
