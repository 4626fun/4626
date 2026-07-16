import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APP_ORIGIN } from '@/lib/env/host'
import {
  bridgePrivySession,
  createAlfaClubAuthHandoffTarget,
  createAppAuthHandoffTarget,
  createAuthHandoffCode,
  resolveAppContinueNavigationTarget,
} from './waitlistHandoff'

const apiFetchMock = vi.fn()
const writeStoredSessionTokenMock = vi.fn()
const getAppBaseUrlMock = vi.fn(() => APP_ORIGIN)

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

vi.mock('@/hooks/useSiweAuth', () => ({
  writeStoredSessionToken: (...args: unknown[]) => writeStoredSessionTokenMock(...args),
}))

vi.mock('@/lib/env/host', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env/host')>('@/lib/env/host')
  return {
    ...actual,
    getAppBaseUrl: () => getAppBaseUrlMock(),
  }
})

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('waitlist handoff helpers', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    writeStoredSessionTokenMock.mockReset()
    getAppBaseUrlMock.mockReset()
    getAppBaseUrlMock.mockReturnValue(APP_ORIGIN)
  })

  it('returns true when Privy auth successfully sets the session cookie', async () => {
    // FINDING-02 contract: server sets the cv_auth_session cookie and returns
    // only { address } in JSON. bridgePrivySession therefore signals success
    // via its boolean return.
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { address: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' },
      }),
    )

    await expect(bridgePrivySession('privy-token-123')).resolves.toEqual({
      ok: true,
      address: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/auth/privy',
      expect.objectContaining({
        method: 'POST',
        withCredentials: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer privy-token-123',
        }),
      }),
    )
  })

  it('clears stale sessionStorage token on successful bridge (prevents Bearer shadowing fresh cookie)', async () => {
    // Regression guard: when user is on the same origin as /swap (e.g. the
    // waitlist lives on app.4626.fun), navigateWithSessionHandoff skips the
    // cross-origin handoff path that clears sessionStorage. Without this
    // clear, apiBase.ts would inject the stale cv_siwe_session_token as
    // Authorization on /api/auth/me, which the server prefers over the
    // fresh cookie, surfacing as "logged out" on /swap.
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { address: '0xabcdef0123456789abcdef0123456789abcdef01' },
      }),
    )
    await bridgePrivySession('privy-token-123')
    expect(writeStoredSessionTokenMock).toHaveBeenCalledWith(null)
  })

  it('does not touch sessionStorage when Privy bridge fails', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'nope' }, { status: 401 }))
    await expect(bridgePrivySession('privy-token-123')).resolves.toEqual({ ok: false, error: 'nope' })
    expect(writeStoredSessionTokenMock).not.toHaveBeenCalled()
  })

  it('returns false on an empty/invalid privy token without hitting the network', async () => {
    await expect(bridgePrivySession('')).resolves.toEqual({ ok: false })
    await expect(bridgePrivySession(null)).resolves.toEqual({ ok: false })
    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(writeStoredSessionTokenMock).not.toHaveBeenCalled()
  })

  it('creates a handoff code via cookie auth (no session bearer plumbed through memory)', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { code: '11'.repeat(32), expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
    )

    await expect(createAuthHandoffCode({ privyToken: 'privy-token-123' })).resolves.toBe('11'.repeat(32))

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/auth/handoff/create',
      expect.objectContaining({
        method: 'POST',
        withCredentials: true,
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ privyToken: 'privy-token-123' }),
      }),
    )
    // Key regression guard: we must NOT be reading a sessionToken out of
    // JS memory and reattaching it as an Authorization header. Cookie flow
    // only, per FINDING-02.
    const [, init] = apiFetchMock.mock.calls[0] as [unknown, { headers?: Record<string, string> }]
    expect(init.headers?.Authorization).toBeUndefined()
  })

  it('returns empty string on handoff create failure', async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'unauthorized' }, { status: 401 }))
    await expect(createAuthHandoffCode({ privyToken: 'privy-token-123' })).resolves.toBe('')
  })

  it('resolves same-origin Continue to a relative /swap path (no hard reload)', () => {
    expect(
      resolveAppContinueNavigationTarget({
        appBaseUrl: 'http://localhost:5174',
        currentOrigin: 'http://localhost:5174',
        handoffCode: 'unused-on-same-origin',
      }),
    ).toBe('/swap')
  })

  it('resolves cross-origin Continue to an absolute handoff URL', () => {
    expect(
      resolveAppContinueNavigationTarget({
        appBaseUrl: APP_ORIGIN,
        currentOrigin: 'https://4626.fun',
        handoffCode: 'a'.repeat(64),
      }),
    ).toBe(`${APP_ORIGIN}/swap?cv_handoff=${'a'.repeat(64)}`)
  })

  it('same-origin Continue bridges the session and skips handoff create', async () => {
    getAppBaseUrlMock.mockReturnValue('http://localhost:5174')
    const originalLocation = globalThis.location
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:5174', href: 'http://localhost:5174/waitlist' },
    })
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { address: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' },
      }),
    )

    try {
      await expect(createAppAuthHandoffTarget({ privyToken: 'privy-token-123' })).resolves.toBe('/swap')
      expect(apiFetchMock.mock.calls.map(([path]) => path)).toEqual(['/api/auth/privy'])
    } finally {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('refreshes the canonical Privy session before creating the app handoff', async () => {
    getAppBaseUrlMock.mockReturnValue(APP_ORIGIN)
    const originalLocation = globalThis.location
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: 'https://4626.fun', href: 'https://4626.fun/waitlist' },
    })
    apiFetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { address: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { code: 'ab'.repeat(32), expiresAt: '2099-01-01T00:00:00.000Z' },
        }),
      )

    try {
      await expect(
        createAppAuthHandoffTarget({ privyToken: 'privy-token-123' }),
      ).resolves.toBe(`${APP_ORIGIN}/swap?cv_handoff=${'ab'.repeat(32)}`)

      expect(apiFetchMock.mock.calls.map(([path]) => path)).toEqual([
        '/api/auth/privy',
        '/api/auth/handoff/create',
      ])
      expect(apiFetchMock).toHaveBeenLastCalledWith(
        '/api/auth/handoff/create',
        expect.objectContaining({
          body: JSON.stringify({
            privyToken: null,
            expectedAddress: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
          }),
        }),
      )
    } finally {
      Object.defineProperty(globalThis, 'location', {
        configurable: true,
        value: originalLocation,
      })
    }
  })

  it('does not transfer a stale cookie-only identity to the app host', async () => {
    await expect(createAppAuthHandoffTarget({ privyToken: null })).resolves.toBe('')
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('stops before handoff creation when the Privy session refresh fails', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'invalid token' }, { status: 401 }),
    )

    await expect(
      createAppAuthHandoffTarget({ privyToken: 'expired-token' }),
    ).resolves.toBe('')
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('creates a one-time AlfaClub continuation from the existing cookie session', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { code: '22'.repeat(32), expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
    )

    await expect(
      createAlfaClubAuthHandoffTarget({
        returnPath: '/rooms?roomId=1659&tab=liquidity',
      }),
    ).resolves.toBe(
      `https://alfaclub.4626.fun/rooms?roomId=1659&tab=liquidity&cv_handoff=${'22'.repeat(32)}`,
    )
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/auth/handoff/create',
      expect.objectContaining({ body: JSON.stringify({ privyToken: null }) }),
    )
  })

  it('rejects an unsafe AlfaClub continuation before making auth requests', async () => {
    await expect(
      createAlfaClubAuthHandoffTarget({
        returnPath: 'https://evil.example/rooms',
      }),
    ).resolves.toBe('')
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('returns empty string when cookie-backed handoff creation fails', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'unauthorized' }, { status: 401 }),
    )

    await expect(
      createAlfaClubAuthHandoffTarget({
        returnPath: '/rooms?roomId=1659&tab=liquidity',
      }),
    ).resolves.toBe('')
  })

  it('uses an existing waitlist session cookie without a Privy token', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { code: '33'.repeat(32), expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
    )

    await expect(
      createAlfaClubAuthHandoffTarget({
        returnPath: '/rooms?roomId=1659&tab=liquidity',
      }),
    ).resolves.toBe(
      `https://alfaclub.4626.fun/rooms?roomId=1659&tab=liquidity&cv_handoff=${'33'.repeat(32)}`,
    )
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/auth/handoff/create',
      expect.objectContaining({ body: JSON.stringify({ privyToken: null }) }),
    )
  })
})
