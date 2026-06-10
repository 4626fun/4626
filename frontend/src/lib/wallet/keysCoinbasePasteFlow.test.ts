import { describe, expect, it } from 'vitest'
import { decodeAbiParameters, type Hex } from 'viem'

import {
  buildWebAuthnSignatureWrapper,
  generateKeysCoinbasePasteSnippet,
  parseDerEcdsaSignature,
  parseKeysCoinbasePasteResponse,
  verifyChallengeMatchesHash,
} from './keysCoinbasePasteFlow'

const USER_OP_HASH =
  '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex

const SECP256R1_N =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n

/** Build a minimal DER ECDSA signature for the given r/s integers. */
function derEncode(r: bigint, s: bigint): Hex {
  const intBytes = (n: bigint): number[] => {
    let hex = n.toString(16)
    if (hex.length % 2 === 1) hex = `0${hex}`
    const bytes = hex.match(/.{2}/g)!.map((b) => parseInt(b, 16))
    // DER requires a leading zero when the high bit is set (positive integer).
    if (bytes[0] & 0x80) bytes.unshift(0)
    return bytes
  }
  const rB = intBytes(r)
  const sB = intBytes(s)
  const body = [0x02, rB.length, ...rB, 0x02, sB.length, ...sB]
  const all = [0x30, body.length, ...body]
  return `0x${all.map((b) => b.toString(16).padStart(2, '0')).join('')}` as Hex
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function clientDataFor(hash: Hex): string {
  const challenge = base64UrlEncode(Buffer.from(hash.slice(2), 'hex'))
  return JSON.stringify({
    type: 'webauthn.get',
    challenge,
    origin: 'https://keys.coinbase.com',
  })
}

function validPasteJson(): string {
  return JSON.stringify({
    authenticatorData: `0x${'ab'.repeat(37)}`,
    clientDataJSON: clientDataFor(USER_OP_HASH),
    signature: derEncode(1234567890n, 987654321n),
  })
}

describe('generateKeysCoinbasePasteSnippet', () => {
  it('requires user verification for owner-mutation signing', () => {
    const snippet = generateKeysCoinbasePasteSnippet(USER_OP_HASH)
    expect(snippet).toContain('userVerification: "required"')
    expect(snippet).not.toContain('"preferred"')
  })

  it('embeds the exact challenge bytes of the hash', () => {
    const snippet = generateKeysCoinbasePasteSnippet(USER_OP_HASH)
    expect(snippet).toContain(JSON.stringify(Array(32).fill(0x11)))
  })

  it('rejects non-32-byte hashes', () => {
    expect(() => generateKeysCoinbasePasteSnippet('0x1234' as Hex)).toThrow(/32-byte/)
  })
})

describe('parseKeysCoinbasePasteResponse', () => {
  it('accepts a well-formed response', () => {
    const parsed = parseKeysCoinbasePasteResponse(validPasteJson())
    expect(parsed.clientDataJSON).toContain('"webauthn.get"')
    expect(parsed.authenticatorData.startsWith('0x')).toBe(true)
  })

  it('rejects odd-length hex in signature (truncated paste)', () => {
    const obj = JSON.parse(validPasteJson())
    obj.signature = obj.signature.slice(0, obj.signature.length - 1)
    expect(() => parseKeysCoinbasePasteResponse(JSON.stringify(obj))).toThrow(
      /even number of hex digits/,
    )
  })

  it('rejects odd-length hex in authenticatorData', () => {
    const obj = JSON.parse(validPasteJson())
    obj.authenticatorData = `${obj.authenticatorData}a`
    expect(() => parseKeysCoinbasePasteResponse(JSON.stringify(obj))).toThrow(
      /even number of hex digits/,
    )
  })

  it('rejects clientDataJSON without webauthn.get', () => {
    const obj = JSON.parse(validPasteJson())
    obj.clientDataJSON = JSON.stringify({ type: 'webauthn.create' })
    expect(() => parseKeysCoinbasePasteResponse(JSON.stringify(obj))).toThrow(/webauthn\.get/)
  })

  it('rejects non-JSON input with a helpful message', () => {
    expect(() => parseKeysCoinbasePasteResponse('not json')).toThrow(/Could not parse/)
  })
})

describe('parseDerEcdsaSignature', () => {
  it('round-trips r and s from DER', () => {
    const { r, s } = parseDerEcdsaSignature(derEncode(1234567890n, 987654321n))
    expect(r).toBe(1234567890n)
    expect(s).toBe(987654321n)
  })

  it('normalizes high-s to low-s', () => {
    const highS = SECP256R1_N - 5n
    const { s } = parseDerEcdsaSignature(derEncode(42n, highS))
    expect(s).toBe(5n)
    expect(s <= SECP256R1_N / 2n).toBe(true)
  })

  it('rejects non-DER bytes', () => {
    expect(() => parseDerEcdsaSignature('0x1234567890abcdef' as Hex)).toThrow(/DER/)
  })
})

describe('verifyChallengeMatchesHash', () => {
  it('returns null when the challenge matches the hash', () => {
    const response = parseKeysCoinbasePasteResponse(validPasteJson())
    expect(verifyChallengeMatchesHash(response, USER_OP_HASH)).toBeNull()
  })

  it('returns an error message when the challenge is for a different hash', () => {
    const response = parseKeysCoinbasePasteResponse(validPasteJson())
    const otherHash =
      '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex
    const error = verifyChallengeMatchesHash(response, otherHash)
    expect(error).toMatch(/different hash/)
  })
})

describe('buildWebAuthnSignatureWrapper', () => {
  it('encodes SignatureWrapper with ownerIndex 0 and decodable WebAuthnAuth', () => {
    const response = parseKeysCoinbasePasteResponse(validPasteJson())
    const wrapper = buildWebAuthnSignatureWrapper(response, 0)
    const [decoded] = decodeAbiParameters(
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
      wrapper,
    ) as [{ ownerIndex: bigint; signatureData: Hex }]
    expect(decoded.ownerIndex).toBe(0n)
    const [auth] = decodeAbiParameters(
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
      decoded.signatureData,
    ) as [
      {
        authenticatorData: Hex
        clientDataJSON: string
        challengeIndex: bigint
        typeIndex: bigint
        r: bigint
        s: bigint
      },
    ]
    expect(auth.authenticatorData).toBe(response.authenticatorData)
    expect(auth.clientDataJSON).toBe(response.clientDataJSON)
    expect(auth.r).toBe(1234567890n)
    expect(auth.s).toBe(987654321n)
    // The verifier slices these offsets out of clientDataJSON.
    expect(
      response.clientDataJSON.slice(Number(auth.challengeIndex)).startsWith('"challenge":'),
    ).toBe(true)
    expect(response.clientDataJSON.slice(Number(auth.typeIndex)).startsWith('"type":')).toBe(true)
  })
})
