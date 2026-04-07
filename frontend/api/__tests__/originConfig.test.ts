import { afterEach, describe, expect, it } from 'vitest'

import { getCanonicalOrigin, getErc8004PublicOrigin } from '../../server/_lib/origin.ts'
import { applyEnv, createMockReq } from './helpers'

describe('origin resolution', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('uses APP_ORIGIN when configured', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: 'https://v1.4626.fun',
      VERCEL_URL: undefined,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    expect(getCanonicalOrigin()).toBe('https://v1.4626.fun')
  })

  it('falls back to VERCEL_URL when APP_ORIGIN is unset', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: undefined,
      VERCEL_URL: 'app-4626.vercel.app',
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    expect(getCanonicalOrigin()).toBe('https://app-4626.vercel.app')
  })

  it('allows local forwarded host in non-production when explicit origins are unset', () => {
    restoreEnv = applyEnv({
      APP_ORIGIN: undefined,
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
      VERCEL_URL: undefined,
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: undefined,
    })

    expect(() => getCanonicalOrigin()).toThrow('missing_canonical_origin')
  })

  it('uses the dedicated ERC-8004 public origin when configured', () => {
    restoreEnv = applyEnv({
      ERC8004_PUBLIC_ORIGIN: 'https://scanner.4626.fun',
      VITE_MARKETING_ORIGIN: undefined,
    })

    expect(getErc8004PublicOrigin()).toBe('https://scanner.4626.fun')
  })

  it('falls back to the production marketing origin for ERC-8004 public surfaces', () => {
    restoreEnv = applyEnv({
      ERC8004_PUBLIC_ORIGIN: undefined,
      VITE_MARKETING_ORIGIN: undefined,
    })

    expect(getErc8004PublicOrigin()).toBe('https://4626.fun')
  })
})
