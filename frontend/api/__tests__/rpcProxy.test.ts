import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const readRequestPrincipalAddressMock = vi.hoisted(
  () => vi.fn(() => '0x00000000000000000000000000000000000000aa'),
)

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: (...args: unknown[]) => readRequestPrincipalAddressMock(...args),
}))

async function loadHandler() {
  const mod = await import('../_handlers/rpc/_proxy.ts')
  return mod.default
}

function createRpcReq() {
  return createMockReq({
    method: 'POST',
    query: { chain: 'base' },
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [],
    },
  })
}

function okRpcResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: '0x123',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

describe('/api/rpc proxy rate-limit contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns local 429 with explicit backoff metadata', async () => {
    const fetchMock = vi.fn().mockImplementation(() => okRpcResponse())
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const handler = await loadHandler()
    let lastRes = createMockRes()
    for (let i = 0; i < 121; i += 1) {
      const req = createRpcReq()
      lastRes = createMockRes()
      await handler(req, lastRes)
    }

    expect(lastRes.statusCode).toBe(429)
    expect(lastRes.body).toEqual({
      success: false,
      error: 'Rate limit exceeded',
      code: 'rpc_local_rate_limited',
    })
    expect(lastRes.getHeader('x-ratelimit-limit')).toBe('120')
    expect(lastRes.getHeader('x-ratelimit-remaining')).toBe('0')
    expect(Number(lastRes.getHeader('x-ratelimit-reset'))).toBeGreaterThan(0)
    expect(Number(lastRes.getHeader('retry-after'))).toBeGreaterThan(0)
    // Last request is blocked before proxy forwarding.
    expect(fetchMock).toHaveBeenCalledTimes(120)
  })

  it('returns upstream 429 with upstream code and retry-after header', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response('upstream rate limited', {
          status: 429,
          headers: {
            'Content-Type': 'text/plain',
            'Retry-After': '7',
          },
        }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const handler = await loadHandler()
    const req = createRpcReq()
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({
      success: false,
      error: 'upstream rate limited',
      code: 'rpc_upstream_rate_limited',
    })
    expect(res.getHeader('retry-after')).toBe('7')
    expect(res.getHeader('x-ratelimit-limit')).toBe('120')
    expect(res.getHeader('x-ratelimit-remaining')).toBe('119')
  })

  it('emits windowed rpc telemetry with in-flight peak', async () => {
    vi.useFakeTimers()
    const restoreEnv = applyEnv({
      RPC_PROXY_TELEMETRY: '1',
      RPC_PROXY_TELEMETRY_WINDOW_MS: '1000',
    })
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return okRpcResponse()
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    try {
      const handler = await loadHandler()

      const first = handler(createRpcReq(), createMockRes())
      const second = handler(createRpcReq(), createMockRes())
      await vi.advanceTimersByTimeAsync(25)
      await Promise.all([first, second])

      const third = handler(createRpcReq(), createMockRes())
      await vi.advanceTimersByTimeAsync(25)
      await third
      await vi.advanceTimersByTimeAsync(1200)

      const fourth = handler(createRpcReq(), createMockRes())
      await vi.advanceTimersByTimeAsync(25)
      await fourth

      const summaryCall = consoleInfoSpy.mock.calls.find(
        ([label]) => label === '[rpc-telemetry-window]',
      )
      expect(summaryCall).toBeDefined()

      const payload = JSON.parse(String(summaryCall?.[1] ?? '{}')) as {
        totalRequests: number
        maxInFlight: number
      }
      expect(payload.totalRequests).toBe(3)
      expect(payload.maxInFlight).toBeGreaterThanOrEqual(2)
    } finally {
      restoreEnv()
      consoleInfoSpy.mockRestore()
      vi.useRealTimers()
    }
  })
})
