[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/cswOwnerSignature

# src/lib/wallet/cswOwnerSignature

## Variables

### CSW\_OWNER\_EIP712\_DOMAIN

> `const` **CSW\_OWNER\_EIP712\_DOMAIN**: `object`

Defined in: [src/lib/wallet/cswOwnerSignature.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L35)

#### Type Declaration

##### name

> `readonly` **name**: `"Coinbase Smart Wallet"` = `'Coinbase Smart Wallet'`

##### version

> `readonly` **version**: `"1"` = `'1'`

***

### CSW\_OWNER\_MESSAGE\_TYPES

> `const` **CSW\_OWNER\_MESSAGE\_TYPES**: `object`

Defined in: [src/lib/wallet/cswOwnerSignature.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L40)

#### Type Declaration

##### CoinbaseSmartWalletMessage

> `readonly` **CoinbaseSmartWalletMessage**: readonly \[\{ `name`: `"hash"`; `type`: `"bytes32"`; \}\]

***

### CSW\_REPLAY\_SAFE\_HASH\_ABI

> `const` **CSW\_REPLAY\_SAFE\_HASH\_ABI**: readonly \[\{ `inputs`: readonly \[\{ `name`: `"hash"`; `type`: `"bytes32"`; \}\]; `name`: `"replaySafeHash"`; `outputs`: readonly \[\{ `name`: `""`; `type`: `"bytes32"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/lib/wallet/cswOwnerSignature.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L25)

## Functions

### assertCswAcceptsErc1271Signature()

> **assertCswAcceptsErc1271Signature**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/wallet/cswOwnerSignature.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L114)

#### Parameters

##### params

###### digest

`` `0x${string}` ``

###### publicClient

\{ \}

###### signature

`` `0x${string}` ``

###### smartWallet

`string`

#### Returns

`Promise`\<`void`\>

***

### readCswReplaySafeHash()

> **readCswReplaySafeHash**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/wallet/cswOwnerSignature.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L65)

#### Parameters

##### params

###### innerHash

`` `0x${string}` ``

###### publicClient

\{ \}

###### smartWallet

`string`

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### signOwnerSignatureForCswErc1271()

> **signOwnerSignatureForCswErc1271**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/wallet/cswOwnerSignature.ts:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L88)

Produce ERC-1271 SignatureWrapper bytes for a CSW owner authorizing `innerTypedDataDigest`
(e.g. Permit2 PermitSingle hash). CSW `isValidSignature` applies `replaySafeHash` before ecrecover.

#### Parameters

##### params

###### chainId?

`number`

###### innerTypedDataDigest

`` `0x${string}` ``

###### ownerIndex

`number`

###### publicClient

\{ \}

###### signerAddress

`string`

###### smartWallet

`string`

###### walletClient

`CswOwnerWalletClient`

#### Returns

`Promise`\<`` `0x${string}` ``\>

***

### wrapCswOwnerSignature()

> **wrapCswOwnerSignature**(`ownerSignature`, `ownerIndex`): `` `0x${string}` ``

Defined in: [src/lib/wallet/cswOwnerSignature.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/cswOwnerSignature.ts#L49)

Wrap a raw 65-byte secp256k1 owner signature for Permit2 when the token owner is a CSW.
Must use Solidity struct/tuple encoding — flat `(uint256, bytes)` makes CSW `isValidSignature` revert.
Mirrors server `wrapCswOwnerSignature` in `server/_lib/wallet/cswOwnerSignature.ts`.

#### Parameters

##### ownerSignature

`` `0x${string}` ``

##### ownerIndex

`number` = `0`

#### Returns

`` `0x${string}` ``
