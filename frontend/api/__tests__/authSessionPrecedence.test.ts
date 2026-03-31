import { afterEach, describe, expect, it } from 'vitest'

import { COOKIE_SESSION, makeSessionToken, readSessionFromRequest } from '../../packages/server-core/src/index.js'

const BEARER_ADDRESS = '0x00000000000000000000000000000000000000aa'
const COOKIE_ADDRESS = '0x00000000000000000000000000000000000000bb'

describe('session token precedence', () => {
  const originalSecret = process.env.AUTH_SESSION_SECRET

  afterEach(() => {
    process.env.AUTH_SESSION_SECRET = originalSecret
  })

  it('prefers explicit bearer auth over ambient cookie session state', () => {
    process.env.AUTH_SESSION_SECRET = 'test-auth-session-secret-123456'
    const bearerToken = makeSessionToken({ address: BEARER_ADDRESS })
    const cookieToken = makeSessionToken({ address: COOKIE_ADDRESS })

    const req = {
      headers: {
        authorization: `Bearer ${bearerToken}`,
        cookie: `${COOKIE_SESSION}=${encodeURIComponent(cookieToken)}`,
      },
    } as any

    expect(readSessionFromRequest(req)).toEqual({ address: BEARER_ADDRESS })
  })

  it('falls back to the cookie session when the bearer token is invalid', () => {
    process.env.AUTH_SESSION_SECRET = 'test-auth-session-secret-123456'
    const cookieToken = makeSessionToken({ address: COOKIE_ADDRESS })

    const req = {
      headers: {
        authorization: 'Bearer not-a-valid-session-token',
        cookie: `${COOKIE_SESSION}=${encodeURIComponent(cookieToken)}`,
      },
    } as any

    expect(readSessionFromRequest(req)).toEqual({ address: COOKIE_ADDRESS })
  })
})
