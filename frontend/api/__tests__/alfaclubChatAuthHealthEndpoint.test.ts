import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { readAlfaClubChatTokenMock, readAuthHealthSnapshotMock } = vi.hoisted(() => ({
  readAlfaClubChatTokenMock: vi.fn(),
  readAuthHealthSnapshotMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/chatTokenStore.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/chatTokenStore.ts')
  >('../../server/_lib/alfaclub/chatTokenStore.ts')
  return {
    ...actual,
    readAlfaClubChatToken: readAlfaClubChatTokenMock,
  }
})

vi.mock('../../server/_lib/alfaclub/authHealthStore.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/authHealthStore.ts')
  >('../../server/_lib/alfaclub/authHealthStore.ts')
  return {
    ...actual,
    readAuthHealthSnapshot: readAuthHealthSnapshotMock,
  }
})

import healthHandler from '../_handlers/v1/alfaclub/_chat-auth-health.ts'

describe('GET /api/v1/alfaclub/chat-auth-health', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ CRON_SECRET: 'test-cron-secret' })
    readAlfaClubChatTokenMock.mockResolvedValue({
      jwt: 'header.payload.sig',
      updatedAt: '2026-05-01T11:55:00.000Z',
      updatedBy: 'privy-token-refresher',
      expiresAt: '2026-05-01T13:00:00.000Z',
    })
    readAuthHealthSnapshotMock.mockResolvedValue({
      lastSuccess: {
        at: '2026-05-01T11:55:00.000Z',
        identityTokenExp: '2026-05-01T13:00:00.000Z',
        writer: 'privy-token-refresher',
        rotatedRefresh: false,
        writerAnomaly: { isAnomalous: false, reason: null, writer: 'privy-token-refresher' },
      },
      lastFailure: null,
      liveChatJwt: {
        writer: 'privy-token-refresher',
        writerAnomaly: { isAnomalous: false, reason: null, writer: 'privy-token-refresher' },
        expiresAt: '2026-05-01T13:00:00.000Z',
        minutesUntilExpiry: 60,
        updatedAt: '2026-05-01T11:55:00.000Z',
      },
      bridge: {
        lastAuthFailAt: null,
        consecutiveAuthFailures: 0,
        lastCfChallengeAt: '2026-05-02T23:53:48.000Z',
        consecutiveCfChallenges: 7,
        cfChallengeSustained: true,
        suppressedSocketAttempts: 11,
        socketBackoffMs: 16_000,
      },
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects POST with 405 (read-only)', async () => {
    const req = createMockReq({ method: 'POST', headers: { 'x-cron-secret': 'test-cron-secret' } })
    const res = createMockRes()
    await healthHandler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 503 when CRON_SECRET is not configured', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({})
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await healthHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(readAuthHealthSnapshotMock).not.toHaveBeenCalled()
  })

  it('returns 401 without a matching cron secret', async () => {
    const req = createMockReq({ method: 'GET', headers: { 'x-cron-secret': 'wrong' } })
    const res = createMockRes()
    await healthHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(readAuthHealthSnapshotMock).not.toHaveBeenCalled()
  })

  it('returns 200 with redacted snapshot on a valid cron secret', async () => {
    const req = createMockReq({ method: 'GET', headers: { 'x-cron-secret': 'test-cron-secret' } })
    const res = createMockRes()
    await healthHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.liveChatJwt?.writer).toBe('privy-token-refresher')
    expect(res.body?.data?.liveChatJwt?.minutesUntilExpiry).toBe(60)
    expect(res.body?.data?.lastSuccess?.identityTokenExp).toBe('2026-05-01T13:00:00.000Z')
    expect(res.body?.data?.bridge).toMatchObject({
      lastCfChallengeAt: '2026-05-02T23:53:48.000Z',
      consecutiveCfChallenges: 7,
      cfChallengeSustained: true,
    })
  })

  it('never echoes the chat_jwt token in the response body', async () => {
    readAlfaClubChatTokenMock.mockResolvedValueOnce({
      jwt: 'aaaa.bbbb.cccc-secret',
      updatedAt: '2026-05-01T11:55:00.000Z',
      updatedBy: 'privy-token-refresher',
      expiresAt: '2026-05-01T13:00:00.000Z',
    })
    const req = createMockReq({ method: 'GET', headers: { 'x-cron-secret': 'test-cron-secret' } })
    const res = createMockRes()
    await healthHandler(req, res)
    const serialized = JSON.stringify(res.body)
    expect(serialized).not.toContain('aaaa.bbbb.cccc-secret')
  })

  it('passes the cached chat_jwt expiry to readAuthHealthSnapshot, not the JWT', async () => {
    const req = createMockReq({ method: 'GET', headers: { 'x-cron-secret': 'test-cron-secret' } })
    const res = createMockRes()
    await healthHandler(req, res)
    expect(readAuthHealthSnapshotMock).toHaveBeenCalledTimes(1)
    const arg = readAuthHealthSnapshotMock.mock.calls[0]?.[0]
    expect(arg?.liveChatJwt?.jwt).toBeNull()
    expect(arg?.liveChatJwt?.expiresAtIso).toBe('2026-05-01T13:00:00.000Z')
  })

  it('surfaces an anomalous writer when the snapshot reports one', async () => {
    readAuthHealthSnapshotMock.mockResolvedValueOnce({
      lastSuccess: null,
      lastFailure: null,
      liveChatJwt: {
        writer: 'cursor-hermit-rotate',
        writerAnomaly: {
          isAnomalous: true,
          reason: 'legacy_in_process_refresher',
          writer: 'cursor-hermit-rotate',
        },
        expiresAt: '2026-05-01T13:00:00.000Z',
        minutesUntilExpiry: 60,
        updatedAt: '2026-05-01T11:55:00.000Z',
      },
      bridge: {
        lastAuthFailAt: null,
        consecutiveAuthFailures: 0,
        lastCfChallengeAt: null,
        consecutiveCfChallenges: 0,
        cfChallengeSustained: false,
        suppressedSocketAttempts: 0,
        socketBackoffMs: 0,
      },
    })
    const req = createMockReq({ method: 'GET', headers: { 'x-cron-secret': 'test-cron-secret' } })
    const res = createMockRes()
    await healthHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.liveChatJwt?.writerAnomaly?.isAnomalous).toBe(true)
    expect(res.body?.data?.liveChatJwt?.writerAnomaly?.reason).toBe('legacy_in_process_refresher')
  })
})
