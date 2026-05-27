[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/passkeyUserOp

# src/lib/aa/passkeyUserOp

## Type Aliases

### PasskeyAssertion

> **PasskeyAssertion** = `object`

Defined in: [src/lib/aa/passkeyUserOp.ts:185](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L185)

#### Properties

##### authenticatorData

> **authenticatorData**: `Uint8Array`

Defined in: [src/lib/aa/passkeyUserOp.ts:186](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L186)

##### clientDataJSON

> **clientDataJSON**: `string`

Defined in: [src/lib/aa/passkeyUserOp.ts:187](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L187)

##### credentialId

> **credentialId**: `Uint8Array`

Defined in: [src/lib/aa/passkeyUserOp.ts:189](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L189)

##### signatureDer

> **signatureDer**: `Uint8Array`

Defined in: [src/lib/aa/passkeyUserOp.ts:188](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L188)

## Variables

### P256\_CURVE\_ORDER

> `const` **P256\_CURVE\_ORDER**: `115792089210356248762697446949407573529996955224135760342422259061068512044369n` = `0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n`

Defined in: [src/lib/aa/passkeyUserOp.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L26)

P-256 (secp256r1) curve order.
https://neuromancer.sk/std/secg/secp256r1

***

### WEBAUTHN\_PASSKEY\_STUB\_SIGNATURE

> `const` **WEBAUTHN\_PASSKEY\_STUB\_SIGNATURE**: `Hex` = `'0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000001949fc7c88032b9fcb5f6efc7a7b8c63668eae9871b765e23123bb473ff57aa831a7c0d9276168ebcc29f2875a0239cffdf2a9cd1c2007c5c77c071db9264df1d000000000000000000000000000000000000000000000000000000000000002549960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a2273496a396e6164474850596759334b7156384f7a4a666c726275504b474f716d59576f4d57516869467773222c226f726967696e223a2268747470733a2f2f7369676e2e636f696e626173652e636f6d222c2263726f73734f726967696e223a66616c73657d00000000000000000000000000000000000000000000'`

Defined in: [src/lib/aa/passkeyUserOp.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L19)

Canonical WebAuthn stub signature used for ERC-4337 gas estimation when
the signing owner is a passkey. CDP's bundler validates the *shape* of the
signature during eth_estimateUserOperationGas — it doesn't actually verify
the P256 sig, but it does require a well-formed SignatureWrapper around a
well-formed WebAuthnAuth tuple of plausible length. This is the exact value
used by viem's `toCoinbaseSmartAccount` for owner.type === 'webAuthn',
mirrored in coinbaseErc4337.ts. Extracted here so the passkey-direct UserOp
lane can reuse the same stub for estimation, then replace it with the real
passkey-signed wrapper for submission.

## Functions

### encodeSignatureWrapper()

> **encodeSignatureWrapper**(`ownerIndex`, `signatureData`): `` `0x${string}` ``

Defined in: [src/lib/aa/passkeyUserOp.ts:178](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L178)

abi.encode the CSW `SignatureWrapper(uint256 ownerIndex, bytes signatureData)`.

#### Parameters

##### ownerIndex

`bigint`

##### signatureData

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``

***

### encodeWebAuthnAuthSignature()

> **encodeWebAuthnAuthSignature**(`args`): `` `0x${string}` ``

Defined in: [src/lib/aa/passkeyUserOp.ts:151](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L151)

abi.encode the Coinbase Smart Wallet `WebAuthnAuth` tuple.

Computes `challengeIndex` / `typeIndex` from clientDataJSON. Caller may
pre-normalize r/s; this function does not re-apply low-S.

#### Parameters

##### args

###### authenticatorData

`Uint8Array`

###### clientDataJSON

`string`

###### r

`bigint`

###### s

`bigint`

#### Returns

`` `0x${string}` ``

***

### findClientDataJsonOffsets()

> **findClientDataJsonOffsets**(`json`): `object`

Defined in: [src/lib/aa/passkeyUserOp.ts:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L111)

Compute byte offsets of the `"challenge":"…"` and `"type":"…"` substrings
inside a serialized clientDataJSON string. The Coinbase Smart Wallet's
WebAuthn validator (WebAuthnSol) slices clientDataJSON starting at these
indices to verify the entries — typeIndex must point at the opening quote
of `"type"` (so the slice `[typeIndex, typeIndex+21)` equals
`"type":"webauthn.get"`), and challengeIndex must point at the opening
quote of `"challenge"` (so the slice begins with `"challenge":"`).

The clientDataJSON the browser produces is ASCII; the byte offset equals
the character offset.

#### Parameters

##### json

`string`

#### Returns

`object`

##### challengeIndex

> **challengeIndex**: `bigint`

##### typeIndex

> **typeIndex**: `bigint`

***

### getPasskeyAssertion()

> **getPasskeyAssertion**(`challenge`): `Promise`\<[`PasskeyAssertion`](#passkeyassertion)\>

Defined in: [src/lib/aa/passkeyUserOp.ts:215](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L215)

Request a same-origin WebAuthn assertion from the user's authenticator using
the provided 32-byte challenge. `allowCredentials: []` is intentional — the
OS picker handles credential selection.

This cannot assert Coinbase Smart Wallet passkeys from 4626.fun: browser
WebAuthn only permits an RP ID that is the current origin's effective domain
or a registrable suffix. Coinbase-managed CSW credentials live in Coinbase's
RP context, so owner actions for those passkeys must be routed through the
wallet/Base App prepared-call context instead of direct `navigator.credentials`
calls from this app.

Browser-only. Will throw if `navigator.credentials` is undefined.

#### Parameters

##### challenge

`Uint8Array`

#### Returns

`Promise`\<[`PasskeyAssertion`](#passkeyassertion)\>

***

### hashHexToChallengeBytes()

> **hashHexToChallengeBytes**(`hashHex`): `Uint8Array`

Defined in: [src/lib/aa/passkeyUserOp.ts:255](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L255)

Convenience helper: convert a 0x-prefixed bytes32 hash to a Uint8Array
usable as a WebAuthn challenge.

#### Parameters

##### hashHex

`` `0x${string}` ``

#### Returns

`Uint8Array`

***

### parseDerEcdsaSignature()

> **parseDerEcdsaSignature**(`der`): `object`

Defined in: [src/lib/aa/passkeyUserOp.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/passkeyUserOp.ts#L76)

Decode a DER-encoded ECDSA signature (as produced by WebAuthn) into r/s
components. The result is normalized to low-S form so that the
Coinbase Smart Wallet's WebAuthn verifier accepts it (P-256 verifiers
commonly enforce low-S to prevent signature malleability).

#### Parameters

##### der

`Uint8Array`

#### Returns

`object`

##### r

> **r**: `bigint`

##### s

> **s**: `bigint`
