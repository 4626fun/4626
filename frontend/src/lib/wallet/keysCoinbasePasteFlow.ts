/**
 * keysCoinbasePasteFlow.ts
 *
 * The "paste at keys.coinbase.com" passkey-signing workaround for owner
 * mutations on Coinbase Smart Wallet (CSW).
 *
 * Why this exists (2026-05-12, 4 AM):
 *
 * The May 5 + Sep 3 working owner mutations on our canonical CSW were both
 * UserOps signed via the on-device passkey (WebAuthn) wrapped at
 * `ownerIndex = 0`. Coinbase Wallet's own SDK produces those internally when
 * Base App's UI initiates an owner-management flow. But for arbitrary dapps,
 * there is NO public RPC method that asks Base App to produce a WebAuthn
 * signature over an arbitrary userOpHash:
 *
 *   - `personal_sign` returns a 65-byte ECDSA wrapped at the session-key
 *     ownerIndex (currently broken/drifted on our wallet).
 *   - `eth_signTypedData_v4` returns an ERC-1271-wrapped sig that's path-
 *     incompatible with `_isValidSignature(userOpHash, ...)` (it uses
 *     `replaySafeHash`).
 *   - `wallet_sendCalls` builds its own UserOp internally and won't honor
 *     the `executeWithoutChainIdValidation` + replayable-nonce shape we
 *     need; instead it produces an `executeBatch` UserOp whose simulation
 *     reverts with `Unauthorized()` because Base App's pre-flight simulator
 *     doesn't model the ERC-4337 msg.sender semantics correctly.
 *
 * The workaround pioneered by stephancill/coinbase-smart-wallet-rescue:
 * the WebAuthn relying party for the passkey is `keys.coinbase.com`, so the
 * browser console at that origin has direct access to the passkey via
 * `navigator.credentials.get()`. The user pastes a small JS snippet there,
 * authenticates with the passkey, and pastes the WebAuthn response back to
 * the dapp. The dapp wraps that into a `SignatureWrapper{ ownerIndex: 0, ... }`
 * and submits the signed UserOp.
 *
 * This module provides:
 *   - generateKeysCoinbasePasteSnippet(): produces the JS to paste
 *   - parseKeysCoinbasePasteResponse(): validates the pasted JSON
 *   - buildWebAuthnSignatureWrapper(): produces the SignatureWrapper bytes
 *     that CoinbaseSmartWallet._isValidSignature() accepts
 */

import { encodeAbiParameters, type Hex } from 'viem'

/**
 * The response shape returned by the JS snippet running at keys.coinbase.com.
 * All hex fields are 0x-prefixed.
 */
export type KeysCoinbasePasteResponse = {
  /** WebAuthn authenticatorData bytes (variable length, typically 37+ bytes). */
  authenticatorData: Hex
  /**
   * UTF-8 JSON string of the WebAuthn client data. Must contain
   * `"type":"webauthn.get"` and a `challenge` field equal to the base64url
   * encoding of our userOpHash.
   */
  clientDataJSON: string
  /**
   * The raw DER-encoded ECDSA signature from the authenticator. We'll parse
   * (r, s) from this DER and re-encode as the WebAuthnAuth struct.
   */
  signature: Hex
}

const COINBASE_SMART_WALLET_RPID = 'keys.coinbase.com'

/**
 * Generate the JavaScript snippet to paste into the browser console at
 * keys.coinbase.com to obtain a passkey signature over the given userOpHash.
 *
 * The user must:
 *   1. Open https://keys.coinbase.com/settings (signed in with the wallet's
 *      passkey).
 *   2. Open browser DevTools console (F12 / Cmd-Option-I).
 *   3. Paste the returned snippet and press Enter.
 *   4. Authenticate with the passkey when prompted (Face ID, fingerprint, etc.).
 *   5. Copy the JSON line the snippet prints and paste it back to our page.
 */
