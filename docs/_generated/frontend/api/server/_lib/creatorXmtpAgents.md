[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/server/\_lib/creatorXmtpAgents

# api/server/\_lib/creatorXmtpAgents

## Type Aliases

### AgentType

> **AgentType** = `"eoa"` \| `"csw"`

Defined in: [server/\_lib/creatorXmtpAgents.ts:75](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L75)

***

### CreatorXmtpAgentRow

> **CreatorXmtpAgentRow** = `object`

Defined in: [server/\_lib/creatorXmtpAgents.ts:77](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L77)

#### Properties

##### agentType

> **agentType**: [`AgentType`](#agenttype)

Defined in: [server/\_lib/creatorXmtpAgents.ts:80](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L80)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/creatorXmtpAgents.ts:84](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L84)

##### creatorAddress

> **creatorAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/creatorXmtpAgents.ts:78](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L78)

##### cswAddress

> **cswAddress**: `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/creatorXmtpAgents.ts:82](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L82)

##### listedPublicly

> **listedPublicly**: `boolean`

Defined in: [server/\_lib/creatorXmtpAgents.ts:83](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L83)

##### privyWalletId

> **privyWalletId**: `string` \| `null`

Defined in: [server/\_lib/creatorXmtpAgents.ts:81](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L81)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/creatorXmtpAgents.ts:85](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L85)

##### xmtpAgentAddress

> **xmtpAgentAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/creatorXmtpAgents.ts:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L79)

## Functions

### decryptPrivateKey()

> **decryptPrivateKey**(`params`): `` `0x${string}` ``

Defined in: [server/\_lib/creatorXmtpAgents.ts:33](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L33)

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

Defined in: [server/\_lib/creatorXmtpAgents.ts:198](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L198)

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

Defined in: [server/\_lib/creatorXmtpAgents.ts:46](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L46)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### getOrCreateCreatorXmtpAgent()

> **getOrCreateCreatorXmtpAgent**(`params`): `Promise`\<[`CreatorXmtpAgentRow`](#creatorxmtpagentrow)\>

Defined in: [server/\_lib/creatorXmtpAgents.ts:106](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L106)

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

Defined in: [server/\_lib/creatorXmtpAgents.ts:267](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/creatorXmtpAgents.ts#L267)

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
