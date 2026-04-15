import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/agents/access-proof/_verify.ts'
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
  verifyAgentAccessProofSubmissionMock,
  issueAgentRoomAccessTokenMock,
  resolveMembershipForRoomMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  readJsonBodyMock: vi.fn(async () => ({})),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  guardAgentApiRequestMock: vi.fn(async () => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  verifyAgentAccessProofSubmissionMock: vi.fn(),
  issueAgentRoomAccessTokenMock: vi.fn(),
  resolveMembershipForRoomMock: vi.fn(),
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

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    agentAccessProofVerify: { windowMs: 60_000, maxRequests: 40 },
  },
}))

vi.mock('../../server/_lib/agent/agentAccessProof.js', () => ({
  verifyAgentAccessProofSubmission: verifyAgentAccessProofSubmissionMock,
  issueAgentRoomAccessToken: issueAgentRoomAccessTokenMock,
}))

vi.mock('../../server/_lib/agent/agentAccessResolver.js', () => ({
  resolveMembershipForRoom: resolveMembershipForRoomMock,
}))

const VALID_BODY = {
  schema: '4626-agent-access-proof-submit-v1',
  proofRequest: {
    schema: '4626-agent-access-proof-request-v1',
    wallet: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    chainId: 8453,
    shareToken: '0x1111111111111111111111111111111111111111',
    roomKey: 'xmtp:group_123',
    nonce: 'nonce-12345678',
    issuedAt: '2026-03-16T18:00:00.000Z',
    expiresAt: '2026-03-16T18:10:00.000Z',
    message: '4626 Access Proof\nWallet: 0x5b674196812451b7cec024fe9d22d2c0b172fa75',
  },
  signature: `0x${'a'.repeat(130)}`,
  signer: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
  tokenTtlMs: 1_800_000,
} as const

describe('v1/agents/access-proof/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 39, resetAt: Date.now() + 60_000 })
    readJsonBodyMock.mockResolvedValue(VALID_BODY)
    verifyAgentAccessProofSubmissionMock.mockResolvedValue({
      wallet: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      chainId: 8453,
      shareToken: '0x1111111111111111111111111111111111111111',
      roomKey: 'xmtp:group_123',
      signer: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      recoveredSigner: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })
    resolveMembershipForRoomMock.mockResolvedValue({
      type: 'xmtp',
      shareToken: '0x1111111111111111111111111111111111111111',
      vault: '0x2222222222222222222222222222222222222222',
      roomKey: 'xmtp:group_123',
      qualified: true,
      minBalance: '1',
      actualBalance: '4',
      accessTokenRequired: true,
      statusReason: 'qualified',
    })
    issueAgentRoomAccessTokenMock.mockResolvedValue({
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
    })
  })

  it('rejects malformed payloads', async () => {
    readJsonBodyMock.mockResolvedValue({ bad: true })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })

  it('returns 429 when verify rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
    expect(Number(res.getHeader('retry-after'))).toBeGreaterThan(0)
  })

  it('maps nonce replay failures to 401', async () => {
    verifyAgentAccessProofSubmissionMock.mockRejectedValueOnce(new Error('proof_nonce_invalid_or_used'))
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toContain('nonce')
  })

  it('maps expiry failures to 400', async () => {
    verifyAgentAccessProofSubmissionMock.mockRejectedValueOnce(new Error('proof_expired'))
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toContain('expired')
  })

  it('maps signature failures to 401', async () => {
    verifyAgentAccessProofSubmissionMock.mockRejectedValueOnce(new Error('proof_signature_invalid'))
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toContain('signature')
  })

  it('returns 403 when current eligibility is false', async () => {
    resolveMembershipForRoomMock.mockResolvedValueOnce({
      type: 'xmtp',
      shareToken: '0x1111111111111111111111111111111111111111',
      vault: '0x2222222222222222222222222222222222222222',
      roomKey: 'xmtp:group_123',
      qualified: false,
      minBalance: '1',
      actualBalance: '0',
      accessTokenRequired: true,
      statusReason: 'insufficient_balance',
    })
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toContain('Not currently qualified')
  })

  it('issues a room token on successful proof verification', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.proofVerified).toBe(true)
    expect(res.body?.data?.roomAccess?.schema).toBe('4626-agent-room-access-token-v1')
    expect(issueAgentRoomAccessTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        chainId: 8453,
        shareToken: '0x1111111111111111111111111111111111111111',
        roomKey: 'xmtp:group_123',
        ttlMs: 1_800_000,
      }),
    )
  })
})
