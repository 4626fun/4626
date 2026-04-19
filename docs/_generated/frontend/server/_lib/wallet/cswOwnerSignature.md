[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/wallet/cswOwnerSignature

# server/\_lib/wallet/cswOwnerSignature

## Functions

### wrapCswOwnerSignature()

> **wrapCswOwnerSignature**(`ownerSignature`, `ownerIndex`): `` `0x${string}` ``

Defined in: [server/\_lib/wallet/cswOwnerSignature.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/wallet/cswOwnerSignature.ts#L53)

Wrap a raw 65-byte secp256k1 owner signature into the ERC-1271
`SignatureWrapper` format that Permit2 expects when the signer is a
Coinbase Smart Wallet.

#### Parameters

##### ownerSignature

`` `0x${string}` ``

65-byte ECDSA signature as a `0x`-prefixed hex
  string (output of `secp256k1SignHash` / Privy `secp256k1_sign`).

##### ownerIndex

`number` = `0`

Index of the owner within the CSW owner array.
  Defaults to 0 for the standard 1-of-1 provisioning setup.

#### Returns

`` `0x${string}` ``

abi.encode(uint256 ownerIndex, bytes signatureData) — the
  exact bytes that CSW's `isValidSignature` will decode.

#### Throws

Error when `ownerSignature` is not exactly 65 bytes (132 hex
  chars plus the 0x prefix, for a total length of 134).
