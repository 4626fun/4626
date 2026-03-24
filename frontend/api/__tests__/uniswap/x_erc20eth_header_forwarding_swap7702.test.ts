import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

async function loadHandler() {
  const mod = await import('../../_handlers/uniswap/_swap7702.ts')
  return mod.default
}

describe('x-erc20eth-enabled header forwarding (swap7702)', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
    vi.unstubAllGlobals()
  })

  it('forwards x-erc20eth-enabled: true to upstream', async () => {
    restoreEnv = applyEnv({ UNISWAP_API_KEY: 'test-key' })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            requestId: 'req_1',
            approvals: [],
            permits: [],
            transactions: [],
          }),
      } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: {
        origin: 'https://v1.4626.fun',
        'x-forwarded-for': '10.1.1.3',
        'x-erc20eth-enabled': 'true',
      },
      body: {
        chainId: 8453,
        approveAmount: '1',
        to: '0x0000000000000000000000000000000000000002',
        tokenAddress: 'ETH',
        smartContractDelegationAddress: '0x0000000000000000000000000000000000000003',
        classicQuote: {},
      },
    })
    const res = createMockRes()
    const handler = await loadHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [_url, init] = fetchMock.mock.calls[0]
    const sentHeaders = new Headers(init?.headers as any)
    expect(sentHeaders.get('x-erc20eth-enabled')).toBe('true')
  })
})

