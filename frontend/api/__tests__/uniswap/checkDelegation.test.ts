import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

async function loadHandler() {
  const mod = await import('../../_handlers/uniswap/_checkDelegation.ts')
  return mod.default
}

describe('/api/uniswap/checkDelegation', () => {
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

  it('proxies to upstream /wallet/check_delegation', async () => {
    restoreEnv = applyEnv({ UNISWAP_API_KEY: 'test-key' })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return {
        status: 200,
        text: async () =>
          JSON.stringify({
            requestId: 'req_1',
            delegationDetails: {},
          }),
      } as any
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const req = createMockReq({
      method: 'POST',
      headers: {
        origin: 'https://app.4626.fun',
        'x-forwarded-for': '10.1.1.3',
      },
      body: {
        chainIds: [8453],
        walletAddresses: ['0x0000000000000000000000000000000000000002'],
      },
    })
    const res = createMockRes()
    const handler = await loadHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/wallet/check_delegation')
    const sentBody = JSON.parse(String(init?.body ?? '{}'))
    expect(sentBody.chainIds).toEqual([8453])
    expect(sentBody.walletAddresses).toEqual(['0x0000000000000000000000000000000000000002'])
  })

  it('returns 400 when chainIds is missing', async () => {
    restoreEnv = applyEnv({ UNISWAP_API_KEY: 'test-key' })
    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.4' },
      body: { walletAddresses: ['0x0000000000000000000000000000000000000002'] },
    })
    const res = createMockRes()
    const handler = await loadHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toMatch(/chainIds/i)
  })
})

