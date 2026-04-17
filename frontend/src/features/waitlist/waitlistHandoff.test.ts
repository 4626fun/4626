import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bridgePrivySession, createAuthHandoffCode } from './waitlistHandoff'

const apiFetchMock = vi.fn()
const writeStoredSessionTokenMock = vi.fn()

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

vi.mock('@/hooks/useSiweAuth', () => ({
  writeStoredSessionToken: (...args: unknown[]) => writeStoredSessionTokenMock(...args),
}))

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

    await expect(bridgePrivySession('privy-token-123')).resolves.toBe(true)

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
    await expect(bridgePrivySession('privy-token-123')).resolves.toBe(false)
    expect(writeStoredSessionTokenMock).not.toHaveBeenCalled()
  })

  it('returns false on an empty/invalid privy token without hitting the network', async () => {
    await expect(bridgePrivySession('')).resolves.toBe(false)
    await expect(bridgePrivySession(null)).resolves.toBe(false)
    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(writeStoredSessionTokenMock).not.toHaveBeenCalled()
  })

  it('creates a handoff code via cookie auth (no session bearer plumbed through memory)', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { code: 'handoff-code-123', expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
    )

    await expect(createAuthHandoffCode({ privyToken: 'privy-token-123' })).resolves.toBe('handoff-code-123')

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
})
