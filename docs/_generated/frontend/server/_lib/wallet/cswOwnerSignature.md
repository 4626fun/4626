[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/wallet/cswOwnerSignature

# server/\_lib/wallet/cswOwnerSignature

## Type Aliases

### CswReadContractClient

> **CswReadContractClient** = `object`

Defined in: [server/\_lib/wallet/cswOwnerSignature.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/cswOwnerSignature.ts#L34)

Minimal viem client surface for CSW replay-safe hash reads (avoids duplicate PublicClient resolution).

#### Properties

##### readContract()

> **readContract**: (`args`) => `Promise`\<`unknown`\>

Defined in: [server/\_lib/wallet/cswOwnerSignature.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/cswOwnerSignature.ts#L35)

###### Parameters

###### args

###### abi

readonly `unknown`[]

###### address

`Address`

###### args?

readonly `unknown`[]

###### functionName

`string`

###### Returns

`Promise`\<`unknown`\>

## Variables

### CSW\_REPLAY\_SAFE\_HASH\_ABI

> `const` **CSW\_REPLAY\_SAFE\_HASH\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"hash"`; `type`: `"bytes32"`; \}\]; `name`: `"replaySafeHash"`; `outputs`: readonly \[\{ `name`: `""`; `type`: `"bytes32"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [server/\_lib/wallet/cswOwnerSignature.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/cswOwnerSignature.ts#L43)

## Functions

### readCswReplaySafeHash()

> **readCswReplaySafeHash**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [server/\_lib/wallet/cswOwnerSignature.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/cswOwnerSignature.ts#L53)

#### Parameters

##### params

###### innerHash

`` `0x${string}` ``

###### publicClient

[`CswReadContractClient`](#cswreadcontractclient)

###### smartWallet

`string`

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### wrapCswOwnerSignature()

> **wrapCswOwnerSignature**(`ownerSignature`, `ownerIndex`): `` `0x${string}` ``

Defined in: [server/\_lib/wallet/cswOwnerSignature.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/cswOwnerSignature.ts#L81)

Wrap a raw 65-byte secp256k1 owner signature into the ERC-1271
`SignatureWrapper` format that Permit2 expects when the signer is a
Coinbase Smart Wallet.

#### Parameters

##### ownerSignature

`` `0x${string}` ``

##### ownerIndex

`number` = `0`

#### Returns

`` `0x${string}` ``
