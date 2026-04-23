import { describe, expect, it } from 'vitest'

import { extractJwtExpiryIso } from '../../server/_lib/alfaclub/chatTokenStore.ts'

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('extractJwtExpiryIso', () => {
  it('returns ISO timestamp when exp claim exists', () => {
    const jwt = makeJwt({ exp: 1_777_000_000 })
    expect(extractJwtExpiryIso(jwt)).toBe(new Date(1_777_000_000 * 1000).toISOString())
  })

  it('returns null for malformed tokens or missing exp', () => {
    expect(extractJwtExpiryIso('not-a-jwt')).toBeNull()
    expect(extractJwtExpiryIso(makeJwt({ sub: 'abc' }))).toBeNull()
  })
})

