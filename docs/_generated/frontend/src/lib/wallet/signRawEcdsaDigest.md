[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/signRawEcdsaDigest

# src/lib/wallet/signRawEcdsaDigest

## Functions

### isRawEcdsaDigest()

> **isRawEcdsaDigest**(`value`): `` value is `0x${string}` ``

Defined in: [src/lib/wallet/signRawEcdsaDigest.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/signRawEcdsaDigest.ts#L7)

#### Parameters

##### value

`unknown`

#### Returns

`` value is `0x${string}` ``

***

### signRawEcdsaDigest()

> **signRawEcdsaDigest**(`params`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/wallet/signRawEcdsaDigest.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/signRawEcdsaDigest.ts#L23)

Sign a 32-byte hash for Permit2 / UserOp lanes. Must NOT use personal_sign (EIP-191 prefix).
Prefer Privy `secp256k1_sign`, then `eth_sign` on the digest.

#### Parameters

##### params

###### digest

`` `0x${string}` ``

###### label?

`string`

###### signerAddress

`string`

###### walletClient

`WalletClientWithRequest`

#### Returns

`Promise`\<`` `0x${string}` ``\>
