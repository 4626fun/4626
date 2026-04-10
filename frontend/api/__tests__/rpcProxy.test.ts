import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const readRequestPrincipalAddressMock = vi.hoisted(
  () => vi.fn((..._args: unknown[]) => '0x00000000000000000000000000000000000000aa'),
)

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
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

  it('returns 503 when in-flight concurrency limit is exceeded', async () => {
    const restoreEnv = applyEnv({
      RPC_PROXY_MAX_IN_FLIGHT: '10',
    })
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return okRpcResponse()
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    try {
      const handler = await loadHandler()
      const inFlight = Array.from({ length: 10 }, () => handler(createRpcReq(), createMockRes()))
      const blockedRes = createMockRes()
      await handler(createRpcReq(), blockedRes)
      await Promise.all(inFlight)

      expect(blockedRes.statusCode).toBe(503)
      expect(blockedRes.body).toEqual({
        success: false,
        error: 'RPC proxy is busy, retry shortly',
        code: 'rpc_proxy_busy',
      })
      expect(blockedRes.getHeader('retry-after')).toBe('1')
      expect(fetchMock).toHaveBeenCalledTimes(10)
    } finally {
      restoreEnv()
    }
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
      error: 'Upstream RPC rate limited',
      code: 'rpc_upstream_rate_limited',
    })
    expect(res.getHeader('retry-after')).toBe('7')
    expect(res.getHeader('x-ratelimit-limit')).toBe('120')
    expect(res.getHeader('x-ratelimit-remaining')).toBe('119')
  })

  it('falls back to default RPC when env RPC returns non-retryable 403', async () => {
    const restoreEnv = applyEnv({
      BASE_READ_RPC_URL: 'https://env-rpc.example',
    })
    const fetchMock = vi.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input)
      const bodyRaw = typeof init?.body === 'string' ? init.body : ''
      const method =
        bodyRaw && bodyRaw.includes('"method"')
          ? String((JSON.parse(bodyRaw) as { method?: string }).method ?? '')
          : ''

      if (url.includes('env-rpc.example') && method === 'eth_chainId') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: '0x2105',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url.includes('env-rpc.example')) {
        return new Response('forbidden', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      return okRpcResponse()
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    try {
      const handler = await loadHandler()
      const req = createRpcReq()
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(typeof res.body).toBe('string')
      expect(String(res.body)).toContain('"result":"0x123"')
      expect(fetchMock).toHaveBeenCalledTimes(3)
    } finally {
      restoreEnv()
    }
  })

  it('redacts sensitive upstream details from client errors', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response('forbidden by https://private-rpc.example.com?apiKey=secret', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const handler = await loadHandler()
    const req = createRpcReq()
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({
      success: false,
      error: 'Upstream RPC request failed',
      code: 'rpc_upstream_rejected',
    })
    expect(String(res.body?.error ?? '').toLowerCase()).not.toContain('private-rpc.example.com')
    expect(String(res.body?.error ?? '').toLowerCase()).not.toContain('apikey')
  })

  it('enforces per-ip limits even when principal rotates', async () => {
    const restoreEnv = applyEnv({
      RPC_PROXY_RATE_LIMIT_MAX_REQUESTS: '500',
      RPC_PROXY_RATE_LIMIT_MAX_REQUESTS_PER_IP: '60',
    })
    let index = 0
    readRequestPrincipalAddressMock.mockImplementation(() => {
      index += 1
      return `0x${index.toString(16).padStart(40, '0')}`
    })
    const fetchMock = vi.fn().mockImplementation(() => okRpcResponse())
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    try {
      const handler = await loadHandler()
      let blockedRes = createMockRes()
      for (let i = 0; i < 61; i += 1) {
        const req = createMockReq({
          method: 'POST',
          query: { chain: 'base' },
          headers: { 'x-forwarded-for': '203.0.113.9' },
          body: { jsonrpc: '2.0', id: i + 1, method: 'eth_blockNumber', params: [] },
        })
        blockedRes = createMockRes()
        await handler(req, blockedRes)
      }

      expect(blockedRes.statusCode).toBe(429)
      expect(blockedRes.body).toEqual({
        success: false,
        error: 'Rate limit exceeded',
        code: 'rpc_local_rate_limited',
      })
      expect(fetchMock).toHaveBeenCalledTimes(60)
    } finally {
      restoreEnv()
    }
  })

  it('rejects oversized JSON-RPC batches before forwarding upstream', async () => {
    const fetchMock = vi.fn().mockImplementation(() => okRpcResponse())
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const handler = await loadHandler()
    const req = createMockReq({
      method: 'POST',
      query: { chain: 'base' },
      body: Array.from({ length: 101 }, (_, i) => ({
        jsonrpc: '2.0',
        id: i + 1,
        method: 'eth_blockNumber',
        params: [],
      })),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid JSON-RPC body' })
    expect(fetchMock).not.toHaveBeenCalled()
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
