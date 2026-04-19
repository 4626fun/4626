import { describe, expect, it } from 'vitest'
import { getAddress, toHex, type Hex } from 'viem'

import {
  buildPaymentRequirements,
  parseXPaymentHeader,
  validateX402Authorization,
  X402_NETWORK,
  X402_SCHEME,
  X402_VERSION,
} from './x402'

const CREATOR = getAddress('0x1111111111111111111111111111111111111111')
const TREASURY = getAddress('0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3')
const USDC = getAddress('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
const NONCE = toHex(42, { size: 32 })
const SIG = ('0x' + 'aa'.repeat(65)) as Hex

function encodeHeader(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

describe('buildPaymentRequirements', () => {
  it('shapes a canonical 402 body with the expected fields', () => {
    const reqs = buildPaymentRequirements({
      payTo: TREASURY,
      maxAmountRequired: 100_000_000n,
      description: 'Activate X on Y',
      resource: '/api/creator/strategy/x402-activate',
    })
    expect(reqs.x402_version).toBe(X402_VERSION)
    expect(reqs.accepts).toHaveLength(1)
    expect(reqs.accepts[0].scheme).toBe(X402_SCHEME)
    expect(reqs.accepts[0].network).toBe(X402_NETWORK)
    expect(reqs.accepts[0].asset).toBe(USDC)
    expect(reqs.accepts[0].pay_to).toBe(TREASURY)
    expect(reqs.accepts[0].max_amount_required).toBe('100000000')
    expect(reqs.accepts[0].mime_type).toBe('application/json')
  })
})

describe('parseXPaymentHeader', () => {
  const validHeader = encodeHeader({
    scheme: X402_SCHEME,
    network: X402_NETWORK,
    x402_version: X402_VERSION,
    payload: {
      authorization: {
        from: CREATOR,
        to: TREASURY,
        value: '100000000',
        validAfter: '0',
        validBefore: '9999999999',
        nonce: NONCE,
      },
      signature: SIG,
    },
  })

  it('parses a well-formed header', () => {
    const res = parseXPaymentHeader(validHeader)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.payment.payload.authorization.value).toBe(100_000_000n)
    expect(res.payment.payload.authorization.nonce).toBe(NONCE)
    expect(res.payment.payload.signature).toBe(SIG)
  })

  it('rejects non-base64 garbage', () => {
    // "☺" isn't valid base64; Buffer.from.toString goes through some
    // partial recovery, so JSON parsing will fail — still rejects.
    const res = parseXPaymentHeader('not base64 at all!!')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(['x402_invalid_base64', 'x402_invalid_json', 'x402_not_object']).toContain(res.reason)
  })

  it('rejects the wrong scheme', () => {
    const bad = encodeHeader({
      scheme: 'other',
      network: X402_NETWORK,
      x402_version: X402_VERSION,
      payload: { authorization: {}, signature: SIG },
    })
    const res = parseXPaymentHeader(bad)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_unsupported_scheme')
  })

  it('rejects the wrong network', () => {
    const bad = encodeHeader({
      scheme: X402_SCHEME,
      network: 'ethereum',
      x402_version: X402_VERSION,
      payload: { authorization: {}, signature: SIG },
    })
    const res = parseXPaymentHeader(bad)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_unsupported_network')
  })

  it('rejects a malformed from address', () => {
    const bad = encodeHeader({
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      x402_version: X402_VERSION,
      payload: {
        authorization: {
          from: '0xnot-an-address',
          to: TREASURY,
          value: '100000000',
          validAfter: '0',
          validBefore: '9999999999',
          nonce: NONCE,
        },
        signature: SIG,
      },
    })
    const res = parseXPaymentHeader(bad)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_invalid_authorization_from')
  })

  it('rejects a missing nonce', () => {
    const bad = encodeHeader({
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      x402_version: X402_VERSION,
      payload: {
        authorization: {
          from: CREATOR,
          to: TREASURY,
          value: '100000000',
          validAfter: '0',
          validBefore: '9999999999',
          nonce: '0x1234',
        },
        signature: SIG,
      },
    })
    const res = parseXPaymentHeader(bad)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_invalid_nonce')
  })
})

describe('validateX402Authorization', () => {
  const nowSec = 1_780_000_000 // arbitrary; doesn't matter to tests
  function make(value: bigint, validAfter = 0n, validBefore = 9_999_999_999n) {
    return {
      scheme: X402_SCHEME,
      network: X402_NETWORK,
      x402_version: X402_VERSION,
      payload: {
        authorization: { from: CREATOR, to: TREASURY, value, validAfter, validBefore, nonce: NONCE },
        signature: SIG,
      },
    } as const
  }

  it('accepts a valid authorization', () => {
    const res = validateX402Authorization({
      payment: make(100_000_000n),
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      now: nowSec,
    })
    expect(res.ok).toBe(true)
  })

  it('rejects a from mismatch', () => {
    const res = validateX402Authorization({
      payment: make(100_000_000n),
      expectedFrom: getAddress('0x2222222222222222222222222222222222222222'),
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      now: nowSec,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_from_mismatch')
  })

  it('rejects a to mismatch', () => {
    const res = validateX402Authorization({
      payment: make(100_000_000n),
      expectedFrom: CREATOR,
      expectedTo: getAddress('0x2222222222222222222222222222222222222222'),
      minAmount: 100_000_000n,
      now: nowSec,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_to_mismatch')
  })

  it('rejects a value below the min', () => {
    const res = validateX402Authorization({
      payment: make(99_999_999n),
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      now: nowSec,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_value_below_minimum')
  })

  it('rejects an expired authorization', () => {
    const res = validateX402Authorization({
      payment: make(100_000_000n, 0n, BigInt(nowSec - 1)),
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      now: nowSec,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_expired')
  })

  it('rejects a not-yet-valid authorization', () => {
    const res = validateX402Authorization({
      payment: make(100_000_000n, BigInt(nowSec + 10_000), 9_999_999_999n),
      expectedFrom: CREATOR,
      expectedTo: TREASURY,
      minAmount: 100_000_000n,
      now: nowSec,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('x402_not_yet_valid')
  })
})
