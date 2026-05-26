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
    let getAccessToken: (() => Promise<string | null>) | null = null
    usePrivyMock.mockImplementation(() => ({
      ready: true,
      authenticated: true,
      getAccessToken: () => (getAccessToken ? getAccessToken() : Promise.resolve(null)),
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

    getAccessToken = async () => 'privy-access-token'
    rerender()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.me?.accountSignals?.executionTrack).toBe('legacy-owner-install')
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'X-Privy-Token': 'privy-access-token',
    })
  })
})
