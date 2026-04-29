// PR 3 — `amoeIdentifiers` unit tests.
//
// Coverage:
//   1. `readAmoeSignupSalt` — accepts 64-hex (with/without 0x), rejects
//      malformed input. The salt-misconfigured failure must throw
//      `AmoeServerError('amoe_signup_salt_misconfigured')` so the
//      handler maps it to a 5xx (NOT a 4xx that would leak the
//      misconfig to the caller).
//   2. `bigintToBe32Bytes` — round-trip + edge cases (0, max, overflow,
//      negative).
//   3. `normaliseTwitterHandle` — case-insensitive + leading-@ strip,
//      so `@Wenakita` and `wenakita` collide as the same nullifier.
//   4. `deriveSignupIdHash` / `deriveTwitterCreditNullifier` /
//      `deriveSpendRefIdHash` — golden vectors with a fixed salt to
//      guard against algorithm drift, plus invariants (output is in
//      the canonical field domain, salt-sensitivity, salt-rotation
//      collisions).
//
// LOCKED INVARIANT enforcement:
//   * `signupIdHash` MUST be derived from `profiles.id` (bigint) — not
//     wallet, not `privy_user_id`. The golden vector here is the
//     deterministic SHA3-256 / keccak256 hash of
//     `bigintToBe32Bytes(profileId) ‖ salt`. If anyone changes the
//     binding (e.g. switches to the wallet) this test fails LOUDLY.

import { describe, expect, it } from 'vitest'
import { keccak256 } from 'viem'

import {
  AMOE_SIGNUP_SALT_LENGTH_BYTES,
  bigintToBe32Bytes,
  deriveSignupIdHash,
  deriveSpendRefIdHash,
  deriveTwitterCreditNullifier,
  normaliseTwitterHandle,
  readAmoeSignupSalt,
} from '../lottery/amoeIdentifiers.js'
import {
  AMOE_BN254_FIELD_MODULUS,
  AMOE_BYTES32_DOMAIN_MAX,
} from '../lottery/amoeWitness.js'
import { AmoeServerError } from '../lottery/lotteryAmoeErrors.js'

// ----------------------------------------------------------------------------
// Salt fixture
// ----------------------------------------------------------------------------
//
// Deterministic test salt — 32 bytes, all `0xab`. Pinned so the golden
// vectors below are reproducible. Real-world salts are random secrets
// supplied via `AMOE_SIGNUP_SALT` env at deploy time.
const FIXTURE_SALT_HEX = 'ab'.repeat(AMOE_SIGNUP_SALT_LENGTH_BYTES)
const FIXTURE_SALT = new Uint8Array(AMOE_SIGNUP_SALT_LENGTH_BYTES).fill(0xab)

const ALT_SALT = new Uint8Array(AMOE_SIGNUP_SALT_LENGTH_BYTES).fill(0xcd)

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function withSaltEnv<T>(saltHex: string | undefined, fn: () => T): T {
  const prior = process.env.AMOE_SIGNUP_SALT
  if (saltHex === undefined) {
    delete process.env.AMOE_SIGNUP_SALT
  } else {
    process.env.AMOE_SIGNUP_SALT = saltHex
  }
  try {
    return fn()
  } finally {
    if (prior === undefined) {
      delete process.env.AMOE_SIGNUP_SALT
    } else {
      process.env.AMOE_SIGNUP_SALT = prior
    }
  }
}

