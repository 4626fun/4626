/**
 * Unit tests for the operator restore script's pure helpers.
 *
 * The script lives at frontend/scripts/alfaclub-restore-tokens.mjs. We import
 * the `_testables` export (the script self-detects whether it is invoked as
 * the entrypoint and only runs main() in that case, so importing it is
 * side-effect-free for these tests).
 */
import { describe, expect, it } from 'vitest'

// @ts-expect-error -- .mjs script with no .d.ts; imported only for unit tests
import { _testables } from '../../../scripts/alfaclub-restore-tokens.mjs'

const { redact, isJwtShape, decodeJwtExp, validateTripletJson, describeJwt } = _testables as {
  redact: (input: string) => string
  isJwtShape: (value: string) => boolean
  decodeJwtExp: (jwt: string) => number | null
  validateTripletJson: (
    raw: string,
    opts?: { now?: () => number },
  ) =>
    | { ok: true; triplet: { identityToken: string; accessToken: string; refreshToken: string }; expiry: { identityExpMs: number; accessExpMs: number } }
    | { ok: false; error: string }
  describeJwt: (jwt: string) => string
}

function jwtWithExp(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url')
  // Signature segment must be ≥ 8 chars to match the redactor's JWT regex.
  return `${header}.${payload}.signature_segment_xxxxx`
}

describe('restore script — redact()', () => {
  it('strips JWT-shaped substrings', () => {
    const jwt = jwtWithExp(1_900_000_000)
    const out = redact(`identity=${jwt} done`)
    expect(out).not.toContain(jwt)
    expect(out).toContain('<redacted-jwt>')
  })

  it('strips Bearer headers', () => {
    const out = redact('Authorization: Bearer ABCDEF1234567890ABCDEF1234567890')
    expect(out).toContain('Bearer <redacted>')
    expect(out).not.toContain('ABCDEF1234567890ABCDEF1234567890')
  })

  it('strips long opaque base64url runs', () => {
    const opaque = 'X'.repeat(60)
    const out = redact(`refresh=${opaque}`)
    expect(out).not.toContain(opaque)
    expect(out).toContain('<redacted-opaque>')
  })

  it('passes short non-token strings through', () => {
    expect(redact('OK')).toBe('OK')
  })
})

describe('restore script — isJwtShape() / decodeJwtExp()', () => {
  it('accepts a 3-segment JWT', () => {
    const jwt = jwtWithExp(1_900_000_000)
    expect(isJwtShape(jwt)).toBe(true)
    expect(decodeJwtExp(jwt)).toBe(1_900_000_000)
  })

  it('rejects 2-segment strings', () => {
    expect(isJwtShape('header.payload')).toBe(false)
  })

  it('rejects 4-segment strings', () => {
    expect(isJwtShape('a.b.c.d')).toBe(false)
  })

  it('returns null exp on garbage payload', () => {
    expect(decodeJwtExp('header.PAYLOAD.sig')).toBeNull()
  })
})

describe('restore script — validateTripletJson()', () => {
  // 2026-05-01T12:00:00Z (well in the future relative to test machine clock).
  const FROZEN_NOW = 1_777_809_600_000
  const future = Math.floor(FROZEN_NOW / 1000) + 60 * 60
  const expired = Math.floor(FROZEN_NOW / 1000) - 60

  function buildBody(extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
      identity_token: jwtWithExp(future),
      privy_access_token: jwtWithExp(future),
      refresh_token: 'a'.repeat(40), // opaque base64url-ish
      ...extra,
    })
  }

  it('parses a well-formed triplet', () => {
    const result = validateTripletJson(buildBody(), { now: () => FROZEN_NOW })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.triplet.refreshToken).toHaveLength(40)
      expect(result.expiry.identityExpMs).toBe(future * 1000)
    }
  })

  it('falls back to top-level token when identity_token is absent', () => {
    const body = JSON.stringify({
      token: jwtWithExp(future),
      privy_access_token: jwtWithExp(future),
      refresh_token: 'a'.repeat(40),
    })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(true)
  })

  it('rejects malformed JSON', () => {
    const result = validateTripletJson('{ not json', { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/i)
  })

  it('rejects missing fields', () => {
    const body = JSON.stringify({ identity_token: jwtWithExp(future) })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/missing privy_access_token/i)
  })

  it('rejects non-JWT identity_token', () => {
    const body = JSON.stringify({
      identity_token: 'not.a',
      privy_access_token: jwtWithExp(future),
      refresh_token: 'a'.repeat(40),
    })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/identity_token is not a JWT/i)
  })

  it('rejects refresh_token that is too short', () => {
    const body = JSON.stringify({
      identity_token: jwtWithExp(future),
      privy_access_token: jwtWithExp(future),
      refresh_token: 'short',
    })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/refresh_token does not look like an opaque/i)
  })

  it('rejects refresh_token with disallowed characters', () => {
    const body = JSON.stringify({
      identity_token: jwtWithExp(future),
      privy_access_token: jwtWithExp(future),
      refresh_token: 'a a a a a a a a a a a a a a a a a a',
    })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
  })

  it('rejects an already-expired identity_token', () => {
    const body = JSON.stringify({
      identity_token: jwtWithExp(expired),
      privy_access_token: jwtWithExp(future),
      refresh_token: 'a'.repeat(40),
    })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/identity_token is already expired/i)
  })

  it('rejects an already-expired access token', () => {
    const body = JSON.stringify({
      identity_token: jwtWithExp(future),
      privy_access_token: jwtWithExp(expired),
      refresh_token: 'a'.repeat(40),
    })
    const result = validateTripletJson(body, { now: () => FROZEN_NOW })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/privy_access_token is already expired/i)
  })
})

describe('restore script — describeJwt()', () => {
  it('never echoes the JWT itself', () => {
    const jwt = jwtWithExp(1_900_000_000)
    const desc = describeJwt(jwt)
    expect(desc).not.toContain(jwt)
    expect(desc).toContain('exp=')
    expect(desc).toContain('len=')
  })
})
