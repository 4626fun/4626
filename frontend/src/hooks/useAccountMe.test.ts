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

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
    const accountsMeCall = apiFetchMock.mock.calls.find((call) => call[0] === '/api/accounts/me')
    expect(accountsMeCall?.[1]?.headers).toMatchObject({
      'X-Privy-Token': 'privy-access-token',
    })
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

  it('starts /api/accounts/me and /api/onboarding/bootstrap in parallel', async () => {
    usePrivyMock.mockImplementation(() => ({
      ready: true,
      authenticated: true,
      getAccessToken: async () => 'privy-access-token',
    }))

    let resolveAccountsMe: ((value: unknown) => void) | null = null
    const accountsMeDeferred = new Promise<unknown>((resolve) => {
      resolveAccountsMe = resolve
    })

    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/accounts/me') {
        return accountsMeDeferred
      }
      if (path === '/api/onboarding/bootstrap') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            success: true,
            data: {
              canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
              privyEmbeddedEoaAddress: '0x1111111111111111111111111111111111111111',
              executionTrack: 'legacy-owner-install',
              privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
              baseSubAccount: {
                address: null,
                registered: false,
                isDistinctFromCsw: false,
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
      const paths = apiFetchMock.mock.calls.map((call) => call[0])
      expect(paths).toContain('/api/accounts/me')
      expect(paths).toContain('/api/onboarding/bootstrap')
    })

    // While /accounts/me is still unresolved, bootstrap should already be in flight.
    expect(result.current.loading).toBe(true)

    resolveAccountsMe?.({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        success: true,
        data: {
          accountSignals: {
            executionTrack: 'legacy-owner-install',
            privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
            canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          },
        },
      }),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
