// Classify a raw signature blob returned by a wallet into one of three shapes:
//
// - `secp256k1` (exactly 65 bytes, splits to r/s/v)
// - `webauthn`  (>256 bytes AND abi-decodes as a CSW WebAuthnAuth tuple)
// - `unknown`   (anything else, with a reason)
//
// The probe and the submitter both need this distinction: a passkey signature
// is routed by the bundler through CSW's `WebAuthn.verify`, NOT `ecrecover`,
// so any ecrecover-based diagnostic or pre-flight check is inapplicable on
// that path and would garbage out.

import { decodeAbiParameters } from 'viem'

export type SignatureShape =
  | {
      kind: 'secp256k1'
      r: `0x${string}`
      s: `0x${string}`
      v: number
    }
  | {
      kind: 'webauthn'
      authenticatorData: `0x${string}`
      clientDataJSON: string
      r: bigint
      s: bigint
      challengeIndex: number
      typeIndex: number
    }
  | { kind: 'unknown'; reason: string }

// Threshold for attempting WebAuthnAuth abi-decode. A real WebAuthnAuth tuple
// is always larger than this (authenticatorData alone is typically 37+ bytes,
// clientDataJSON adds 100+, plus six abi heads/offsets), so anything smaller
// can't be a passkey signature.
const WEBAUTHN_MIN_BYTES = 256

// CoinbaseSmartWallet WebAuthnAuth tuple components — must match the layout
// the bundler/contract decodes. See WebAuthn.sol in the smart-wallet repo:
//   struct WebAuthnAuth {
//     bytes authenticatorData;
//     string clientDataJSON;
//     uint256 challengeIndex;
//     uint256 typeIndex;
//     uint256 r;
//     uint256 s;
//   }
const WEBAUTHN_AUTH_COMPONENTS = [
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

function hexByteLength(value: string): number {
  if (typeof value !== 'string' || !value.startsWith('0x')) return 0
  return Math.max(0, (value.length - 2) / 2)
}

export function detectSignatureShape(raw: `0x${string}`): SignatureShape {
  if (typeof raw !== 'string' || !raw.startsWith('0x')) {
    return { kind: 'unknown', reason: 'not a hex string' }
  }
  const byteLength = hexByteLength(raw)
  if (byteLength === 65) {
    const r = (`0x${raw.slice(2, 66)}`) as `0x${string}`
    const s = (`0x${raw.slice(66, 130)}`) as `0x${string}`
    const v = parseInt(raw.slice(130, 132), 16)
    return { kind: 'secp256k1', r, s, v }
  }
  if (byteLength <= WEBAUTHN_MIN_BYTES) {
    return { kind: 'unknown', reason: `unexpected byte length ${byteLength}` }
  }
  try {
    const [decoded] = decodeAbiParameters(WEBAUTHN_AUTH_COMPONENTS, raw)
    const tuple = decoded as {
      authenticatorData: `0x${string}`
      clientDataJSON: string
      challengeIndex: bigint
      typeIndex: bigint
      r: bigint
      s: bigint
    }
    return {
      kind: 'webauthn',
      authenticatorData: tuple.authenticatorData,
      clientDataJSON: tuple.clientDataJSON,
      r: tuple.r,
      s: tuple.s,
      challengeIndex: Number(tuple.challengeIndex),
      typeIndex: Number(tuple.typeIndex),
    }
  } catch {
    return { kind: 'unknown', reason: 'abi decode failed' }
  }
}
