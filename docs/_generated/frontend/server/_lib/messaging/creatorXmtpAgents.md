[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/messaging/creatorXmtpAgents

# server/\_lib/messaging/creatorXmtpAgents

## Type Aliases

### AgentType

> **AgentType** = `"eoa"` \| `"csw"`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L76)

***

### CreatorXmtpAgentRow

> **CreatorXmtpAgentRow** = `object`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L78)

#### Properties

##### agentType

> **agentType**: [`AgentType`](#agenttype)

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L81)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L85)

##### creatorAddress

> **creatorAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L79)

##### cswAddress

> **cswAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:83](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L83)

##### listedPublicly

> **listedPublicly**: `boolean`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L84)

##### privyWalletId

> **privyWalletId**: `string` \| `null`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L82)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L86)

##### xmtpAgentAddress

> **xmtpAgentAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L80)

## Functions

### decryptPrivateKey()

> **decryptPrivateKey**(`params`): `` `0x${string}` ``

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L34)

#### Parameters

##### params

###### aad

`string`

###### ciphertextB64

`string`

###### ivB64

`string`

###### tagB64

`string`

#### Returns

`` `0x${string}` ``

***

### enableCswAgent()

> **enableCswAgent**(`params`): `Promise`\<[`CreatorXmtpAgentRow`](#creatorxmtpagentrow)\>

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:199](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L199)

Enable a CSW-based XMTP agent for a creator.
Instead of generating a new EOA, this uses the creator's existing
Coinbase Smart Wallet as the XMTP identity.

The Privy wallet ID is used server-side to sign XMTP messages
on behalf of the CSW.

#### Parameters

##### params

###### creatorAddress

`` `0x${string}` ``

###### cswAddress

`` `0x${string}` ``

###### listedPublicly?

`boolean`

###### privyWalletId

`string`

#### Returns

`Promise`\<[`CreatorXmtpAgentRow`](#creatorxmtpagentrow)\>

***

### ensureCreatorXmtpAgentsSchema()

> **ensureCreatorXmtpAgentsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L47)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### getOrCreateCreatorXmtpAgent()

> **getOrCreateCreatorXmtpAgent**(`params`): `Promise`\<[`CreatorXmtpAgentRow`](#creatorxmtpagentrow)\>

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L107)

#### Parameters

##### params

###### creatorAddress

`` `0x${string}` ``

###### listedPublicly?

`boolean`

#### Returns

`Promise`\<[`CreatorXmtpAgentRow`](#creatorxmtpagentrow)\>

***

### listCreatorXmtpAgents()

> **listCreatorXmtpAgents**(`params`): `Promise`\<\{ `nextCursor`: \{ `createdAt`: `string`; `creatorAddress`: `` `0x${string}` ``; \} \| `null`; `rows`: [`CreatorXmtpAgentRow`](#creatorxmtpagentrow)[]; \}\>

Defined in: [server/\_lib/messaging/creatorXmtpAgents.ts:268](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/creatorXmtpAgents.ts#L268)

#### Parameters

##### params

###### creatorAddress?

`` `0x${string}` ``

###### cursor?

\{ `createdAt`: `string`; `creatorAddress`: `` `0x${string}` ``; \}

###### cursor.createdAt

`string`

###### cursor.creatorAddress

`` `0x${string}` ``

###### limit

`number`

###### listedOnly?

`boolean`

#### Returns

`Promise`\<\{ `nextCursor`: \{ `createdAt`: `string`; `creatorAddress`: `` `0x${string}` ``; \} \| `null`; `rows`: [`CreatorXmtpAgentRow`](#creatorxmtpagentrow)[]; \}\>
