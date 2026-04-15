import { beforeEach, describe, expect, it, vi } from 'vitest'

import { bridgePrivySession, createAuthHandoffCode } from './waitlistHandoff'

const apiFetchMock = vi.fn()

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
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
  })

  it('returns the minted session token from Privy auth', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          address: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
          sessionToken: 'session-token-123',
        },
      }),
    )

    await expect(bridgePrivySession('privy-token-123')).resolves.toBe('session-token-123')

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

  it('sends the fresh session token when creating a cross-origin handoff', async () => {
    apiFetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: { code: 'handoff-code-123', expiresAt: '2099-01-01T00:00:00.000Z' },
      }),
    )

    await expect(
      createAuthHandoffCode({
        privyToken: 'privy-token-123',
        sessionToken: 'session-token-123',
      }),
    ).resolves.toBe('handoff-code-123')

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/auth/handoff/create',
      expect.objectContaining({
        method: 'POST',
        withCredentials: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token-123',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ privyToken: 'privy-token-123' }),
      }),
    )
  })
})
