import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { runAlfaClubDailyBriefMock, readAlfaClubDailyBriefFlagsMock } = vi.hoisted(() => ({
  runAlfaClubDailyBriefMock: vi.fn(),
  readAlfaClubDailyBriefFlagsMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/dailyBrief.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/dailyBrief.ts')
  >('../../server/_lib/alfaclub/dailyBrief.ts')
  return {
    ...actual,
    runAlfaClubDailyBrief: runAlfaClubDailyBriefMock,
    readAlfaClubDailyBriefFlags: readAlfaClubDailyBriefFlagsMock,
  }
})

import dailyBriefHandler from '../_handlers/v1/alfaclub/_daily-brief.ts'

const FLAGS = {
  enabled: true,
  roomId: '1043',
  topRows: 5,
  moverRows: 5,
  majorRows: 6,
  compact: true,
  forceSend: false,
  marketTimeoutMs: 12000,
}

describe('GET/POST /api/v1/alfaclub/daily-brief', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    readAlfaClubDailyBriefFlagsMock.mockReturnValue(FLAGS)
    runAlfaClubDailyBriefMock.mockResolvedValue({
      ok: true,
      snapshotTs: '2026-05-15T12:00:00Z',
      previousSnapshotTs: '2026-05-14T12:00:00Z',
      sent: true,
      skippedDuplicate: false,
      roomId: '1043',
      lane: 'bot_token_without_reply_id',
      messageText: '**Daily AlfaClub Brief**',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('requires cron auth', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await dailyBriefHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('runs the daily brief when authorized', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await dailyBriefHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(runAlfaClubDailyBriefMock).toHaveBeenCalledWith({ flags: FLAGS })
  })

  it('returns 202 for non-fatal no-snapshot skips', async () => {
    runAlfaClubDailyBriefMock.mockResolvedValueOnce({
      ok: false,
      reason: 'no_snapshot',
      snapshotTs: null,
      previousSnapshotTs: null,
      sent: false,
      skippedDuplicate: false,
      roomId: '1043',
      lane: null,
      messageText: null,
    })
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer test-cron-secret' },
    })
    const res = createMockRes()
    await dailyBriefHandler(req, res)
    expect(res.statusCode).toBe(202)
    expect(res.body?.reason).toBe('no_snapshot')
  })
})
