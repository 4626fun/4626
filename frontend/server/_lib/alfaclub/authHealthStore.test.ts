import { describe, expect, it } from 'vitest'

import {
  buildRefreshFailurePayload,
  buildRefreshSuccessPayload,
  classifyRefreshError,
  evaluateDbEnvStaleness,
  evaluateWriterAnomaly,
  redactTokenMaterial,
} from './authHealthStore.js'

describe('evaluateWriterAnomaly', () => {
  it('accepts the canonical refresher writer', () => {
    const result = evaluateWriterAnomaly('privy-token-refresher')
    expect(result.isAnomalous).toBe(false)
    expect(result.reason).toBeNull()
    expect(result.writer).toBe('privy-token-refresher')
  })

  it('accepts admin.api and computer-token-restore', () => {
    expect(evaluateWriterAnomaly('admin.api').isAnomalous).toBe(false)
    expect(evaluateWriterAnomaly('computer-token-restore').isAnomalous).toBe(false)
    expect(evaluateWriterAnomaly('cron-token-bootstrap').isAnomalous).toBe(false)
  })

  it('accepts admin EVM-address writers (lowercase 0x + 40 hex)', () => {
    const addr = '0xabcdef0123456789abcdef0123456789abcdef01'
    const result = evaluateWriterAnomaly(addr)
    expect(result.isAnomalous).toBe(false)
    expect(result.writer).toBe(addr)
  })

  it('lowercases mixed-case admin addresses before classifying', () => {
    const addr = '0xABCDEF0123456789abcdef0123456789ABCDEF01'
    const result = evaluateWriterAnomaly(addr)
    expect(result.isAnomalous).toBe(false)
    expect(result.writer).toBe(addr.toLowerCase())
  })

  it('flags cursor-hermit-rotate (legacy in-process refresher) explicitly', () => {
    const result = evaluateWriterAnomaly('cursor-hermit-rotate')
    expect(result.isAnomalous).toBe(true)
    expect(result.reason).toBe('legacy_in_process_refresher')
  })

  it('flags an unknown freeform writer as unknown_writer', () => {
    const result = evaluateWriterAnomaly('railway-side-script')
    expect(result.isAnomalous).toBe(true)
    expect(result.reason).toBe('unknown_writer')
    expect(result.writer).toBe('railway-side-script')
  })

  it('flags empty / null / whitespace writers as empty_writer', () => {
    expect(evaluateWriterAnomaly('').reason).toBe('empty_writer')
    expect(evaluateWriterAnomaly('   ').reason).toBe('empty_writer')
    expect(evaluateWriterAnomaly(null).reason).toBe('empty_writer')
    expect(evaluateWriterAnomaly(undefined).reason).toBe('empty_writer')
  })
})

describe('evaluateDbEnvStaleness', () => {
  it('returns null when env and db expiries align', () => {
    const exp = '2026-05-01T14:00:00.000Z'
    expect(
      evaluateDbEnvStaleness({
        dbIdentityExpiresAt: exp,
        envIdentityJwt: makeJwtWithExp(exp),
        dbAccessExpiresAt: null,
        envAccessJwt: null,
      }),
    ).toBeNull()
  })

  it('warns when env identity JWT expires later than DB', () => {
    const warning = evaluateDbEnvStaleness({
      dbIdentityExpiresAt: '2026-05-01T12:00:00.000Z',
      envIdentityJwt: makeJwtWithExp('2026-05-01T15:00:00.000Z'),
      dbAccessExpiresAt: null,
      envAccessJwt: null,
      slackMs: 0,
    })
    expect(warning?.kind).toBe('db_lags_env')
    expect(warning?.identity?.envExpiresAt).toBe('2026-05-01T15:00:00.000Z')
  })
})

function makeJwtWithExp(iso: string): string {
  const exp = Math.floor(Date.parse(iso) / 1000)
  const payload = Buffer.from(JSON.stringify({ exp }), 'utf8').toString('base64url')
  return `hdr.${payload}.sig`
}

describe('redactTokenMaterial', () => {
  it('strips JWT-shaped substrings (3 base64url segments)', () => {
    const fake =
      'header_xxxxx.payload_yyyyy.signature_zzzzz'
    const out = redactTokenMaterial(`token=${fake}`)
    expect(out).not.toContain(fake)
    expect(out).toContain('<redacted-jwt>')
  })

  it('strips Bearer headers', () => {
    const out = redactTokenMaterial('Authorization: Bearer abcd1234efgh5678ijkl9012mnop3456qrst7890')
    expect(out).toContain('Bearer <redacted>')
    expect(out).not.toContain('abcd1234efgh5678')
  })

  it('strips long opaque base64url runs (refresh-token shape)', () => {
    const refreshLooking = 'A'.repeat(60)
    const out = redactTokenMaterial(`refresh=${refreshLooking}`)
    expect(out).not.toContain(refreshLooking)
    expect(out).toContain('<redacted-opaque>')
  })

  it('truncates output to 500 chars', () => {
    const huge = 'x'.repeat(2000)
    const out = redactTokenMaterial(huge)
    expect(out.length).toBeLessThanOrEqual(500)
  })

  it('preserves short non-token strings', () => {
    const safe = 'privy_refresh_failed:400'
    expect(redactTokenMaterial(safe)).toBe(safe)
  })
})

