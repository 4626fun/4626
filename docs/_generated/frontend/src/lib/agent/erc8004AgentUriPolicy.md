[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/agent/erc8004AgentUriPolicy

# src/lib/agent/erc8004AgentUriPolicy

## Type Aliases

### AgentUriPolicy

> **AgentUriPolicy** = `object`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L11)

#### Properties

##### compatibilityFallbackUrl

> **compatibilityFallbackUrl**: `string` \| `null`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L19)

##### domainVerificationUrl

> **domainVerificationUrl**: `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L17)

##### mirrorUrl

> **mirrorUrl**: `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L16)

##### mode

> **mode**: *typeof* [`STRICT_IMMUTABLE_AGENT_URI_MODE`](#strict_immutable_agent_uri_mode)

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L12)

##### preferredOnchainUri

> **preferredOnchainUri**: `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L13)

##### preferredOnchainUriKind

> **preferredOnchainUriKind**: *typeof* [`STRICT_IMMUTABLE_AGENT_URI_KIND`](#strict_immutable_agent_uri_kind)

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L14)

##### preferredSchemes

> **preferredSchemes**: `string`[]

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L15)

##### writeOnchainHint

> **writeOnchainHint**: `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L18)

## Variables

### AGENT\_REGISTRATION\_WELL\_KNOWN\_PATH

> `const` **AGENT\_REGISTRATION\_WELL\_KNOWN\_PATH**: `"/.well-known/agent-registration.json"` = `'/.well-known/agent-registration.json'`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L1)

***

### ERC8004\_DOMAIN\_VERIFICATION\_PATH

> `const` **ERC8004\_DOMAIN\_VERIFICATION\_PATH**: `"/.well-known/erc8004.json"` = `'/.well-known/erc8004.json'`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L2)

***

### STRICT\_IMMUTABLE\_AGENT\_URI\_KIND

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_KIND**: `"data:"`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L4)

***

### STRICT\_IMMUTABLE\_AGENT\_URI\_MODE

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_MODE**: `"strict-immutable"`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L3)

***

### STRICT\_IMMUTABLE\_AGENT\_URI\_SCHEMES

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_SCHEMES**: readonly \[`"data:"`, `"ipfs://"`, `"ar://"`\]

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L5)

***

### STRICT\_IMMUTABLE\_AGENT\_URI\_SUMMARY

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_SUMMARY**: `"Canonical onchain URI should stay strict immutable (data:, ipfs://, or ar://). Keep /.well-known/agent-registration.json as the public mirror and use HTTPS gateway URLs only as compatibility fallback links."` = `'Canonical onchain URI should stay strict immutable (data:, ipfs://, or ar://). Keep /.well-known/agent-registration.json as the public mirror and use HTTPS gateway URLs only as compatibility fallback links.'`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L6)

***

### STRICT\_IMMUTABLE\_AGENT\_URI\_WRITE\_HINT

> `const` **STRICT\_IMMUTABLE\_AGENT\_URI\_WRITE\_HINT**: `"Write the strict immutable URI onchain for agent 2205. Keep the public registration mirror and domain proof live, and use any HTTPS gateway URL only as a compatibility fallback when a scanner cannot resolve the canonical URI."` = `'Write the strict immutable URI onchain for agent 2205. Keep the public registration mirror and domain proof live, and use any HTTPS gateway URL only as a compatibility fallback when a scanner cannot resolve the canonical URI.'`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L8)

## Functions

### buildAgentUriPolicy()

> **buildAgentUriPolicy**(`params`): [`AgentUriPolicy`](#agenturipolicy)

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L61)

#### Parameters

##### params

###### compatibilityFallbackUrl?

`string` \| `null`

###### origin

`string`

###### registration

`unknown`

#### Returns

[`AgentUriPolicy`](#agenturipolicy)

***

### buildPublicAgentRegistrationUrl()

> **buildPublicAgentRegistrationUrl**(`origin`): `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L48)

#### Parameters

##### origin

`string`

#### Returns

`string`

***

### buildPublicDomainVerificationUrl()

> **buildPublicDomainVerificationUrl**(`origin`): `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L52)

#### Parameters

##### origin

`string`

#### Returns

`string`

***

### toRegistrationDataUri()

> **toRegistrationDataUri**(`payload`): `string`

Defined in: [src/lib/agent/erc8004AgentUriPolicy.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/agent/erc8004AgentUriPolicy.ts#L56)

#### Parameters

##### payload

`unknown`

#### Returns

`string`
