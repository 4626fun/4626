import { describe, expect, it, vi } from 'vitest'

import { fetchDelegationStatus } from './tradingApi'

describe('fetchDelegationStatus', () => {
  it('POSTs to /api/uniswap/checkDelegation', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            requestId: 'req_1',
            delegationDetails: {},
          },
        }),
      } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const res = await fetchDelegationStatus({
      chainIds: [8453],
      walletAddresses: ['0x0000000000000000000000000000000000000002'],
    })

    expect(res.requestId).toBe('req_1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/uniswap/checkDelegation')
    expect(init?.method).toBe('POST')
  })
})

