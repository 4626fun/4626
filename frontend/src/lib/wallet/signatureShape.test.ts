import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, toHex } from 'viem'

import { detectSignatureShape } from './signatureShape'

const WEBAUTHN_TUPLE_COMPONENTS = [
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

describe('detectSignatureShape', () => {
  it('classifies a 65-byte hex blob as secp256k1 with correct r/s/v split', () => {
    // r = 0xaa..aa (32 bytes), s = 0xbb..bb (32 bytes), v = 0x1c (28)
    const r = `0x${'aa'.repeat(32)}` as `0x${string}`
    const s = `0x${'bb'.repeat(32)}` as `0x${string}`
    const v = 0x1c
    const raw = `0x${'aa'.repeat(32)}${'bb'.repeat(32)}1c` as `0x${string}`

    const shape = detectSignatureShape(raw)
    expect(shape.kind).toBe('secp256k1')
    if (shape.kind === 'secp256k1') {
      expect(shape.r).toBe(r)
      expect(shape.s).toBe(s)
      expect(shape.v).toBe(v)
    }
  })

  it('classifies a hand-crafted abi-encoded WebAuthnAuth tuple as webauthn', () => {
    const authenticatorData = (`0x${'ab'.repeat(37)}`) as `0x${string}`
    const clientDataJSON =
      '{"type":"webauthn.get","challenge":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","origin":"https://keys.coinbase.com","crossOrigin":false}'
    const challengeIndex = 23n
    const typeIndex = 1n
    const r = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn
    const s = 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321n

    const encoded = encodeAbiParameters(WEBAUTHN_TUPLE_COMPONENTS, [
      {
        authenticatorData,
        clientDataJSON,
        challengeIndex,
        typeIndex,
        r,
        s,
      },
    ])

    const shape = detectSignatureShape(encoded)
    expect(shape.kind).toBe('webauthn')
    if (shape.kind === 'webauthn') {
      expect(shape.authenticatorData).toBe(authenticatorData)
      expect(shape.clientDataJSON).toBe(clientDataJSON)
      expect(shape.challengeIndex).toBe(23)
      expect(shape.typeIndex).toBe(1)
      expect(shape.r).toBe(r)
      expect(shape.s).toBe(s)
    }
  })

  it('returns unknown for empty hex', () => {
    const shape = detectSignatureShape('0x' as `0x${string}`)
    expect(shape.kind).toBe('unknown')
    if (shape.kind === 'unknown') {
      expect(shape.reason).toMatch(/byte length/i)
    }
  })

  it('returns unknown for a 64-byte blob (one byte short of secp256k1)', () => {
    const shape = detectSignatureShape((`0x${'cc'.repeat(64)}`) as `0x${string}`)
    expect(shape.kind).toBe('unknown')
    if (shape.kind === 'unknown') {
      expect(shape.reason).toMatch(/byte length 64/i)
    }
  })

  it('returns unknown for a 100-byte garbage blob (too small for webauthn, not 65)', () => {
    const shape = detectSignatureShape((`0x${'dd'.repeat(100)}`) as `0x${string}`)
    expect(shape.kind).toBe('unknown')
    if (shape.kind === 'unknown') {
      expect(shape.reason).toMatch(/byte length 100/i)
    }
  })

  it('returns unknown with "abi decode failed" for >256-byte non-WebAuthnAuth bytes', () => {
    // Garbage that is large enough to clear the WEBAUTHN_MIN_BYTES gate but
    // does not abi-decode as the WebAuthnAuth tuple — the offsets/lengths
    // baked into the bytes are nonsense.
    const shape = detectSignatureShape((`0x${'ee'.repeat(300)}`) as `0x${string}`)
    expect(shape.kind).toBe('unknown')
    if (shape.kind === 'unknown') {
      expect(shape.reason).toBe('abi decode failed')
    }
  })

  it('returns unknown for non-hex input', () => {
    const shape = detectSignatureShape('not-hex' as unknown as `0x${string}`)
    expect(shape.kind).toBe('unknown')
  })

  // Sanity check: hex helper is wired up correctly so we can build other tests
  // off it without surprises.
  it('toHex of a string is not classified as secp256k1', () => {
    const shape = detectSignatureShape(toHex('hello world') as `0x${string}`)
    expect(shape.kind).toBe('unknown')
  })
})
