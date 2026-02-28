import { afterEach, describe, expect, it } from 'vitest'

import { getCanonicalOrigin } from '../../server/_lib/origin.ts'
import { applyEnv, createMockReq } from './helpers'

describe('origin resolution', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('prefers APP_ORIGIN over legacy CANONICAL_ORIGIN', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: 'https://app.4626.fun',
      CANONICAL_ORIGIN: 'https://4626.fun',
      VERCEL_URL: undefined,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    expect(getCanonicalOrigin()).toBe('https://app.4626.fun')
  })

  it('falls back to CANONICAL_ORIGIN when APP_ORIGIN is unset', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: undefined,
      CANONICAL_ORIGIN: 'https://4626.fun',
      VERCEL_URL: undefined,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    expect(getCanonicalOrigin()).toBe('https://4626.fun')
  })

  it('allows local forwarded host in non-production when explicit origins are unset', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: undefined,
      CANONICAL_ORIGIN: undefined,
      VERCEL_URL: undefined,
      NODE_ENV: 'development',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    const req = createMockReq({
      headers: {
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'localhost:5173',
      },
    })

    expect(getCanonicalOrigin(req)).toBe('http://localhost:5173')
  })

  it('throws when no origin can be derived in production', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: undefined,
      CANONICAL_ORIGIN: undefined,
      VERCEL_URL: undefined,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    expect(() => getCanonicalOrigin()).toThrow('missing_canonical_origin')
  })
})
