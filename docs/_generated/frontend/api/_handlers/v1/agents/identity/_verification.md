[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/v1/agents/identity/\_verification

# api/\_handlers/v1/agents/identity/\_verification

## Type Aliases

### AgentVerificationData

> **AgentVerificationData** = `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:164](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L164)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:167](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L167)

##### agentRegistered

> **agentRegistered**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:172](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L172)

##### agentWallet

> **agentWallet**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:170](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L170)

##### canonicalCsw

> **canonicalCsw**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:168](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L168)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:165](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L165)

##### checks

> **checks**: `VerificationCheck`[]

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:184](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L184)

##### discoverabilityReady

> **discoverabilityReady**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:174](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L174)

##### endpoint

> **endpoint**: `Awaited`\<`ReturnType`\<*typeof* [`probeEndpoint`](../../../../../server/_lib/agent/erc8004Review.md#probeendpoint)\>\>

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:179](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L179)

##### links

> **links**: `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:186](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L186)

###### agentWallet

> **agentWallet**: `string` \| `null`

###### canonicalCsw

> **canonicalCsw**: `string` \| `null`

###### ownerAddress

> **ownerAddress**: `string` \| `null`

###### registry

> **registry**: `string`

###### token

> **token**: `string`

##### mirrors

> **mirrors**: `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:180](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L180)

###### domainVerification

> **domainVerification**: [`DomainVerificationProbe`](#domainverificationprobe)

###### registration

> **registration**: [`MirrorProbe`](#mirrorprobe)

##### onchainRegistration

> **onchainRegistration**: [`RegistrationProbe`](../../../../../server/_lib/agent/erc8004Review.md#registrationprobe)

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:178](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L178)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:169](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L169)

##### registryAddress

> **registryAddress**: `string`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:166](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L166)

##### rpcErrorCount

> **rpcErrorCount**: `number`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:194](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L194)

##### rpcHealthy

> **rpcHealthy**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:193](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L193)

##### teeAttestation

> **teeAttestation**: `TeeAttestationStatus`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:185](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L185)

##### tokenUri

> **tokenUri**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:171](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L171)

##### tokenUriIsStrictImmutable

> **tokenUriIsStrictImmutable**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:175](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L175)

##### tokenUriMatchesCanonical

> **tokenUriMatchesCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:176](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L176)

##### uriPolicy

> **uriPolicy**: [`AgentUriPolicy`](../../../../../src/lib/agent/erc8004AgentUriPolicy.md#agenturipolicy)

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:177](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L177)

##### walletBoundToCanonical

> **walletBoundToCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:173](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L173)

***

### DomainVerificationProbe

> **DomainVerificationProbe** = `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:156](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L156)

#### Properties

##### error

> **error**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:161](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L161)

##### finalUrl

> **finalUrl**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:159](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L159)

##### matchesCanonical

> **matchesCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:160](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L160)

##### reachable

> **reachable**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:158](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L158)

##### url

> **url**: `string`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:157](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L157)

***

### MirrorProbe

> **MirrorProbe** = `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:80](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L80)

#### Properties

##### agentIdMatches

> **agentIdMatches**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:85](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L85)

##### error

> **error**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:86](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L86)

##### finalUrl

> **finalUrl**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:83](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L83)

##### matchesCanonical

> **matchesCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:84](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L84)

##### reachable

> **reachable**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:82](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L82)

##### url

> **url**: `string`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L81)

## Functions

### buildAgentVerificationData()

> **buildAgentVerificationData**(`req?`): `Promise`\<[`AgentVerificationData`](#agentverificationdata)\>

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:336](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L336)

#### Parameters

##### req?

`VercelRequest`

#### Returns

`Promise`\<[`AgentVerificationData`](#agentverificationdata)\>

***

### buildExpectedVerifiedEndpoints()

> **buildExpectedVerifiedEndpoints**(`origin`): `string`[]

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:205](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L205)

#### Parameters

##### origin

`string`

#### Returns

`string`[]

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:471](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L471)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
