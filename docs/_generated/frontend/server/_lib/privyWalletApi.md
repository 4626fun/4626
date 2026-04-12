[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/privyWalletApi

# server/\_lib/privyWalletApi

## Functions

### createAgentWallet()

> **createAgentWallet**(`params?`): `Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

Defined in: [server/\_lib/privyWalletApi.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyWalletApi.ts#L171)

#### Parameters

##### params?

###### idempotencyKey?

`string`

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

***

### getWalletById()

> **getWalletById**(`walletId`): `Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

Defined in: [server/\_lib/privyWalletApi.ts:193](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyWalletApi.ts#L193)

#### Parameters

##### walletId

`string`

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

***

### secp256k1SignHash()

> **secp256k1SignHash**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [server/\_lib/privyWalletApi.ts:237](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyWalletApi.ts#L237)

#### Parameters

##### params

###### hash

`` `0x${string}` ``

###### idempotencyKey?

`string`

###### walletId

`string`

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### walletRpc()

> **walletRpc**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/\_lib/privyWalletApi.ts:202](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/privyWalletApi.ts#L202)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

###### chainType?

`"solana"` \| `"ethereum"`

###### idempotencyKey?

`string`

###### method

`string`

###### rpcParams

`any`

###### teeContext?

\{ `action?`: `string`; `actorAddress?`: `string`; `metadata?`: `Record`\<`string`, `unknown`\>; \}

###### teeContext.action?

`string`

###### teeContext.actorAddress?

`string`

###### teeContext.metadata?

`Record`\<`string`, `unknown`\>

###### walletId

`string`

#### Returns

`Promise`\<`T`\>
