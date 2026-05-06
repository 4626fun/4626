import {
  bytesToHex,
  encodeAbiParameters,
  hexToBytes,
  type Hex,
} from 'viem'

/**
 * Canonical WebAuthn stub signature used for ERC-4337 gas estimation when
 * the signing owner is a passkey. CDP's bundler validates the *shape* of the
 * signature during eth_estimateUserOperationGas — it doesn't actually verify
 * the P256 sig, but it does require a well-formed SignatureWrapper around a
 * well-formed WebAuthnAuth tuple of plausible length. This is the exact value
 * used by viem's `toCoinbaseSmartAccount` for owner.type === 'webAuthn',
 * mirrored in coinbaseErc4337.ts. Extracted here so the passkey-direct UserOp
 * lane can reuse the same stub for estimation, then replace it with the real
 * passkey-signed wrapper for submission.
 */
export const WEBAUTHN_PASSKEY_STUB_SIGNATURE: Hex =
  '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000001949fc7c88032b9fcb5f6efc7a7b8c63668eae9871b765e23123bb473ff57aa831a7c0d9276168ebcc29f2875a0239cffdf2a9cd1c2007c5c77c071db9264df1d000000000000000000000000000000000000000000000000000000000000002549960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a2273496a396e6164474850596759334b7156384f7a4a666c726275504b474f716d59576f4d57516869467773222c226f726967696e223a2268747470733a2f2f7369676e2e636f696e626173652e636f6d222c2263726f73734f726967696e223a66616c73657d00000000000000000000000000000000000000000000'

/**
 * P-256 (secp256r1) curve order.
 * https://neuromancer.sk/std/secg/secp256r1
 */
export const P256_CURVE_ORDER =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

const P256_HALF_ORDER = P256_CURVE_ORDER >> 1n

const ASN1_SEQUENCE = 0x30
const ASN1_INTEGER = 0x02

function readDerInteger(
  der: Uint8Array,
  offset: number,
): { value: bigint; nextOffset: number } {
  const tag = der[offset]
  if (tag === undefined) {
    throw new Error(`DER parse: offset ${offset} out of range (length=${der.length})`)
  }
  if (tag !== ASN1_INTEGER) {
    throw new Error(
      `DER parse: expected INTEGER (0x02) at offset ${offset}, got 0x${tag.toString(16)}`,
    )
  }
  const length = der[offset + 1]
  if (length === undefined) {
    throw new Error('DER parse: missing INTEGER length byte')
  }
  if (length & 0x80) {
    throw new Error('DER parse: long-form INTEGER lengths are not supported for P-256 r/s')
  }
  const start = offset + 2
  const end = start + length
  if (end > der.length) {
    throw new Error(
      `DER parse: INTEGER length ${length} exceeds buffer (start=${start}, length=${der.length})`,
    )
  }
  let bigEndianHex = '0x'
  for (let i = start; i < end; i++) {
    const b = der[i] ?? 0
    bigEndianHex += b.toString(16).padStart(2, '0')
  }
  const value = bigEndianHex === '0x' ? 0n : BigInt(bigEndianHex)
  return { value, nextOffset: end }
}

/**
 * Decode a DER-encoded ECDSA signature (as produced by WebAuthn) into r/s
 * components. The result is normalized to low-S form so that the
 * Coinbase Smart Wallet's WebAuthn verifier accepts it (P-256 verifiers
 * commonly enforce low-S to prevent signature malleability).
 */
export function parseDerEcdsaSignature(der: Uint8Array): { r: bigint; s: bigint } {
  if (der.length < 8) {
    throw new Error(`DER parse: signature too short (${der.length} bytes)`)
  }
  const seqTag = der[0]
  if (seqTag !== ASN1_SEQUENCE) {
    throw new Error(
      `DER parse: expected SEQUENCE (0x30), got 0x${(seqTag ?? 0).toString(16)}`,
    )
  }
  const seqLen = der[1] ?? 0
  if (seqLen & 0x80) {
    throw new Error('DER parse: long-form SEQUENCE lengths are not supported for P-256 sigs')
  }
  if (2 + seqLen > der.length) {
    throw new Error('DER parse: SEQUENCE length exceeds buffer')
  }
  const { value: r, nextOffset: afterR } = readDerInteger(der, 2)
  const { value: sRaw } = readDerInteger(der, afterR)
  const s = sRaw > P256_HALF_ORDER ? P256_CURVE_ORDER - sRaw : sRaw
  return { r, s }
}

/**
 * Compute byte offsets of the `"challenge":"…"` and `"type":"…"` substrings
 * inside a serialized clientDataJSON string. The Coinbase Smart Wallet's
 * WebAuthn validator (WebAuthnSol) slices clientDataJSON starting at these
 * indices to verify the entries — typeIndex must point at the opening quote
 * of `"type"` (so the slice `[typeIndex, typeIndex+21)` equals
 * `"type":"webauthn.get"`), and challengeIndex must point at the opening
 * quote of `"challenge"` (so the slice begins with `"challenge":"`).
 *
 * The clientDataJSON the browser produces is ASCII; the byte offset equals
 * the character offset.
 */
