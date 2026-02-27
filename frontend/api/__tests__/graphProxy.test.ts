import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

async function loadQueryHandler() {
  const mod = await import('../_handlers/uniswap/_query.ts')
  return mod.default
}

async function loadPoolHistoryHandler() {
  const mod = await import('../_handlers/uniswap/_poolHistory.ts')
  return mod.default
}

describe('graph proxy hardening', () => {
  let restoreEnv: (() => void) | null = null

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
    vi.unstubAllGlobals()
  })

  it('does not set ACAO for disallowed origins', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: 'graph-key' })
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { _meta: { block: { number: 1 } } } }))
    vi.stubGlobal('fetch', fetchMock)

    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://evil.test', 'x-forwarded-for': '10.1.1.1' },
      body: { query: 'query HealthMeta { _meta { block { number } } }' },
    })
    const res = createMockRes()
    const queryHandler = await loadQueryHandler()

    await queryHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('access-control-allow-origin')).toBeUndefined()
  })

  it('reflects ACAO for allowlisted origin', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: 'graph-key' })
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { _meta: { block: { number: 1 } } } }))
    vi.stubGlobal('fetch', fetchMock)

    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.2' },
      body: { query: 'query HealthMeta { _meta { block { number } } }' },
    })
    const res = createMockRes()
    const queryHandler = await loadQueryHandler()

    await queryHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('access-control-allow-origin')).toBe('https://app.4626.fun')
  })

  it('returns 429 after exceeding rate limit', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: 'graph-key' })
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { _meta: { block: { number: 1 } } } }))
    vi.stubGlobal('fetch', fetchMock)

    let lastRes = createMockRes()
    const queryHandler = await loadQueryHandler()
    for (let i = 0; i < 61; i++) {
      const req = createMockReq({
        method: 'POST',
        headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.9.9.9' },
        body: { query: 'query HealthMeta { _meta { block { number } } }' },
      })
      lastRes = createMockRes()
      await queryHandler(req, lastRes)
    }

    expect(lastRes.statusCode).toBe(429)
    expect(lastRes.body).toEqual({ success: false, error: 'Rate limit exceeded' })
  })

  it('blocks non-allowlisted operations', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: 'graph-key' })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.4' },
      body: { query: 'query UnknownOp { pools { id } }' },
    })
    const res = createMockRes()
    const queryHandler = await loadQueryHandler()

    await queryHandler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Operation not allowed' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('redacts upstream errors', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: 'graph-key' })
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response('upstream stack trace with secret=abc', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.5' },
      body: { query: 'query HealthMeta { _meta { block { number } } }' },
    })
    const res = createMockRes()
    const queryHandler = await loadQueryHandler()

    await queryHandler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'Internal server error' })
    expect(JSON.stringify(res.body)).not.toContain('secret=abc')
  })

  it('rejects oversized upstream payloads', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: 'graph-key' })
    const huge = JSON.stringify({ data: { blob: 'x'.repeat(1_200_000) } })
    const fetchMock = vi.fn().mockImplementation(() => new Response(huge, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const req = createMockReq({
      method: 'POST',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.7' },
      body: { query: 'query HealthMeta { _meta { block { number } } }' },
    })
    const res = createMockRes()
    const queryHandler = await loadQueryHandler()

    await queryHandler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'Internal server error' })
  })

  it('poolHistory uses allowlisted CORS (no wildcard)', async () => {
    restoreEnv = applyEnv({ THEGRAPH_API_KEY: undefined })

    const req = createMockReq({
      method: 'GET',
      headers: { origin: 'https://app.4626.fun', 'x-forwarded-for': '10.1.1.6' },
      query: { token: '0x0000000000000000000000000000000000000001', timeframe: '1d' },
    })
    const res = createMockRes()
    const poolHistoryHandler = await loadPoolHistoryHandler()

    await poolHistoryHandler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.getHeader('access-control-allow-origin')).toBe('https://app.4626.fun')
    expect(res.getHeader('access-control-allow-origin')).not.toBe('*')
  })
})
