import { beforeEach, describe, expect, it, vi } from 'vitest'

import telegramJoinHandler from '../_handlers/v1/agents/telegram/_join.ts'
import xmtpJoinHandler from '../_handlers/v1/agents/xmtp/_join.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  handleOptionsMock,
  readJsonBodyMock,
  setCorsMock,
  setNoStoreMock,
  guardAgentApiRequestMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  verifyAgentRoomAccessTokenMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  readJsonBodyMock: vi.fn(async () => ({ accessToken: '4626aat.v1.payload.signature' })),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  guardAgentApiRequestMock: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  verifyAgentRoomAccessTokenMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: handleOptionsMock,
  readBoundedJsonObjectBody: readJsonBodyMock,
  readJsonBody: readJsonBodyMock,
  setCors: setCorsMock,
  setNoStore: setNoStoreMock,
}))

vi.mock('../../server/_lib/agent/agentApiGuard.js', () => ({
  guardAgentApiRequest: guardAgentApiRequestMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    agentAccessJoin: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/agent/agentAccessProof.js', () => ({
  verifyAgentRoomAccessToken: verifyAgentRoomAccessTokenMock,
}))

describe('agent access join handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })
  })

  it('returns 429 with retry-after when join rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await xmtpJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('returns XMTP join instructions for valid xmtp tokens', async () => {
    verifyAgentRoomAccessTokenMock.mockResolvedValueOnce({
      ok: true,
      token: {
        schema: '4626-agent-room-access-token-v1',
        sub: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        chainId: 8453,
        shareToken: '0x1111111111111111111111111111111111111111',
        roomKey: 'xmtp:group_123',
        issuedAt: '2026-03-16T18:00:00.000Z',
        expiresAt: '2026-03-16T18:30:00.000Z',
        accessToken: '4626aat.v1.payload.signature',
        tokenType: 'bearer',
        capabilities: ['join', 'read'],
        jti: 'nonce-abc',
      },
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await xmtpJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.instructions?.action).toBe('xmtp.group.add_member')
  })

  it('rejects tokens scoped to non-xmtp room keys on xmtp endpoint', async () => {
    verifyAgentRoomAccessTokenMock.mockResolvedValueOnce({
      ok: true,
      token: {
        schema: '4626-agent-room-access-token-v1',
        sub: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        chainId: 8453,
        shareToken: '0x1111111111111111111111111111111111111111',
        roomKey: 'telegram:-100123',
        issuedAt: '2026-03-16T18:00:00.000Z',
        expiresAt: '2026-03-16T18:30:00.000Z',
        accessToken: '4626aat.v1.payload.signature',
        tokenType: 'bearer',
        capabilities: ['join', 'read'],
        jti: 'nonce-abc',
      },
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await xmtpJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toContain('XMTP')
  })

  it('rejects telegram joins when token lacks join capability', async () => {
    verifyAgentRoomAccessTokenMock.mockResolvedValueOnce({
      ok: true,
      token: {
        schema: '4626-agent-room-access-token-v1',
        sub: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        chainId: 8453,
        shareToken: '0x1111111111111111111111111111111111111111',
        roomKey: 'telegram:-100123',
        issuedAt: '2026-03-16T18:00:00.000Z',
        expiresAt: '2026-03-16T18:30:00.000Z',
        accessToken: '4626aat.v1.payload.signature',
        tokenType: 'bearer',
        capabilities: ['read'],
        jti: 'nonce-abc',
      },
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await telegramJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toContain('join capability')
  })

  it('rejects invalid room tokens', async () => {
    verifyAgentRoomAccessTokenMock.mockResolvedValueOnce({
      ok: false,
      error: 'token_signature_invalid',
    })

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await telegramJoinHandler(req as any, res as any)
    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('token_signature_invalid')
  })
})
