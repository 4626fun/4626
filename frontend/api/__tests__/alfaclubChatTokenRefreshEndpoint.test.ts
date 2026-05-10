import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { runAlfaClubPrivyRefreshOnceMock } = vi.hoisted(() => ({
  runAlfaClubPrivyRefreshOnceMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/privyTokenRefresher.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/privyTokenRefresher.ts')
  >('../../server/_lib/alfaclub/privyTokenRefresher.ts')
  return {
    ...actual,
    runAlfaClubPrivyRefreshOnce: runAlfaClubPrivyRefreshOnceMock,
  }
})

import refreshHandler from '../_handlers/v1/alfaclub/_chat-token-refresh.ts'

describe('POST /api/v1/alfaclub/chat-token-refresh', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    runAlfaClubPrivyRefreshOnceMock.mockResolvedValue({
      status: 'refreshed',
      identityTokenExp: 1_800_000_000_000,
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects unsupported methods with 405', async () => {
    const req = createMockReq({ method: 'PUT' })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 503 when cron secret envs are not configured', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({})
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('CRON_SECRET (or CRON_SECRET_NEXT) is not configured')
    expect(runAlfaClubPrivyRefreshOnceMock).not.toHaveBeenCalled()
  })

  it('accepts CRON_SECRET_NEXT when CRON_SECRET is empty', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({ CRON_SECRET: '', CRON_SECRET_NEXT: 'next-secret' })
    const req = createMockReq({ method: 'POST', headers: { 'x-cron-secret': 'next-secret' } })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runAlfaClubPrivyRefreshOnceMock).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without a matching cron secret', async () => {
    const req = createMockReq({ method: 'POST', headers: { 'x-cron-secret': 'wrong' } })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(runAlfaClubPrivyRefreshOnceMock).not.toHaveBeenCalled()
  })

  it('accepts Authorization: Bearer CRON_SECRET as an alternative', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runAlfaClubPrivyRefreshOnceMock).toHaveBeenCalledTimes(1)
  })

  it('also accepts GET so Vercel cron can invoke without a body', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runAlfaClubPrivyRefreshOnceMock).toHaveBeenCalledTimes(1)
  })

  it('forces refresh on every cron tick to avoid drifting past the 1h cliff', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(runAlfaClubPrivyRefreshOnceMock).toHaveBeenCalledWith({}, { force: true })
  })

  it('returns 200 with refreshed metadata on success and never leaks token material', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('refreshed')
    expect(res.body?.data?.identityTokenExp).toBe(
      new Date(1_800_000_000_000).toISOString(),
    )
    // Sanity-check no raw token fields slipped into the response
    const serialized = JSON.stringify(res.body)
    expect(serialized).not.toMatch(/access_token|refresh_token|identity_token|jwt/i)
  })

  it('returns 503 when bootstrap tokens are missing', async () => {
    runAlfaClubPrivyRefreshOnceMock.mockResolvedValueOnce({
      status: 'missing_tokens',
      missing: ['ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN'],
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.reason).toBe('missing_tokens')
    expect(res.body?.data?.missing).toContain('ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN')
  })

  it('returns 502 when Privy refresh fails', async () => {
    runAlfaClubPrivyRefreshOnceMock.mockResolvedValueOnce({
      status: 'error',
      error: 'privy_refresh_failed:401',
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(502)
    expect(res.body?.reason).toBe('refresh_failed')
    expect(res.body?.error).toBe('privy_refresh_failed:401')
  })

  it('returns 500 with a clipped message when the refresher throws', async () => {
    runAlfaClubPrivyRefreshOnceMock.mockRejectedValueOnce(new Error('boom'))
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body?.error).toBe('boom')
  })

  it('Cache-Control: no-store header is set', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await refreshHandler(req, res)
    expect(res.headerMap.get('cache-control')).toBe('no-store')
  })
})
