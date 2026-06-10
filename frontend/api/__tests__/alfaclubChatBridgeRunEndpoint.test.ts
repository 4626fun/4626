import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { runAlfaClubChatBridgeTickOnceMock } = vi.hoisted(() => ({
  runAlfaClubChatBridgeTickOnceMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/chatBridge.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/alfaclub/chatBridge.ts')>(
    '../../server/_lib/alfaclub/chatBridge.ts',
  )
  return {
    ...actual,
    runAlfaClubChatBridgeTickOnce: runAlfaClubChatBridgeTickOnceMock,
  }
})

import runHandler from '../_handlers/v1/alfaclub/_chat-bridge-run.ts'

describe('POST /api/v1/alfaclub/chat-bridge-run', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    runAlfaClubChatBridgeTickOnceMock.mockResolvedValue({
      ok: true,
      intervalMs: 6000,
      roomId: '1043',
      data: {
        seeded: false,
        roomId: '1043',
        fetched: 1,
        unseen: 1,
        processed: 1,
        replied: 1,
        errors: [],
      },
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
    restoreEnv = applyEnv({ CRON_SECRET: undefined })
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
    expect(runAlfaClubChatBridgeTickOnceMock).toHaveBeenCalledTimes(1)
  })

  it('returns 503 when bridge tick is skipped by kill switch', async () => {
    runAlfaClubChatBridgeTickOnceMock.mockResolvedValueOnce({
      ok: false,
      reason: 'kill_switch',
      intervalMs: 6000,
      roomId: '1043',
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.reason).toBe('kill_switch')
  })

  it('returns 202 when bridge tick is skipped for disabled/env_missing', async () => {
    runAlfaClubChatBridgeTickOnceMock.mockResolvedValueOnce({
      ok: false,
      reason: 'disabled',
      intervalMs: 6000,
      roomId: null,
    })
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(202)
    expect(res.body?.success).toBe(false)
    expect(res.body?.reason).toBe('disabled')
  })

  it('returns 200 with tick report when authorized', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.tick?.processed).toBe(1)
  })

  it('also accepts GET so Vercel cron can invoke without a body', async () => {
    const req = createMockReq({
      method: 'GET',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    const res = createMockRes()
    await runHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(runAlfaClubChatBridgeTickOnceMock).toHaveBeenCalledTimes(1)
  })
})
