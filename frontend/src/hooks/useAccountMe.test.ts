// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { apiFetchMock, usePrivyMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  usePrivyMock: vi.fn(),
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: usePrivyMock,
}))

describe('useAccountMe', () => {
  beforeEach(() => {
    vi.resetModules()
    apiFetchMock.mockReset()
    usePrivyMock.mockReset()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('refetches after Privy access token becomes available', async () => {
    let tokenGetter: (() => Promise<string | null>) | undefined
    usePrivyMock.mockImplementation(() => ({
      ready: true,
      authenticated: true,
      getAccessToken:
        typeof tokenGetter === 'function'
          ? tokenGetter
          : undefined,
    }))

    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
            canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
            baseSubAccount: {
              address: null,
              registered: false,
              isDistinctFromCsw: false,
            },
          },
        },
      }),
    })

    const { useAccountMe } = await import('./useAccountMe')
    const { result, rerender } = renderHook(() => useAccountMe())

    await waitFor(() => {
      expect(result.current.loading).toBe(true)
      expect(apiFetchMock).not.toHaveBeenCalled()
    })

    tokenGetter = async () => 'privy-access-token'
    rerender()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.me?.accountSignals?.executionTrack).toBe('legacy-owner-install')
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    const accountsMeCall = apiFetchMock.mock.calls.find((call) => call[0] === '/api/accounts/me')
    expect(accountsMeCall?.[1]?.headers).toMatchObject({
      'X-Privy-Token': 'privy-access-token',
    })
    expect(apiFetchMock.mock.calls.some((call) => call[0] === '/api/onboarding/bootstrap')).toBe(false)
  })

  it('does not refetch /api/accounts/me on rerender when auth is stable', async () => {
    usePrivyMock.mockImplementation(() => ({
      ready: true,
      authenticated: true,
      getAccessToken: async () => 'privy-access-token',
    }))

    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
            canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
            baseSubAccount: {
              address: null,
              registered: false,
              isDistinctFromCsw: false,
            },
          },
        },
      }),
    })

    const { useAccountMe } = await import('./useAccountMe')
    const { result, rerender } = renderHook(() => useAccountMe())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const accountsMeCallsAfterFirstLoad = apiFetchMock.mock.calls.filter(
      (call) => call[0] === '/api/accounts/me',
    ).length
    expect(accountsMeCallsAfterFirstLoad).toBeGreaterThan(0)

    rerender()
    rerender()
    rerender()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const accountsMeCallsAfterRerenders = apiFetchMock.mock.calls.filter(
      (call) => call[0] === '/api/accounts/me',
    ).length
    expect(accountsMeCallsAfterRerenders).toBe(accountsMeCallsAfterFirstLoad)
  })

  it('reads only /api/accounts/me (bootstrap is server-side now)', async () => {
    usePrivyMock.mockImplementation(() => ({
      ready: true,
      authenticated: true,
      getAccessToken: async () => 'privy-access-token',
    }))

    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/accounts/me') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            success: true,
            data: {
              accountSignals: {
                canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
                executionTrack: 'legacy-owner-install',
                privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
                baseSubAccount: { address: null, registered: false, isDistinctFromCsw: false },
              },
            },
          }),
        })
      }
      throw new Error(`Unexpected path: ${path}`)
    })

    const { useAccountMe } = await import('./useAccountMe')
    const { result } = renderHook(() => useAccountMe())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const paths = apiFetchMock.mock.calls.map((call) => call[0])
    expect(paths).toContain('/api/accounts/me')
    expect(paths).not.toContain('/api/onboarding/bootstrap')
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })
})
