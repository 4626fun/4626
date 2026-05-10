import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { runAlfaClubRadarMock, readAlfaClubRadarFlagsMock } = vi.hoisted(() => ({
  runAlfaClubRadarMock: vi.fn(),
  readAlfaClubRadarFlagsMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/radar.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/radar.ts')
  >('../../server/_lib/alfaclub/radar.ts')
  return {
    ...actual,
    runAlfaClubRadar: runAlfaClubRadarMock,
    readAlfaClubRadarFlags: readAlfaClubRadarFlagsMock,
  }
})

import radarHandler from '../_handlers/v1/alfaclub/_radar.ts'

const FLAGS = {
  killSwitch: false,
  enabled: true,
  telegramBotToken: 'bot-token',
  telegramChatId: '@fun4626',
  telegramThreadId: null,
  topN: 3,
  moversN: 2,
  minRankMove: 1,
  minScoreDelta: 0.02,
  forceSend: false,
}

describe('GET/POST /api/v1/alfaclub/radar', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    readAlfaClubRadarFlagsMock.mockReturnValue(FLAGS)
    runAlfaClubRadarMock.mockResolvedValue({
      ok: true,
      snapshotTs: '2026-04-20T12:00:00Z',
      previousSnapshotTs: '2026-04-19T12:00:00Z',
      sent: true,
      skippedDuplicate: false,
      highlighted: 2,
      topRows: 3,
      chatId: '@fun4626',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('requires cron auth', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await radarHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('accepts CRON_SECRET_NEXT when CRON_SECRET is empty', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({ CRON_SECRET: '', CRON_SECRET_NEXT: 'next-secret' })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'next-secret' },
    })
    const res = createMockRes()
    await radarHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runAlfaClubRadarMock).toHaveBeenCalledWith({ flags: FLAGS })
  })

  it('runs radar when authorized', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await radarHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.sent).toBe(true)
    expect(runAlfaClubRadarMock).toHaveBeenCalledWith({ flags: FLAGS })
  })

  it('returns 202 for non-fatal skip reasons', async () => {
    runAlfaClubRadarMock.mockResolvedValueOnce({
      ok: false,
      reason: 'no_snapshot',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      highlighted: 0,
      topRows: 0,
      chatId: '@fun4626',
    })
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = createMockRes()
    await radarHandler(req, res)
    expect(res.statusCode).toBe(202)
    expect(res.body?.reason).toBe('no_snapshot')
  })
})
