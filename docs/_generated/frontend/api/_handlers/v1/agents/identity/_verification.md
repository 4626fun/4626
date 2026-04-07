[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/v1/agents/identity/\_verification

# api/\_handlers/v1/agents/identity/\_verification

## Type Aliases

### AgentVerificationData

> **AgentVerificationData** = `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:156](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L156)

#### Properties

##### agentId

> **agentId**: `number`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:159](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L159)

##### agentRegistered

> **agentRegistered**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:164](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L164)

##### agentWallet

> **agentWallet**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:162](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L162)

##### canonicalCsw

> **canonicalCsw**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:160](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L160)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:157](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L157)

##### checks

> **checks**: `VerificationCheck`[]

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:176](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L176)

##### discoverabilityReady

> **discoverabilityReady**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:166](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L166)

##### endpoint

> **endpoint**: `Awaited`\<`ReturnType`\<*typeof* `probeEndpoint`\>\>

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:171](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L171)

##### links

> **links**: `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:178](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L178)

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

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:172](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L172)

###### domainVerification

> **domainVerification**: [`DomainVerificationProbe`](#domainverificationprobe)

###### registration

> **registration**: [`MirrorProbe`](#mirrorprobe)

##### onchainRegistration

> **onchainRegistration**: `RegistrationProbe`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:170](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L170)

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:161](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L161)

##### registryAddress

> **registryAddress**: `string`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:158](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L158)

##### rpcErrorCount

> **rpcErrorCount**: `number`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:186](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L186)

##### rpcHealthy

> **rpcHealthy**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:185](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L185)

##### teeAttestation

> **teeAttestation**: `TeeAttestationStatus`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:177](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L177)

##### tokenUri

> **tokenUri**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:163](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L163)

##### tokenUriIsStrictImmutable

> **tokenUriIsStrictImmutable**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:167](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L167)

##### tokenUriMatchesCanonical

> **tokenUriMatchesCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:168](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L168)

##### uriPolicy

> **uriPolicy**: [`AgentUriPolicy`](../../../../../src/lib/erc8004AgentUriPolicy.md#agenturipolicy)

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:169](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L169)

##### walletBoundToCanonical

> **walletBoundToCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:165](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L165)

***

### DomainVerificationProbe

> **DomainVerificationProbe** = `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:148](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L148)

#### Properties

##### error

> **error**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:153](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L153)

##### finalUrl

> **finalUrl**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:151](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L151)

##### matchesCanonical

> **matchesCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:152](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L152)

##### reachable

> **reachable**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:150](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L150)

##### url

> **url**: `string`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:149](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L149)

***

### MirrorProbe

> **MirrorProbe** = `object`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:72](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L72)

#### Properties

##### agentIdMatches

> **agentIdMatches**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:77](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L77)

##### error

> **error**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:78](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L78)

##### finalUrl

> **finalUrl**: `string` \| `null`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:75](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L75)

##### matchesCanonical

> **matchesCanonical**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L76)

##### reachable

> **reachable**: `boolean`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:74](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L74)

##### url

> **url**: `string`

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L73)

## Functions

### buildAgentVerificationData()

> **buildAgentVerificationData**(`req?`): `Promise`\<[`AgentVerificationData`](#agentverificationdata)\>

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:328](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L328)

#### Parameters

##### req?

`VercelRequest`

#### Returns

`Promise`\<[`AgentVerificationData`](#agentverificationdata)\>

***

### buildExpectedVerifiedEndpoints()

> **buildExpectedVerifiedEndpoints**(`origin`): `string`[]

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:197](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L197)

#### Parameters

##### origin

`string`

#### Returns

`string`[]

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/agents/identity/\_verification.ts:463](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/agents/identity/_verification.ts#L463)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
