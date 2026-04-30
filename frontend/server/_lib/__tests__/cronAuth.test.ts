// PR 5b — Shared cron-auth helper tests.
//
// `cronAuth.ts` was extracted from `_amoeRetryCron.ts` so the publish
// cron (PR 5b) and the retry cron (PR 4) share one auth surface. This
// test file pins the contract that extraction must preserve:
//
//   1. `readCronSecret()` returns null when both env candidates are
//      unset / under-length, and prefers `CRON_SECRET` over
//      `AMOE_CRON_SECRET`.
//   2. `isAuthorizedCron()` accepts both `Bearer <secret>` and a bare
//      secret in the Authorization header.
//   3. Wrong-length header is rejected (cheap pre-check).
//   4. Equal-length-different-content is rejected.
//   5. Empty / missing header is rejected.
//   6. Below-minimum-length env secret is treated as unset.

import type { VercelRequest } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isAuthorizedCron, readCronSecret } from '../lottery/cronAuth.js'

const SAMPLE_SECRET = 'a'.repeat(32) // 32 chars, well above 16-min

function makeReq(authHeader?: string): VercelRequest {
  return {
    headers: authHeader === undefined ? {} : { authorization: authHeader },
  } as unknown as VercelRequest
}

describe('cronAuth', () => {
  const original = {
    CRON_SECRET: process.env.CRON_SECRET,
    AMOE_CRON_SECRET: process.env.AMOE_CRON_SECRET,
  }

  beforeEach(() => {
    delete process.env.CRON_SECRET
    delete process.env.AMOE_CRON_SECRET
  })

  afterEach(() => {
    process.env.CRON_SECRET = original.CRON_SECRET
    process.env.AMOE_CRON_SECRET = original.AMOE_CRON_SECRET
  })

  describe('readCronSecret', () => {
    it('returns null when nothing is configured', () => {
      expect(readCronSecret()).toBeNull()
    })

    it('returns null when secret is under the 16-char minimum', () => {
      process.env.CRON_SECRET = 'short' // 5 chars
      expect(readCronSecret()).toBeNull()
    })

    it('reads CRON_SECRET when it is long enough', () => {
      process.env.CRON_SECRET = SAMPLE_SECRET
      expect(readCronSecret()).toBe(SAMPLE_SECRET)
    })

    it('falls through to AMOE_CRON_SECRET when CRON_SECRET is unset', () => {
      process.env.AMOE_CRON_SECRET = SAMPLE_SECRET
      expect(readCronSecret()).toBe(SAMPLE_SECRET)
    })

    it('prefers CRON_SECRET over AMOE_CRON_SECRET when both are set', () => {
      process.env.CRON_SECRET = SAMPLE_SECRET
      process.env.AMOE_CRON_SECRET = 'b'.repeat(32)
      expect(readCronSecret()).toBe(SAMPLE_SECRET)
    })

    it('trims whitespace from configured secrets', () => {
      process.env.CRON_SECRET = `  ${SAMPLE_SECRET}  `
      expect(readCronSecret()).toBe(SAMPLE_SECRET)
    })
  })

  describe('isAuthorizedCron', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = SAMPLE_SECRET
    })

    it('accepts Bearer-prefixed header (Vercel format)', () => {
      expect(isAuthorizedCron(makeReq(`Bearer ${SAMPLE_SECRET}`))).toBe(true)
    })

    it('accepts bare secret (manual curl format)', () => {
      expect(isAuthorizedCron(makeReq(SAMPLE_SECRET))).toBe(true)
    })

    it('rejects when secret is unset', () => {
      delete process.env.CRON_SECRET
      expect(isAuthorizedCron(makeReq(`Bearer ${SAMPLE_SECRET}`))).toBe(false)
    })

    it('rejects missing header', () => {
      expect(isAuthorizedCron(makeReq(undefined))).toBe(false)
    })

    it('rejects empty header', () => {
      expect(isAuthorizedCron(makeReq(''))).toBe(false)
    })

    it('rejects wrong-length secret', () => {
      expect(isAuthorizedCron(makeReq(`Bearer ${SAMPLE_SECRET}x`))).toBe(false)
      expect(
        isAuthorizedCron(makeReq(`Bearer ${SAMPLE_SECRET.slice(0, -1)}`)),
      ).toBe(false)
    })

    it('rejects equal-length but different content', () => {
      const wrong = 'b'.repeat(32)
      expect(isAuthorizedCron(makeReq(`Bearer ${wrong}`))).toBe(false)
    })

    it('rejects single-char tampering at any position', () => {
      // Sentinel for the constant-time-ish compare: tweaking any byte
      // anywhere in the secret must fail. We don't aim for true
      // cryptographic constant-time (V8 strings can't promise that)
      // but we DO require correctness across all byte positions.
      for (const pos of [0, 7, 15, 16, 31]) {
        const tampered =
          SAMPLE_SECRET.slice(0, pos) + 'b' + SAMPLE_SECRET.slice(pos + 1)
        expect(isAuthorizedCron(makeReq(`Bearer ${tampered}`))).toBe(false)
      }
    })
  })
})
