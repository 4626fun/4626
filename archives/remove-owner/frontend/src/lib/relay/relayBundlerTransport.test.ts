import { describe, expect, it, vi } from 'vitest'

const httpMock = vi.fn(() => ({ kind: 'transport' }))

vi.mock('viem', () => ({
  http: (...args: unknown[]) => httpMock(...args),
}))

vi.mock('@/lib/aa/coinbaseErc4337EndpointUtils', () => ({
  isSameOriginUrl: () => true,
}))

vi.mock('@/lib/relay/resolveRelayPart1DepositTxHash', () => ({
  resolveRelayBundlerUrl: () => '/api/paymaster',
}))

describe('buildRelayBundlerHttpTransport', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    httpMock.mockClear()
    storage.clear()
    storage.set('cv_siwe_session_token', 'stale-bearer-token')
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    })
    vi.stubGlobal('window', globalThis)
  })

  it('omits Authorization when custom-owner policy token is present', async () => {
    vi.resetModules()
    const { buildRelayBundlerHttpTransport } = await import('@/lib/relay/relayBundlerTransport')
    buildRelayBundlerHttpTransport('policy-token-abc')

    expect(httpMock).toHaveBeenCalledTimes(1)
    const options = httpMock.mock.calls[0]?.[1] as {
      fetchOptions?: { credentials?: string; headers?: Record<string, string> }
    }
    expect(options.fetchOptions?.credentials).toBe('include')
    expect(options.fetchOptions?.headers?.Authorization).toBeUndefined()
    expect(options.fetchOptions?.headers?.['X-CV-Custom-Owner-Policy']).toBe('policy-token-abc')
  })

  it('includes Authorization bearer when no policy token is present', async () => {
    vi.resetModules()
    const { buildRelayBundlerHttpTransport } = await import('@/lib/relay/relayBundlerTransport')
    buildRelayBundlerHttpTransport(null)

    const options = httpMock.mock.calls[0]?.[1] as {
      fetchOptions?: { headers?: Record<string, string> }
    }
    expect(options.fetchOptions?.headers?.Authorization).toBe('Bearer stale-bearer-token')
  })
})
