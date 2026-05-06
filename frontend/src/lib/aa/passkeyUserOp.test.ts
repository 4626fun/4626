import { describe, expect, it } from 'vitest'
import { decodeAbiParameters, encodeAbiParameters, hexToBytes } from 'viem'

import {
  P256_CURVE_ORDER,
  encodeSignatureWrapper,
  encodeWebAuthnAuthSignature,
  findClientDataJsonOffsets,
  parseDerEcdsaSignature,
} from './passkeyUserOp'

// Build a minimal DER-encoded ECDSA signature for testing:
//   SEQUENCE { INTEGER r, INTEGER s }
// rBytes / sBytes are big-endian, may be zero-padded by the DER spec when the
// high bit is set (so the value is unambiguously positive). For test fixtures
// we hand-pick values that don't have the high-bit-set issue, but we still
// pad to 32 bytes — the parser must accept that.
function bigintToBeBytes(value: bigint, length: number): Uint8Array {
  const out = new Uint8Array(length)
  let v = value
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function encodeDerInteger(bytes: Uint8Array): Uint8Array {
  // If the high bit is set, prefix with 0x00 so the integer is positive.
  let body = bytes
  const first = body[0] ?? 0
  if (body.length > 0 && (first & 0x80) !== 0) {
    const padded = new Uint8Array(body.length + 1)
    padded[0] = 0x00
    padded.set(body, 1)
    body = padded
  } else {
    // Strip leading zeros (DER minimal encoding) but keep at least one byte.
    let start = 0
    while (
      start < body.length - 1 &&
      (body[start] ?? 0) === 0x00 &&
      ((body[start + 1] ?? 0) & 0x80) === 0
    ) {
      start++
    }
    if (start > 0) body = body.slice(start)
  }
  const out = new Uint8Array(2 + body.length)
  out[0] = 0x02
  out[1] = body.length
  out.set(body, 2)
  return out
}

function encodeDerEcdsa(r: bigint, s: bigint): Uint8Array {
  const rDer = encodeDerInteger(bigintToBeBytes(r, 32))
  const sDer = encodeDerInteger(bigintToBeBytes(s, 32))
  const body = new Uint8Array(rDer.length + sDer.length)
  body.set(rDer, 0)
  body.set(sDer, rDer.length)
  const out = new Uint8Array(2 + body.length)
  out[0] = 0x30
  out[1] = body.length
  out.set(body, 2)
  return out
}

describe('parseDerEcdsaSignature', () => {
  it('decodes a known DER-encoded signature into the expected (r, s)', () => {
    const r = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn
    const s = 0x0011223344556677889900112233445566778899001122334455667788990011n
    const der = encodeDerEcdsa(r, s)
    const parsed = parseDerEcdsaSignature(der)
    expect(parsed.r).toBe(r)
    expect(parsed.s).toBe(s)
  })

  it('normalizes a high-S signature to low-S', () => {
    const r = 0x9999999999999999999999999999999999999999999999999999999999999999n
    // Pick s strictly greater than n/2.
    const halfOrder = P256_CURVE_ORDER >> 1n
    const sHigh = halfOrder + 5n
    const der = encodeDerEcdsa(r, sHigh)
    const parsed = parseDerEcdsaSignature(der)
    expect(parsed.r).toBe(r)
    // After normalization, s must be in low-S range.
    expect(parsed.s).toBeLessThanOrEqual(halfOrder)
    expect(parsed.s).toBe(P256_CURVE_ORDER - sHigh)
  })

  it('leaves a low-S signature unchanged', () => {
    const r = 0x42n
    const sLow = 0x1234n
    const der = encodeDerEcdsa(r, sLow)
    const parsed = parseDerEcdsaSignature(der)
    expect(parsed.s).toBe(sLow)
  })
})

describe('findClientDataJsonOffsets', () => {
  it('returns byte offsets pointing at the opening quotes of the "challenge" and "type" keys', () => {
    const json =
      '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}'
    const { challengeIndex, typeIndex } = findClientDataJsonOffsets(json)
    // typeIndex must mark the start of `"type":"webauthn.get"` (21 chars)
    expect(typeIndex).toBe(1n)
    expect(json.slice(Number(typeIndex), Number(typeIndex) + 21)).toBe('"type":"webauthn.get"')
    // challengeIndex must mark the start of `"challenge":"…"` substring
    expect(challengeIndex).toBe(23n)
    expect(json.slice(Number(challengeIndex), Number(challengeIndex) + 13)).toBe('"challenge":"')
  })

  it('throws if challenge or type is missing', () => {
    expect(() => findClientDataJsonOffsets('{"type":"webauthn.get"}')).toThrow(/challenge/)
    expect(() => findClientDataJsonOffsets('{"challenge":"abc"}')).toThrow(/type/)
  })
})

describe('encodeWebAuthnAuthSignature', () => {
  it('matches the fixture ABI shape used in onboardingWallet.test.ts', () => {
    const authenticatorData = hexToBytes(`0x${'ab'.repeat(37)}`)
    const clientDataJSON =
      '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}'
    const r = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn
    const s = 0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn

    const encoded = encodeWebAuthnAuthSignature({ authenticatorData, clientDataJSON, r, s })

    // Mirror the fixture's exact construction:
    const fixture = encodeAbiParameters(
      [
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
      ],
      [
        {
          authenticatorData: `0x${'ab'.repeat(37)}`,
          clientDataJSON,
          challengeIndex: 23n,
          typeIndex: 1n,
          r,
          s,
        },
      ],
    )
    expect(encoded).toBe(fixture)
  })
})

describe('encodeSignatureWrapper', () => {
  it('round-trips through abi.decode', () => {
    const inner = `0x${'ee'.repeat(96)}` as const
    const wrapped = encodeSignatureWrapper(0n, inner)
    const [ownerIndex, signatureData] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'bytes' }],
      wrapped,
    )
    expect(ownerIndex).toBe(0n)
    expect(signatureData).toBe(inner)
  })
})