export function generateKeysCoinbasePasteSnippet(userOpHash: Hex): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(userOpHash)) {
    throw new Error(`Expected a 0x-prefixed 32-byte hash, got: ${userOpHash}`)
  }
  // Strip 0x and pre-compute the challenge array literal so the snippet has
  // no runtime parsing surprises across browsers.
  const hashHex = userOpHash.slice(2)
  const challengeBytes: number[] = []
  for (let i = 0; i < hashHex.length; i += 2) {
    challengeBytes.push(parseInt(hashHex.slice(i, i + 2), 16))
  }
  return `(async () => {
  const challenge = new Uint8Array(${JSON.stringify(challengeBytes)});
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: ${JSON.stringify(COINBASE_SMART_WALLET_RPID)},
      userVerification: "preferred",
      allowCredentials: []
    }
  });
  const r = credential.response;
  const toHex = (buf) => "0x" + Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const out = {
    authenticatorData: toHex(r.authenticatorData),
    clientDataJSON: new TextDecoder().decode(r.clientDataJSON),
    signature: toHex(r.signature)
  };
  console.log("=== COPY THIS ENTIRE JSON LINE BACK TO THE DAPP ===");
  console.log(JSON.stringify(out));
  return out;
})();`
}

/**
 * Validate a pasted JSON string from keys.coinbase.com and return a typed
 * KeysCoinbasePasteResponse. Throws with a helpful message if any field is
 * malformed.
 */
