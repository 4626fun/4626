[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/privyWalletApi

# server/\_lib/wallet/privyWalletApi

## Type Aliases

### Caip2

> **Caip2** = `` `eip155:${number}` ``

Defined in: [server/\_lib/wallet/privyWalletApi.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L18)

***

### PrivyWalletFull

> **PrivyWalletFull** = `object`

Defined in: [server/\_lib/wallet/privyWalletApi.ts:269](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L269)

Full Privy wallet record including delegation state.
Returned by GET /v1/wallets/{id}.

#### Properties

##### additional\_signers

> **additional\_signers**: (\{ `id?`: `string`; `signer_id?`: `string`; \} \| `string`)[]

Defined in: [server/\_lib/wallet/privyWalletApi.ts:273](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L273)

##### address

> **address**: `string`

Defined in: [server/\_lib/wallet/privyWalletApi.ts:271](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L271)

##### chain\_type

> **chain\_type**: `"ethereum"` \| `string`

Defined in: [server/\_lib/wallet/privyWalletApi.ts:272](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L272)

##### id

> **id**: `string`

Defined in: [server/\_lib/wallet/privyWalletApi.ts:270](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L270)

##### owner\_id

> **owner\_id**: `string` \| `null`

Defined in: [server/\_lib/wallet/privyWalletApi.ts:274](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L274)

##### policy\_ids

> **policy\_ids**: `string`[]

Defined in: [server/\_lib/wallet/privyWalletApi.ts:275](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L275)

## Variables

### BASE\_CAIP2

> `const` **BASE\_CAIP2**: `"eip155:8453"`

Defined in: [server/\_lib/wallet/privyWalletApi.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L17)

CAIP-2 chain identifiers for Privy wallet RPC calls.

Privy's /v1/wallets/{id}/rpc endpoint requires a top-level `caip2` field for
chain-action RPC methods (notably `eth_sendTransaction`). Raw signing methods
(`secp256k1_sign`, `personal_sign`, `eth_signTypedData_v4`) do not require it.

Docs: https://docs.privy.io/api-reference/wallets/ethereum/eth-send-transaction

## Functions

### createAgentWallet()

> **createAgentWallet**(`params?`): `Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

Defined in: [server/\_lib/wallet/privyWalletApi.ts:183](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L183)

#### Parameters

##### params?

###### idempotencyKey?

`string`

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

***

### fetchPrivyWalletFull()

> **fetchPrivyWalletFull**(`walletId`): `Promise`\<[`PrivyWalletFull`](#privywalletfull) \| `null`\>

Defined in: [server/\_lib/wallet/privyWalletApi.ts:283](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L283)

Fetch the full Privy wallet record for `walletId`, including
`additional_signers` which is needed to verify delegation quorum membership.
Returns null if Privy responds with 404 (wallet not found).

#### Parameters

##### walletId

`string`

#### Returns

`Promise`\<[`PrivyWalletFull`](#privywalletfull) \| `null`\>

***

### getWalletById()

> **getWalletById**(`walletId`): `Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

Defined in: [server/\_lib/wallet/privyWalletApi.ts:205](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L205)

#### Parameters

##### walletId

`string`

#### Returns

`Promise`\<\{ `address`: `` `0x${string}` ``; `walletId`: `string`; \}\>

***

### secp256k1SignHash()

> **secp256k1SignHash**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [server/\_lib/wallet/privyWalletApi.ts:311](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L311)

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

Defined in: [server/\_lib/wallet/privyWalletApi.ts:214](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/privyWalletApi.ts#L214)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

###### caip2?

`` `eip155:${number}` ``

CAIP-2 chain identifier (e.g. 'eip155:8453' for Base).

REQUIRED by Privy for chain-action RPC methods such as `eth_sendTransaction`.
Optional for raw signing methods (`secp256k1_sign`, `personal_sign`,
`eth_signTypedData_v4`). When omitted, the field is not sent in the body.

###### chainType?

`"ethereum"` \| `"solana"`

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