describe('classifyRefreshError', () => {
  it('parses privy_refresh_failed:<status> into errorCode', () => {
    const result = classifyRefreshError('privy_refresh_failed:400:{"error":"Invalid auth token"}')
    expect(result.errorCode).toBe('privy_refresh_failed:400')
    expect(result.detail).toContain('Invalid auth token')
  })

  it('preserves malformed_response prefix', () => {
    const result = classifyRefreshError(
      'privy_refresh_failed:malformed_response:missing=identity_token|token:keys=session_token',
    )
    expect(result.errorCode).toBe('privy_refresh_failed:malformed_response')
  })

  it('classifies token_persistence_failed', () => {
    const result = classifyRefreshError('token_persistence_failed:identity_token')
    expect(result.errorCode).toBe('token_persistence_failed')
  })

  it('classifies refresher_disabled with empty detail', () => {
    const result = classifyRefreshError('refresher_disabled')
    expect(result.errorCode).toBe('refresher_disabled')
    expect(result.detail).toBe('')
  })

  it('falls back to unknown for unrecognized errors', () => {
    const result = classifyRefreshError('random network glitch')
    expect(result.errorCode).toBe('unknown')
    expect(result.detail).toContain('random network glitch')
  })

  describe('Privy 4xx subcode extraction', () => {
    it('extracts missing_or_invalid_token (bearer rejected — incident 2026-05-01)', () => {
      const result = classifyRefreshError(
        'privy_refresh_failed:400:{"error":"Invalid auth token","code":"missing_or_invalid_token"}',
      )
      expect(result.errorCode).toBe(
        'privy_refresh_failed:400:missing_or_invalid_token',
      )
      expect(result.detail).toContain('Invalid auth token')
    })

    it('extracts invalid_refresh_token (refresh-token revocation)', () => {
      const result = classifyRefreshError(
        'privy_refresh_failed:400:{"error":"Refresh token rotated out","code":"invalid_refresh_token"}',
      )
      expect(result.errorCode).toBe(
        'privy_refresh_failed:400:invalid_refresh_token',
      )
    })

    it('preserves bare prefix when Privy body has no recognised code', () => {
      const result = classifyRefreshError(
        'privy_refresh_failed:400:{"error":"Invalid auth token"}',
      )
      expect(result.errorCode).toBe('privy_refresh_failed:400')
    })

    it('drops unrecognised code values to avoid surfacing untrusted strings', () => {
      const result = classifyRefreshError(
        'privy_refresh_failed:400:{"code":"shenanigans"}',
      )
      expect(result.errorCode).toBe('privy_refresh_failed:400')
    })

    it('handles non-400 statuses with subcodes too (defensive)', () => {
      const result = classifyRefreshError(
        'privy_refresh_failed:401:{"error":"x","code":"missing_or_invalid_token"}',
      )
      expect(result.errorCode).toBe(
        'privy_refresh_failed:401:missing_or_invalid_token',
      )
    })

    it('matches the JSON code regardless of whitespace and case', () => {
      const result = classifyRefreshError(
        'privy_refresh_failed:400:{"code"   :   "Missing_Or_Invalid_Token"}',
      )
      expect(result.errorCode).toBe(
        'privy_refresh_failed:400:missing_or_invalid_token',
      )
    })
  })

  it('treats empty/whitespace input as unknown with empty detail', () => {
    expect(classifyRefreshError('').errorCode).toBe('unknown')
    expect(classifyRefreshError('').detail).toBe('')
    expect(classifyRefreshError('   ').errorCode).toBe('unknown')
  })

  it('redacts JWT-shaped substrings in detail', () => {
    const fakeJwt = 'eyJhbGciOi.eyJzdWJxxx.signature_zzz_xxxx'
    const result = classifyRefreshError(`privy_refresh_failed:401:${fakeJwt}`)
    expect(result.detail).not.toContain(fakeJwt)
    expect(result.detail).toContain('<redacted-jwt>')
  })
})

describe('buildRefreshSuccessPayload / buildRefreshFailurePayload', () => {
  it('success payload carries timestamp, identity exp, access exp, writer, rotation flag', () => {
    const out = buildRefreshSuccessPayload({
      at: '2026-05-01T12:00:00.000Z',
      identityTokenExpIso: '2026-05-01T13:00:00.000Z',
      accessTokenExpIso: '2026-05-01T13:00:00.000Z',
      writer: 'privy-token-refresher',
      rotatedRefresh: true,
    })
    expect(out).toEqual({
      at: '2026-05-01T12:00:00.000Z',
      identityTokenExp: '2026-05-01T13:00:00.000Z',
      accessTokenExp: '2026-05-01T13:00:00.000Z',
      writer: 'privy-token-refresher',
      rotatedRefresh: true,
    })
  })

  it('success payload defaults accessTokenExp to null when caller omits it', () => {
    // Backwards-compat for any caller that still uses the pre-cliff
    // signature; the field is optional in `buildRefreshSuccessPayload`.
    const out = buildRefreshSuccessPayload({
      at: '2026-05-01T12:00:00.000Z',
      identityTokenExpIso: '2026-05-01T13:00:00.000Z',
      writer: 'privy-token-refresher',
      rotatedRefresh: false,
    })
    expect(out.accessTokenExp).toBeNull()
  })

  it('failure payload classifies error code', () => {
    const out = buildRefreshFailurePayload({
      at: '2026-05-01T12:00:00.000Z',
      status: 'error',
      rawError: 'privy_refresh_failed:400:{"error":"Invalid auth token"}',
    })
    expect(out.status).toBe('error')
    expect(out.errorCode).toBe('privy_refresh_failed:400')
    expect(out.at).toBe('2026-05-01T12:00:00.000Z')
  })

  it('failure payload supports missing_tokens status', () => {
    const out = buildRefreshFailurePayload({
      at: '2026-05-01T12:00:00.000Z',
      status: 'missing_tokens',
      rawError: 'missing:ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN',
    })
    expect(out.status).toBe('missing_tokens')
    expect(out.errorCode).toBe('unknown')
    expect(out.detail).toContain('missing:ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN')
  })
})