export function parseKeysCoinbasePasteResponse(
  rawJson: string,
): KeysCoinbasePasteResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson.trim())
  } catch (err) {
    throw new Error(
      `Could not parse pasted text as JSON. Expected the line printed by the snippet at keys.coinbase.com (a single line starting with { and ending with }). Parser error: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Pasted JSON must be an object with authenticatorData, clientDataJSON, and signature fields.')
  }
  const obj = parsed as Record<string, unknown>
  const authData = obj.authenticatorData
  const clientData = obj.clientDataJSON
  const sig = obj.signature
  if (typeof authData !== 'string' || !/^0x[0-9a-fA-F]+$/.test(authData)) {
    throw new Error('Pasted JSON is missing or has invalid `authenticatorData` (expected 0x-prefixed hex string).')
  }
  if (typeof clientData !== 'string' || !clientData.includes('"webauthn.get"')) {
    throw new Error('Pasted JSON is missing or has invalid `clientDataJSON` (expected the WebAuthn clientDataJSON string containing "webauthn.get").')
  }
  if (typeof sig !== 'string' || !/^0x[0-9a-fA-F]+$/.test(sig)) {
    throw new Error('Pasted JSON is missing or has invalid `signature` (expected 0x-prefixed hex string of DER-encoded ECDSA signature).')
  }
  return {
    authenticatorData: authData as Hex,
    clientDataJSON: clientData,
    signature: sig as Hex,
  }
}

/**
 * Parse a DER-encoded ECDSA signature into its (r, s) components.
 *
 * DER format: 0x30 [total length] 0x02 [r length] [r bytes] 0x02 [s length] [s bytes]
 *
 * WebAuthn returns the signature in DER format; CoinbaseSmartWallet's
 * WebAuthnSol library expects (r, s) as uint256s. We also normalize s to be
 * in the low half of the curve order (s <= N/2), per RFC 6979 / BIP-62, since
 * many WebAuthn authenticators emit high-s signatures but the verifier
 * may reject those.
 */
export function parseDerEcdsaSignature(der: Hex): { r: bigint; s: bigint } {
  const bytes = hexToBytes(der)
  if (bytes.length < 8 || bytes[0] !== 0x30) {
    throw new Error('Signature is not DER-encoded (missing 0x30 SEQUENCE tag).')
  }
  // bytes[1] is the total length (or 0x81 + length-byte for long form), we
  // can skip strict checking and rely on the inner INTEGER markers.
  let offset = 2
  if (bytes[1] === 0x81) offset = 3 // long-form length, single length byte
  if (bytes[offset] !== 0x02) {
    throw new Error('Signature DER: expected INTEGER tag for r component.')
  }
  const rLen = bytes[offset + 1] ?? 0
  if (rLen === 0) throw new Error('Signature DER: r component is empty.')
  const rStart = offset + 2
  const rBytes = bytes.slice(rStart, rStart + rLen)
  offset = rStart + rLen
  if (bytes[offset] !== 0x02) {
    throw new Error('Signature DER: expected INTEGER tag for s component.')
  }
  const sLen = bytes[offset + 1] ?? 0
  if (sLen === 0) throw new Error('Signature DER: s component is empty.')
  const sStart = offset + 2
  const sBytes = bytes.slice(sStart, sStart + sLen)

  const r = bytesToBigInt(rBytes)
  let s = bytesToBigInt(sBytes)

  // secp256r1 curve order N. Normalize high-s to low-s.
  const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n
  if (s > N / 2n) s = N - s

  return { r, s }
}

function hexToBytes(hex: Hex): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b)
  }
  return n
}

/**
 * Locate the two integer offsets that CoinbaseSmartWallet's WebAuthnSol
 * verifier needs inside the clientDataJSON:
 *
 *   - challengeIndex: byte index of the `"challenge":"..."` field
 *   - typeIndex:      byte index of the `"type":"webauthn.get"` field
 *
 * The verifier slices these out and re-verifies the challenge against the
 * expected userOpHash to prevent challenge-reuse attacks.
 */
function findClientDataFieldOffsets(clientDataJSON: string): {
  challengeIndex: number
  typeIndex: number
} {
  const challengeIndex = clientDataJSON.indexOf('"challenge":')
  if (challengeIndex < 0) {
    throw new Error('clientDataJSON is missing the "challenge" field.')
  }
  const typeIndex = clientDataJSON.indexOf('"type":')
  if (typeIndex < 0) {
    throw new Error('clientDataJSON is missing the "type" field.')
  }
  return { challengeIndex, typeIndex }
}

/**
 * Build the CoinbaseSmartWallet SignatureWrapper bytes for a WebAuthn passkey
 * signature wrapped at owner index 0.
 *
 * Layout (per CoinbaseSmartWallet.sol):
 *   SignatureWrapper { uint256 ownerIndex; bytes signatureData; }
 * where signatureData is ABI-encoded WebAuthnAuth:
 *   WebAuthnAuth {
 *     bytes  authenticatorData;
 *     string clientDataJSON;
 *     uint256 challengeIndex;
 *     uint256 typeIndex;
 *     uint256 r;
 *     uint256 s;
 *   }
 */
export function buildWebAuthnSignatureWrapper(
  response: KeysCoinbasePasteResponse,
  ownerIndex: number = 0,
): Hex {
  const { r, s } = parseDerEcdsaSignature(response.signature)
  const { challengeIndex, typeIndex } = findClientDataFieldOffsets(
    response.clientDataJSON,
  )

  // ABI-encode the WebAuthnAuth struct.
  const webAuthnAuthEncoded = encodeAbiParameters(
    [
      {
        name: 'auth',
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
    ],
    [
      {
        authenticatorData: response.authenticatorData,
        clientDataJSON: response.clientDataJSON,
        challengeIndex: BigInt(challengeIndex),
        typeIndex: BigInt(typeIndex),
        r,
        s,
      },
    ],
  )

  // Wrap in SignatureWrapper(ownerIndex, signatureData).
  const wrapper = encodeAbiParameters(
    [
      {
        name: 'sigWrapper',
        type: 'tuple',
        components: [
          { name: 'ownerIndex', type: 'uint256' },
          { name: 'signatureData', type: 'bytes' },
        ],
      },
    ],
    [
      {
        ownerIndex: BigInt(ownerIndex),
        signatureData: webAuthnAuthEncoded,
      },
    ],
  )
  return wrapper
}

/**
 * Sanity-check: confirm the pasted response's challenge equals our
 * expected userOpHash. Returns null if it matches, or a human-readable
 * error string if not.
 */
export function verifyChallengeMatchesHash(
  response: KeysCoinbasePasteResponse,
  expectedUserOpHash: Hex,
): string | null {
  // The WebAuthn challenge in clientDataJSON is base64url-encoded.
  const match = response.clientDataJSON.match(/"challenge":\s*"([^"]+)"/)
  if (!match || !match[1]) {
    return 'clientDataJSON did not contain a parseable "challenge" field.'
  }
  const challengeB64Url: string = match[1]
  let actualHashBytes: Uint8Array
  try {
    actualHashBytes = base64UrlDecode(challengeB64Url)
  } catch (err) {
    return `Could not base64url-decode the challenge field: ${
      err instanceof Error ? err.message : String(err)
    }`
  }
  const actualHashHex =
    '0x' +
    Array.from(actualHashBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  if (actualHashHex.toLowerCase() !== expectedUserOpHash.toLowerCase()) {
    return (
      `The passkey signed a different hash than expected. ` +
      `Expected ${expectedUserOpHash}, got ${actualHashHex}. ` +
      `Likely cause: the page reloaded and the userOpHash changed between when you generated the snippet and when you pasted the response. ` +
      `Regenerate the snippet and try again.`
    )
  }
  return null
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4)
  const standard = padded.replace(/-/g, '+').replace(/_/g, '/')
  if (typeof atob !== 'undefined') {
    const binary = atob(standard)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }
  // Node fallback (tests).
  const buf = Buffer.from(standard, 'base64')
  return new Uint8Array(buf)
}
