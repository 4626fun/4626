[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/signatureShape

# src/lib/wallet/signatureShape

## Type Aliases

### SignatureShape

> **SignatureShape** = \{ `kind`: `"secp256k1"`; `r`: `` `0x${string}` ``; `s`: `` `0x${string}` ``; `v`: `number`; \} \| \{ `authenticatorData`: `` `0x${string}` ``; `challengeIndex`: `number`; `clientDataJSON`: `string`; `kind`: `"webauthn"`; `r`: `bigint`; `s`: `bigint`; `typeIndex`: `number`; \} \| \{ `kind`: `"unknown"`; `reason`: `string`; \}

Defined in: [src/lib/wallet/signatureShape.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/signatureShape.ts#L14)

## Functions

### detectSignatureShape()

> **detectSignatureShape**(`raw`): [`SignatureShape`](#signatureshape)

Defined in: [src/lib/wallet/signatureShape.ts:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/signatureShape.ts#L67)

#### Parameters

##### raw

`` `0x${string}` ``

#### Returns

[`SignatureShape`](#signatureshape)
