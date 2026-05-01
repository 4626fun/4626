/**
 * Unit tests for the operator restore script's pure helpers.
 *
 * The script lives at frontend/scripts/alfaclub-restore-tokens.mjs. We import
 * the `_testables` export (the script self-detects whether it is invoked as
 * the entrypoint and only runs main() in that case, so importing it is
 * side-effect-free for these tests).
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// @ts-expect-error -- .mjs script with no .d.ts; imported only for unit tests
import { _testables } from '../../../scripts/alfaclub-restore-tokens.mjs'

const {
  redact,
  isJwtShape,
  decodeJwtExp,
  validateTripletJson,
  describeJwt,
  parseArgs,
  deriveSiblingEndpoint,
} = _testables as {
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
  parseArgs: (argv: string[]) => {
    positional: string[]
    flags: Set<string>
    named: Map<string, string>
    help: boolean
  }
  deriveSiblingEndpoint: (adminEndpoint: string, sibling: string) => string
}

const SCRIPT_PATH = fileURLToPath(
  new URL('../../../scripts/alfaclub-restore-tokens.mjs', import.meta.url),
)

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

describe('restore script — parseArgs()', () => {
  it('treats -h as a help flag (alias of --help)', () => {
    const result = parseArgs(['-h'])
    expect(result.help).toBe(true)
    // -h must NOT leak into positional args; otherwise the CLI would
    // treat it as a missing-file path and exit with file-not-found.
    expect(result.positional).toEqual([])
  })

  it('treats -? as a help flag (alias of --help)', () => {
    const result = parseArgs(['-?'])
    expect(result.help).toBe(true)
    expect(result.positional).toEqual([])
  })

  it('treats --help as a help flag', () => {
    const result = parseArgs(['--help'])
    expect(result.help).toBe(true)
    expect(result.flags.has('--help')).toBe(true)
  })

  it('keeps positional args separate from short and long flags', () => {
    const result = parseArgs(['triplet.json', '-h'])
    expect(result.help).toBe(true)
    expect(result.positional).toEqual(['triplet.json'])
  })

  it('still routes other dash-prefixed args (--apply, --foo=bar)', () => {
    const result = parseArgs(['--apply', '--endpoint=https://x/api/v1/alfaclub/chat-token'])
    expect(result.flags.has('--apply')).toBe(true)
    expect(result.named.get('--endpoint')).toBe('https://x/api/v1/alfaclub/chat-token')
    expect(result.help).toBe(false)
  })
})

describe('restore script — deriveSiblingEndpoint()', () => {
  it('swaps /chat-token for the requested sibling', () => {
    const out = deriveSiblingEndpoint(
      'https://example.com/api/v1/alfaclub/chat-token',
      'chat-token-refresh',
    )
    expect(out).toBe('https://example.com/api/v1/alfaclub/chat-token-refresh')
  })

  it('handles a trailing slash on /chat-token/', () => {
    const out = deriveSiblingEndpoint(
      'https://example.com/api/v1/alfaclub/chat-token/',
      'chat-bridge-run',
    )
    expect(out).toBe('https://example.com/api/v1/alfaclub/chat-bridge-run')
  })

  it('returns "" when the admin endpoint does not end with /chat-token', () => {
    // Without this guard, a misconfigured ALFACLUB_ADMIN_ENDPOINT would
    // pass through unchanged and the script would POST cron payloads to
    // a completely different handler. Returning "" forces the upstream
    // guard to refuse the call (or require an explicit override).
    const out = deriveSiblingEndpoint(
      'https://example.com/api/v1/alfaclub/whatever',
      'chat-token-refresh',
    )
    expect(out).toBe('')
  })

  it('returns "" when admin endpoint is empty', () => {
    expect(deriveSiblingEndpoint('', 'chat-token-refresh')).toBe('')
  })

  it('does not match URLs where /chat-token is not the final segment', () => {
    expect(
      deriveSiblingEndpoint(
        'https://example.com/api/v1/alfaclub/chat-token-refresh',
        'chat-token-refresh',
      ),
    ).toBe('')
  })
})

describe('restore script — CLI guards (child-process integration)', () => {
  // This block spawns the actual script with `node`. It does not need
  // node_modules — the script has no runtime imports beyond node: builtins.
  // It also does not make any real network calls because the guards run
  // before fetch().

  function makeTripletFile(): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'alfaclub-restore-'))
    const future = Math.floor(Date.now() / 1000) + 60 * 60
    // Long opaque-shaped refresh token so the redactor strips it from any
    // accidental output even if the test fails.
    const triplet = {
      identity_token: makeJwt(future),
      privy_access_token: makeJwt(future),
      refresh_token: 'r'.repeat(48),
    }
    const file = path.join(dir, 'triplet.json')
    writeFileSync(file, JSON.stringify(triplet), 'utf8')
    return file
  }

  function makeJwt(expSeconds: number): string {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url')
    return `${header}.${payload}.signature_segment_xxxxx`
  }

  it('exits 0 and prints help on -h with no other args', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, '-h'], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/Usage:/)
    expect(result.stderr).toBe('')
  })

  it('exits non-zero when --call-cron-refresh is set without --apply', () => {
    const file = makeTripletFile()
    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, file, '--call-cron-refresh'],
      { encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    // The guard must fire BEFORE we read the triplet, so the input
    // summary header should not appear.
    expect(result.stdout).not.toMatch(/triplet restore — input summary/i)
    // Error message should be the one we added.
    expect(result.stderr).toMatch(/--call-cron-refresh \/ --call-bridge-run perform live mutations/)
    expect(result.stderr).toMatch(/require --apply/)
  })

  it('exits non-zero when --call-bridge-run is set without --apply', () => {
    const file = makeTripletFile()
    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, file, '--call-bridge-run'],
      { encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/require --apply/)
  })

  it('exits non-zero when both call flags are set without --apply', () => {
    const file = makeTripletFile()
    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, file, '--call-cron-refresh', '--call-bridge-run'],
      { encoding: 'utf8' },
    )
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/require --apply/)
  })

  it('completes pure dry-run (no --apply, no call flags) successfully', () => {
    const file = makeTripletFile()
    const result = spawnSync(process.execPath, [SCRIPT_PATH, file], { encoding: 'utf8' })
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/triplet restore — input summary/i)
    expect(result.stdout).toMatch(/mode\s*:\s*DRY-RUN/)
    expect(result.stdout).toMatch(/Done\./)
  })
})