export function findClientDataJsonOffsets(json: string): {
  challengeIndex: bigint
  typeIndex: bigint
} {
  const challengeMarker = '"challenge":"'
  const challengePos = json.indexOf(challengeMarker)
  if (challengePos < 0) {
    throw new Error('clientDataJSON does not contain a "challenge" field')
  }
  const typeMarker = '"type":"'
  const typePos = json.indexOf(typeMarker)
  if (typePos < 0) {
    throw new Error('clientDataJSON does not contain a "type" field')
  }
  return {
    challengeIndex: BigInt(challengePos),
    typeIndex: BigInt(typePos),
  }
}

const WEBAUTHN_AUTH_TUPLE = [
  {
    type: 'tuple',
    components: [
      { name: 'authenticatorData', type: 'bytes' },
      { name: 'clientDataJSON', type: 'string' },
      { name: 'challengeIndex', type: 'uint256' },
      { name: 'typeIndex', type: 'uint256' },
      { name: 'r', type: 'uint256' },
      { name: 's', type: 'uint256' },
    ],
  },
] as const

/**
 * abi.encode the Coinbase Smart Wallet `WebAuthnAuth` tuple.
 *
 * Computes `challengeIndex` / `typeIndex` from clientDataJSON. Caller may
 * pre-normalize r/s; this function does not re-apply low-S.
 */
export function encodeWebAuthnAuthSignature(args: {
  authenticatorData: Uint8Array
  clientDataJSON: string
  r: bigint
  s: bigint
}): Hex {
  const { challengeIndex, typeIndex } = findClientDataJsonOffsets(args.clientDataJSON)
  return encodeAbiParameters(WEBAUTHN_AUTH_TUPLE, [
    {
      authenticatorData: bytesToHex(args.authenticatorData),
      clientDataJSON: args.clientDataJSON,
      challengeIndex,
      typeIndex,
      r: args.r,
      s: args.s,
    },
  ]) as Hex
}

const SIGNATURE_WRAPPER_ABI = [
  { type: 'uint256' },
  { type: 'bytes' },
] as const

/**
 * abi.encode the CSW `SignatureWrapper(uint256 ownerIndex, bytes signatureData)`.
 */
export function encodeSignatureWrapper(ownerIndex: bigint, signatureData: Hex): Hex {
  return encodeAbiParameters(SIGNATURE_WRAPPER_ABI, [
    ownerIndex,
    signatureData,
  ]) as Hex
}

export type PasskeyAssertion = {
  authenticatorData: Uint8Array
  clientDataJSON: string
  signatureDer: Uint8Array
  credentialId: Uint8Array
}

function isPublicKeyCredential(value: unknown): value is PublicKeyCredential {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rawId' in (value as Record<string, unknown>) &&
    'response' in (value as Record<string, unknown>)
  )
}

/**
 * Request a same-origin WebAuthn assertion from the user's authenticator using
 * the provided 32-byte challenge. `allowCredentials: []` is intentional — the
 * OS picker handles credential selection.
 *
 * This cannot assert Coinbase Smart Wallet passkeys from 4626.fun: browser
 * WebAuthn only permits an RP ID that is the current origin's effective domain
 * or a registrable suffix. Coinbase-managed CSW credentials live in Coinbase's
 * RP context, so owner actions for those passkeys must be routed through the
 * wallet/Base App prepared-call context instead of direct `navigator.credentials`
 * calls from this app.
 *
 * Browser-only. Will throw if `navigator.credentials` is undefined.
 */
export async function getPasskeyAssertion(
  challenge: Uint8Array,
): Promise<PasskeyAssertion> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('getPasskeyAssertion: window/navigator unavailable (server-side?)')
  }
  const credentials = navigator.credentials
  if (!credentials || typeof credentials.get !== 'function') {
    throw new Error('getPasskeyAssertion: navigator.credentials.get is not available')
  }
  // Cast: lib.dom's `BufferSource` is invariant over ArrayBuffer vs SharedArrayBuffer
  // since TS 5.7; in practice WebAuthn accepts a normal Uint8Array view.
  const credential = await credentials.get({
    publicKey: {
      challenge: challenge as BufferSource,
      allowCredentials: [],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  if (!isPublicKeyCredential(credential)) {
    throw new Error('getPasskeyAssertion: navigator.credentials.get returned no credential')
  }
  const response = credential.response as AuthenticatorAssertionResponse
  if (!response || !response.authenticatorData || !response.clientDataJSON || !response.signature) {
    throw new Error('getPasskeyAssertion: assertion response missing required fields')
  }
  const decoder = new TextDecoder()
  return {
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: decoder.decode(new Uint8Array(response.clientDataJSON)),
    signatureDer: new Uint8Array(response.signature),
    credentialId: new Uint8Array(credential.rawId),
  }
}

/**
 * Convenience helper: convert a 0x-prefixed bytes32 hash to a Uint8Array
 * usable as a WebAuthn challenge.
 */
export function hashHexToChallengeBytes(hashHex: Hex): Uint8Array {
  return hexToBytes(hashHex)
}
