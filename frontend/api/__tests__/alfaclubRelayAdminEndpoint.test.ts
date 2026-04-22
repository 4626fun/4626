import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  relayAlfaClubFeedbackOnceMock,
  getSessionAddressMock,
  isAdminAddressMock,
} = vi.hoisted(() => ({
  relayAlfaClubFeedbackOnceMock: vi.fn(),
  getSessionAddressMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/feedbackRelayer.js', () => ({
  relayAlfaClubFeedbackOnce: relayAlfaClubFeedbackOnceMock,
}))

vi.mock('../../server/_lib/auth/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

import relayNowHandler from '../_handlers/v1/alfaclub/_relay-now.ts'

const ADMIN_ADDR = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`

function defaultResult() {
  return {
    picked: 1,
    submitted: 0,
    failed: 0,
    abandoned: 0,
    skipped: null,
    txHashes: [],
    errors: [],
    dryRun: true,
    ownerAddress: '0xceca13f2686ed061c57620ecdf67e1b8c0f285e9',
    ownerIndex: 2,
    durationMs: 15,
  }
}

describe('POST /api/v1/alfaclub/relay-now', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ AUTH_SESSION_SECRET: 'test-auth-session-secret-1234567' })
    relayAlfaClubFeedbackOnceMock.mockResolvedValue(defaultResult())
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects non-POST methods with 405', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await relayNowHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(relayAlfaClubFeedbackOnceMock).not.toHaveBeenCalled()
  })

  it('returns 401 when there is no session', async () => {
    getSessionAddressMock.mockReturnValue(null)
    const req = createMockReq({ method: 'POST', body: { dryRun: true } })
    const res = createMockRes()
    await relayNowHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(relayAlfaClubFeedbackOnceMock).not.toHaveBeenCalled()
  })

  it('returns 403 when the session address is not an admin', async () => {
    getSessionAddressMock.mockReturnValue(ADMIN_ADDR)
    isAdminAddressMock.mockReturnValue(false)
    const req = createMockReq({ method: 'POST', body: { dryRun: true } })
    const res = createMockRes()
    await relayNowHandler(req, res)
    expect(res.statusCode).toBe(403)
    expect(relayAlfaClubFeedbackOnceMock).not.toHaveBeenCalled()
  })

  it('invokes relayAlfaClubFeedbackOnce with dryRun and capped maxPerTick', async () => {
    getSessionAddressMock.mockReturnValue(ADMIN_ADDR)
    isAdminAddressMock.mockReturnValue(true)
    const req = createMockReq({
      method: 'POST',
      body: { dryRun: true, maxPerTick: 999 },
      rawBody: JSON.stringify({ dryRun: true, maxPerTick: 999 }),
    })
    const res = createMockRes()
    await relayNowHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(relayAlfaClubFeedbackOnceMock).toHaveBeenCalledTimes(1)
    const call = relayAlfaClubFeedbackOnceMock.mock.calls[0]?.[0] as {
      dryRun?: boolean
      maxPerTick?: number
    }
    expect(call?.dryRun).toBe(true)
    expect(call?.maxPerTick).toBe(10) // clamp ceiling
  })

  it('clamps maxPerTick below 1 up to 1', async () => {
    getSessionAddressMock.mockReturnValue(ADMIN_ADDR)
    isAdminAddressMock.mockReturnValue(true)
    const req = createMockReq({
      method: 'POST',
      body: { dryRun: false, maxPerTick: 0 },
      rawBody: JSON.stringify({ dryRun: false, maxPerTick: 0 }),
    })
    const res = createMockRes()
    await relayNowHandler(req, res)
    const call = relayAlfaClubFeedbackOnceMock.mock.calls[0]?.[0] as {
      dryRun?: boolean
      maxPerTick?: number
    }
    expect(call?.maxPerTick).toBe(1)
    expect(call?.dryRun).toBe(false)
  })

  it('returns 200 with the relayer report and disclaimer', async () => {
    getSessionAddressMock.mockReturnValue(ADMIN_ADDR)
    isAdminAddressMock.mockReturnValue(true)
    const result = { ...defaultResult(), submitted: 1, txHashes: ['0xdead'] }
    relayAlfaClubFeedbackOnceMock.mockResolvedValue(result)
    const req = createMockReq({ method: 'POST', body: { dryRun: false } })
    const res = createMockRes()
    await relayNowHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.submitted).toBe(1)
    expect(res.body?.disclaimer).toContain('4626 Keepr onchain-derived snapshot')
  })

  it('returns 500 when the relayer throws', async () => {
    getSessionAddressMock.mockReturnValue(ADMIN_ADDR)
    isAdminAddressMock.mockReturnValue(true)
    relayAlfaClubFeedbackOnceMock.mockRejectedValue(new Error('boom'))
    const req = createMockReq({ method: 'POST', body: { dryRun: true } })
    const res = createMockRes()
    await relayNowHandler(req, res)
    expect(res.statusCode).toBe(500)
    expect(res.body?.success).toBe(false)
  })
})
