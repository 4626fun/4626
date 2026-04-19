[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/agentAccessProof

# server/\_lib/agent/agentAccessProof

## Functions

### buildAgentAccessProofMessage()

> **buildAgentAccessProofMessage**(`fields`): `string`

Defined in: [server/\_lib/agent/agentAccessProof.ts:381](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessProof.ts#L381)

#### Parameters

##### fields

###### chainId

`number`

###### expiresAt

`string`

###### issuedAt

`string`

###### nonce

`string`

###### roomKey

`string`

###### shareToken

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`string`

***

### issueAgentAccessProofRequest()

> **issueAgentAccessProofRequest**(`params`): `Promise`\<\{ `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `message`: `string`; `nonce`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-access-proof-request-v1"`; `shareToken`: `string`; `wallet`: `string`; \}\>

Defined in: [server/\_lib/agent/agentAccessProof.ts:403](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessProof.ts#L403)

#### Parameters

##### params

###### chainId

`number`

###### nonceTtlMs?

`number`

###### roomKey

`string`

###### shareToken

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `message`: `string`; `nonce`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-access-proof-request-v1"`; `shareToken`: `string`; `wallet`: `string`; \}\>

***

### issueAgentRoomAccessToken()

> **issueAgentRoomAccessToken**(`params`): `Promise`\<\{ `accessToken`: `string`; `capabilities?`: (`"join"` \| `"read"` \| `"write"` \| `"react"` \| `"view-members"`)[]; `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `jti?`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-room-access-token-v1"`; `shareToken`: `string`; `sub`: `string`; `tokenType`: `"bearer"`; \}\>

Defined in: [server/\_lib/agent/agentAccessProof.ts:516](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessProof.ts#L516)

#### Parameters

##### params

###### capabilities?

(`"join"` \| `"read"` \| `"write"` \| `"react"` \| `"view-members"`)[]

###### chainId

`number`

###### roomKey

`string`

###### shareToken

`` `0x${string}` ``

###### sub

`` `0x${string}` ``

###### ttlMs?

`number`

#### Returns

`Promise`\<\{ `accessToken`: `string`; `capabilities?`: (`"join"` \| `"read"` \| `"write"` \| `"react"` \| `"view-members"`)[]; `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `jti?`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-room-access-token-v1"`; `shareToken`: `string`; `sub`: `string`; `tokenType`: `"bearer"`; \}\>

***

### verifyAgentAccessProofSubmission()

> **verifyAgentAccessProofSubmission**(`params`): `Promise`\<\{ `chainId`: `number`; `recoveredSigner`: `` `0x${string}` `` \| `null`; `roomKey`: `string`; `shareToken`: `` `0x${string}` ``; `signer`: `` `0x${string}` ``; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/agent/agentAccessProof.ts:440](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessProof.ts#L440)

#### Parameters

##### params

###### submission

\{ `proofRequest`: \{ `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `message`: `string`; `nonce`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-access-proof-request-v1"`; `shareToken`: `string`; `wallet`: `string`; \}; `schema`: `"4626-agent-access-proof-submit-v1"`; `signature`: `string`; `signer`: `string`; \}

###### submission.proofRequest

\{ `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `message`: `string`; `nonce`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-access-proof-request-v1"`; `shareToken`: `string`; `wallet`: `string`; \} = `agentAccessProofRequestSchema`

###### submission.proofRequest.chainId

`number` = `...`

###### submission.proofRequest.expiresAt

`string` = `isoDateTimeString`

###### submission.proofRequest.issuedAt

`string` = `isoDateTimeString`

###### submission.proofRequest.message

`string` = `...`

###### submission.proofRequest.nonce

`string` = `...`

###### submission.proofRequest.roomKey

`string` = `...`

###### submission.proofRequest.schema

`"4626-agent-access-proof-request-v1"` = `...`

###### submission.proofRequest.shareToken

`string` = `...`

###### submission.proofRequest.wallet

`string` = `...`

###### submission.schema

`"4626-agent-access-proof-submit-v1"` = `...`

###### submission.signature

`string` = `...`

###### submission.signer

`string` = `...`

#### Returns

`Promise`\<\{ `chainId`: `number`; `recoveredSigner`: `` `0x${string}` `` \| `null`; `roomKey`: `string`; `shareToken`: `` `0x${string}` ``; `signer`: `` `0x${string}` ``; `wallet`: `` `0x${string}` ``; \}\>

***

### verifyAgentRoomAccessToken()

> **verifyAgentRoomAccessToken**(`token`): `Promise`\<\{ `ok`: `true`; `token`: \{ `accessToken`: `string`; `capabilities?`: (`"join"` \| `"read"` \| `"write"` \| `"react"` \| `"view-members"`)[]; `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `jti?`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-room-access-token-v1"`; `shareToken`: `string`; `sub`: `string`; `tokenType`: `"bearer"`; \}; \} \| \{ `error`: `string`; `ok`: `false`; \}\>

Defined in: [server/\_lib/agent/agentAccessProof.ts:547](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agent/agentAccessProof.ts#L547)

#### Parameters

##### token

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; `token`: \{ `accessToken`: `string`; `capabilities?`: (`"join"` \| `"read"` \| `"write"` \| `"react"` \| `"view-members"`)[]; `chainId`: `number`; `expiresAt`: `string`; `issuedAt`: `string`; `jti?`: `string`; `roomKey`: `string`; `schema`: `"4626-agent-room-access-token-v1"`; `shareToken`: `string`; `sub`: `string`; `tokenType`: `"bearer"`; \}; \} \| \{ `error`: `string`; `ok`: `false`; \}\>