function be32ToBigint(buf: Uint8Array): bigint {
  let v = 0n
  for (let i = 0; i < buf.length; i += 1) {
    v = (v << 8n) | BigInt(buf[i] ?? 0)
  }
  return v
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function expectThrowsServerError(fn: () => unknown, message: string): void {
  let err: unknown = null
  try {
    fn()
  } catch (e) {
    err = e
  }
  expect(err).toBeInstanceOf(AmoeServerError)
  expect((err as Error).message).toBe(message)
}

// ----------------------------------------------------------------------------
// readAmoeSignupSalt
// ----------------------------------------------------------------------------

describe('readAmoeSignupSalt', () => {
  it('accepts a plain 64-char lower-hex string', () => {
    withSaltEnv(FIXTURE_SALT_HEX, () => {
      const salt = readAmoeSignupSalt()
      expect(salt.length).toBe(AMOE_SIGNUP_SALT_LENGTH_BYTES)
      expect(Array.from(salt)).toEqual(Array.from(FIXTURE_SALT))
    })
  })

  it('accepts a 0x-prefixed hex string', () => {
    withSaltEnv(`0x${FIXTURE_SALT_HEX}`, () => {
      const salt = readAmoeSignupSalt()
      expect(Array.from(salt)).toEqual(Array.from(FIXTURE_SALT))
    })
  })

  it('accepts mixed-case hex', () => {
    const mixed = 'Ab'.repeat(AMOE_SIGNUP_SALT_LENGTH_BYTES)
    withSaltEnv(mixed, () => {
      const salt = readAmoeSignupSalt()
      expect(Array.from(salt)).toEqual(Array.from(FIXTURE_SALT))
    })
  })

  it('throws amoe_signup_salt_misconfigured when env is unset', () => {
    withSaltEnv(undefined, () => {
      expectThrowsServerError(
        () => readAmoeSignupSalt(),
        'amoe_signup_salt_misconfigured',
      )
    })
  })

  it('throws amoe_signup_salt_misconfigured when env is empty/whitespace', () => {
    withSaltEnv('   ', () => {
      expectThrowsServerError(
        () => readAmoeSignupSalt(),
        'amoe_signup_salt_misconfigured',
      )
    })
  })

  it('throws on too-short salt (< 32 bytes)', () => {
    withSaltEnv('abcd', () => {
      expectThrowsServerError(
        () => readAmoeSignupSalt(),
        'amoe_signup_salt_misconfigured',
      )
    })
  })

  it('throws on too-long salt (> 32 bytes)', () => {
    withSaltEnv('ab'.repeat(33), () => {
      expectThrowsServerError(
        () => readAmoeSignupSalt(),
        'amoe_signup_salt_misconfigured',
      )
    })
  })

  it('throws on non-hex characters', () => {
    const notHex = 'gg'.repeat(AMOE_SIGNUP_SALT_LENGTH_BYTES)
    withSaltEnv(notHex, () => {
      expectThrowsServerError(
        () => readAmoeSignupSalt(),
        'amoe_signup_salt_misconfigured',
      )
    })
  })
})

// ----------------------------------------------------------------------------
// bigintToBe32Bytes
// ----------------------------------------------------------------------------

describe('bigintToBe32Bytes', () => {
  it('encodes 0n as 32 zero bytes', () => {
    const out = bigintToBe32Bytes(0n)
    expect(out.length).toBe(32)
    expect(Array.from(out).every((b) => b === 0)).toBe(true)
  })

  it('encodes 1n as 31 zero bytes followed by 0x01', () => {
    const out = bigintToBe32Bytes(1n)
    expect(out.length).toBe(32)
    for (let i = 0; i < 31; i += 1) expect(out[i]).toBe(0)
    expect(out[31]).toBe(1)
  })

  it('encodes a bigint round-trippably', () => {
    const v = 0x1234567890abcdef1234567890abcdefn
    const buf = bigintToBe32Bytes(v)
    expect(be32ToBigint(buf)).toBe(v)
  })

  it('encodes the maximum 256-bit value', () => {
    const max = AMOE_BYTES32_DOMAIN_MAX
    const buf = bigintToBe32Bytes(max)
    expect(buf.length).toBe(32)
    expect(Array.from(buf).every((b) => b === 0xff)).toBe(true)
  })

  it('throws on negative inputs', () => {
    expectThrowsServerError(
      () => bigintToBe32Bytes(-1n),
      'amoe_identifier_input_negative',
    )
  })

  it('throws on values larger than 2^256 - 1', () => {
    expectThrowsServerError(
      () => bigintToBe32Bytes(AMOE_BYTES32_DOMAIN_MAX + 1n),
      'amoe_identifier_input_overflow',
    )
  })
})

// ----------------------------------------------------------------------------
// normaliseTwitterHandle
// ----------------------------------------------------------------------------

describe('normaliseTwitterHandle', () => {
  it('lowercases the handle', () => {
    expect(normaliseTwitterHandle('Wenakita')).toBe('wenakita')
  })

  it('strips a leading @', () => {
    expect(normaliseTwitterHandle('@wenakita')).toBe('wenakita')
  })

  it('combines lowercase + @ stripping', () => {
    expect(normaliseTwitterHandle('@Wenakita')).toBe('wenakita')
  })

  it('trims surrounding whitespace', () => {
    expect(normaliseTwitterHandle('   @Wenakita  ')).toBe('wenakita')
  })

  it('returns empty string for empty input', () => {
    expect(normaliseTwitterHandle('')).toBe('')
    expect(normaliseTwitterHandle('   ')).toBe('')
  })

  it('only strips the FIRST leading @, not internal characters', () => {
    expect(normaliseTwitterHandle('@@wen')).toBe('@wen')
  })
})

// ----------------------------------------------------------------------------
// Golden-vector derivations
// ----------------------------------------------------------------------------
//
// Each derive function is `mod-Q (keccak256(serialised input ‖ salt))`.
// We compute the expected value with viem's keccak256 directly, mirroring
// the implementation. That isn't a tautology — it pins:
//
//   * The keccak input layout (utf8 vs be32 vs spend-ref-utf8).
//   * The order of concatenation (input first, salt second).
//   * The post-hash field reduction.
//
// If anyone reorders inputs (e.g. salt-first), this fails immediately.

function expectedKeccakField(serialised: Uint8Array, salt: Uint8Array): bigint {
  const digestHex = keccak256(concat(serialised, salt))
  const digest = hexToBytes(digestHex)
  return be32ToBigint(digest) % AMOE_BN254_FIELD_MODULUS
}

describe('deriveTwitterCreditNullifier', () => {
  it('matches the keccak-of-(utf8(handle) ‖ salt) golden vector', () => {
    const handle = 'wenakita'
    const expected = expectedKeccakField(
      new TextEncoder().encode(handle),
      FIXTURE_SALT,
    )
    const got = deriveTwitterCreditNullifier({
      twitterHandle: handle,
      salt: FIXTURE_SALT,
    })
    expect(got).toBe(expected)
  })

  it('is invariant under @-prefix and case differences', () => {
    const a = deriveTwitterCreditNullifier({
      twitterHandle: '@Wenakita',
      salt: FIXTURE_SALT,
    })
    const b = deriveTwitterCreditNullifier({
      twitterHandle: 'wenakita',
      salt: FIXTURE_SALT,
    })
    const c = deriveTwitterCreditNullifier({
      twitterHandle: '   wenakita   ',
      salt: FIXTURE_SALT,
    })
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('produces different nullifiers for different handles', () => {
    const a = deriveTwitterCreditNullifier({
      twitterHandle: 'alice',
      salt: FIXTURE_SALT,
    })
    const b = deriveTwitterCreditNullifier({
      twitterHandle: 'bob',
      salt: FIXTURE_SALT,
    })
    expect(a).not.toBe(b)
  })

  it('produces different nullifiers under salt rotation (collision-test)', () => {
    const a = deriveTwitterCreditNullifier({
      twitterHandle: 'wenakita',
      salt: FIXTURE_SALT,
    })
    const b = deriveTwitterCreditNullifier({
      twitterHandle: 'wenakita',
      salt: ALT_SALT,
    })
    expect(a).not.toBe(b)
  })

  it('output is a canonical field element (< Q)', () => {
    const got = deriveTwitterCreditNullifier({
      twitterHandle: 'wenakita',
      salt: FIXTURE_SALT,
    })
    expect(got).toBeGreaterThanOrEqual(0n)
    expect(got).toBeLessThan(AMOE_BN254_FIELD_MODULUS)
  })

  it('throws AmoeServerError with code amoe_twitter_handle_empty for empty handle', () => {
    let err: unknown = null
    try {
      deriveTwitterCreditNullifier({ twitterHandle: '', salt: FIXTURE_SALT })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_twitter_handle_empty')
  })

  it('throws on whitespace-only handle', () => {
    let err: unknown = null
    try {
      deriveTwitterCreditNullifier({ twitterHandle: '   ', salt: FIXTURE_SALT })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
  })
})

describe('deriveSignupIdHash', () => {
  it('matches the keccak-of-(be32(profileId) ‖ salt) golden vector — bound to profiles.id, NOT wallet', () => {
    const profileId = 12345n
    const serialized = new Uint8Array(32)
    // Manually serialize 12345 = 0x3039 as big-endian.
    serialized[30] = 0x30
    serialized[31] = 0x39
    const expected = expectedKeccakField(serialized, FIXTURE_SALT)
    const got = deriveSignupIdHash({ profileId, salt: FIXTURE_SALT })
    expect(got).toBe(expected)
  })

  it('treats number and bigint profileId identically', () => {
    const a = deriveSignupIdHash({ profileId: 42, salt: FIXTURE_SALT })
    const b = deriveSignupIdHash({ profileId: 42n, salt: FIXTURE_SALT })
    expect(a).toBe(b)
  })

  it('produces different hashes for different profile IDs', () => {
    const a = deriveSignupIdHash({ profileId: 1n, salt: FIXTURE_SALT })
    const b = deriveSignupIdHash({ profileId: 2n, salt: FIXTURE_SALT })
    expect(a).not.toBe(b)
  })

  it('produces different hashes under salt rotation', () => {
    const a = deriveSignupIdHash({ profileId: 42n, salt: FIXTURE_SALT })
    const b = deriveSignupIdHash({ profileId: 42n, salt: ALT_SALT })
    expect(a).not.toBe(b)
  })

  it('output is a canonical field element (< Q)', () => {
    const got = deriveSignupIdHash({ profileId: 7n, salt: FIXTURE_SALT })
    expect(got).toBeGreaterThanOrEqual(0n)
    expect(got).toBeLessThan(AMOE_BN254_FIELD_MODULUS)
  })

  it('throws on profileId === 0 (sentinel for unresolved)', () => {
    let err: unknown = null
    try {
      deriveSignupIdHash({ profileId: 0n, salt: FIXTURE_SALT })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_signup_id_invalid')
  })

  it('throws on negative profileId', () => {
    let err: unknown = null
    try {
      deriveSignupIdHash({ profileId: -1n, salt: FIXTURE_SALT })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_signup_id_invalid')
  })
})

describe('deriveSpendRefIdHash', () => {
  it('matches the keccak-of-(utf8(spendRefId) ‖ salt) golden vector', () => {
    const ref = 'idem-key-2026-04-29-aaaa'
    const expected = expectedKeccakField(
      new TextEncoder().encode(ref),
      FIXTURE_SALT,
    )
    const got = deriveSpendRefIdHash({ spendRefId: ref, salt: FIXTURE_SALT })
    expect(got).toBe(expected)
  })

  it('produces different hashes for different refs', () => {
    const a = deriveSpendRefIdHash({ spendRefId: 'a', salt: FIXTURE_SALT })
    const b = deriveSpendRefIdHash({ spendRefId: 'b', salt: FIXTURE_SALT })
    expect(a).not.toBe(b)
  })

  it('is case-sensitive (unlike Twitter handle)', () => {
    // spendRefId is an opaque external token — case sensitivity is
    // intentional here because the upstream points-burn ledger row
    // stores the exact token. Twitter handles get lowered; spend refs
    // do not.
    const a = deriveSpendRefIdHash({ spendRefId: 'AAA', salt: FIXTURE_SALT })
    const b = deriveSpendRefIdHash({ spendRefId: 'aaa', salt: FIXTURE_SALT })
    expect(a).not.toBe(b)
  })

  it('output is a canonical field element', () => {
    const got = deriveSpendRefIdHash({ spendRefId: 'x', salt: FIXTURE_SALT })
    expect(got).toBeGreaterThanOrEqual(0n)
    expect(got).toBeLessThan(AMOE_BN254_FIELD_MODULUS)
  })

  it('throws on empty spendRefId', () => {
    let err: unknown = null
    try {
      deriveSpendRefIdHash({ spendRefId: '', salt: FIXTURE_SALT })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_spend_ref_empty')
  })

  it('throws on whitespace-only spendRefId', () => {
    let err: unknown = null
    try {
      deriveSpendRefIdHash({ spendRefId: '   ', salt: FIXTURE_SALT })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
  })
})

// ----------------------------------------------------------------------------
// Cross-derivation independence
// ----------------------------------------------------------------------------

describe('cross-derivation independence', () => {
  it('the three derive functions are independent (different input domains)', () => {
    // Use the same string `'1'` across all three derivations. They MUST
    // produce different output values because the serialization domains
    // differ (utf8 vs be32 bigint vs utf8 with case-sensitive normaliser).
    const a = deriveTwitterCreditNullifier({
      twitterHandle: '1',
      salt: FIXTURE_SALT,
    })
    const b = deriveSignupIdHash({ profileId: 1n, salt: FIXTURE_SALT })
    const c = deriveSpendRefIdHash({ spendRefId: '1', salt: FIXTURE_SALT })
    // utf8('1') vs be32(1n) differ — so a !== b.
    expect(a).not.toBe(b)
    // utf8('1') is the same byte sequence under twitter and spendref,
    // but twitter goes through `normaliseTwitterHandle` (lowercases + trim).
    // For the digit '1' they happen to produce the same input bytes, so a === c.
    // Verify that property explicitly so future drift is caught.
    expect(a).toBe(c)
  })
})
