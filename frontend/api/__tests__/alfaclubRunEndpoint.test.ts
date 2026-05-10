import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { runVigilanteMock, readVigilanteFlagsMock } = vi.hoisted(() => ({
  runVigilanteMock: vi.fn(),
  readVigilanteFlagsMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/vigilante.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/vigilante.ts')
  >('../../server/_lib/alfaclub/vigilante.ts')
  return {
    ...actual,
    runVigilante: runVigilanteMock,
    readVigilanteFlags: readVigilanteFlagsMock,
  }
})

import runHandler from '../_handlers/v1/alfaclub/_run.ts'

const BASE_FLAGS = {
  killSwitch: false,
  readEnabled: true,
  postEnabled: false,
  feedbackEnabled: false,
  topN: 5,
  cooldownHours: 24,
}

describe('POST /api/v1/alfaclub/run', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    readVigilanteFlagsMock.mockReturnValue(BASE_FLAGS)
    runVigilanteMock.mockResolvedValue({
      ok: true,
      flags: BASE_FLAGS,
      snapshotTs: '2026-04-20T12:00:00Z',
      windowStart: '2026-04-20T00:00:00Z',
      indexedNewCreators: 0,
      rankedCreators: 1,
      topN: BASE_FLAGS.topN,
      publications: [],
      signerAddress: null,
      durationMs: 10,
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects unsupported methods with 405', async () => {
    const req = createMockReq({ method: 'PUT' })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 503 when CRON_SECRET is not configured', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({})
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('CRON_SECRET is not configured')
  })

  it('returns 401 without a matching cron secret', async () => {
    const req = createMockReq({ method: 'POST', headers: { 'x-cron-secret': 'wrong' } })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('accepts Authorization: Bearer CRON_SECRET as an alternative', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runVigilanteMock).toHaveBeenCalledTimes(1)
  })

  it('short-circuits with 503 when kill switch is on (without invoking runVigilante)', async () => {
    readVigilanteFlagsMock.mockReturnValue({ ...BASE_FLAGS, killSwitch: true })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.reason).toBe('kill_switch')
    expect(runVigilanteMock).not.toHaveBeenCalled()
  })

  it('returns 200 with the run report when authorized', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.rankedCreators).toBe(1)
  })

  it('returns 202 when runVigilante returns ok:false with a skip reason', async () => {
    runVigilanteMock.mockResolvedValueOnce({
      ok: false,
      reason: 'no_creators',
      flags: BASE_FLAGS,
      snapshotTs: '2026-04-20T12:00:00Z',
      windowStart: '2026-04-20T00:00:00Z',
      indexedNewCreators: null,
      rankedCreators: 0,
      topN: BASE_FLAGS.topN,
      publications: [],
      signerAddress: null,
      durationMs: 5,
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(202)
    expect(res.body?.success).toBe(false)
    expect(res.body?.reason).toBe('no_creators')
  })

  it('also accepts GET so Vercel cron can invoke without a body', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runVigilanteMock).toHaveBeenCalledTimes(1)
  })
})
