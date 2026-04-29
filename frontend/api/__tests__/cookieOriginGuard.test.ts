import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  COOKIE_SESSION,
  enforceCookieSessionTrustedOrigin,
  makeSessionToken,
} from '../../packages/server-core/src/index.js'
import { applyEnv, createMockReq, createMockRes } from './helpers'

describe('cookie origin guard', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    restoreEnv = applyEnv({
      AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567890abcdef',
      APP_ORIGIN: 'https://trusted.4626.fun',
      CORS_ALLOWED_ORIGINS: undefined,
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  function buildSessionCookie(address = '0x00000000000000000000000000000000000000aa'): string {
    const token = makeSessionToken({ address })
    return `${COOKIE_SESSION}=${encodeURIComponent(token)}`
  }

  it('allows unsafe requests with cookie session from the marketing origin when app origin is separate', () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        cookie: buildSessionCookie(),
        origin: 'https://4626.fun',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
  })

  it('allows unsafe requests with cookie session from canonical app origin even when APP_ORIGIN is stale', () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        cookie: buildSessionCookie(),
        origin: 'https://app.4626.fun',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
  })

  it('blocks unsafe requests with cookie session from untrusted origins', () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        cookie: buildSessionCookie(),
        origin: 'https://evil.example',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(true)
    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ success: false, error: 'Forbidden' })
    expect(res.getHeader('cache-control')).toBe('no-store')
  })

  it('allows unsafe requests with cookie session from trusted origins', () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        cookie: buildSessionCookie(),
        origin: 'https://trusted.4626.fun',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(res.body).toBeUndefined()
  })

  it('does not block unsafe requests without a valid session cookie', () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(false)
  })

  it('enforces trusted-origin guard even when explicit Privy auth is present', () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        cookie: buildSessionCookie(),
        origin: 'https://evil.example',
        'x-privy-token': 'privy-token',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(true)
    expect(res.statusCode).toBe(403)
  })

  it('does not block safe methods', () => {
    const req = createMockReq({
      method: 'GET',
      headers: {
        cookie: buildSessionCookie(),
        origin: 'https://evil.example',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(false)
  })

  it('enforces trusted-origin guard even when explicit bearer session auth is valid', () => {
    const bearerToken = makeSessionToken({ address: '0x00000000000000000000000000000000000000bb' })
    const req = createMockReq({
      method: 'POST',
      headers: {
        cookie: buildSessionCookie(),
        authorization: `Bearer ${bearerToken}`,
        origin: 'https://evil.example',
      },
    })
    const res = createMockRes()

    const handled = enforceCookieSessionTrustedOrigin(req, res)

    expect(handled).toBe(true)
    expect(res.statusCode).toBe(403)
  })
})
