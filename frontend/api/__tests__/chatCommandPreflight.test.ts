import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/chat/_commandPreflight.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getKeeprVaultByGroupIdMock,
  isKeeperWriteCommandTextMock,
  readSessionFromRequestMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
} = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
  isKeeperWriteCommandTextMock: vi.fn(),
  readSessionFromRequestMock: vi.fn(),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
}))

vi.mock('../../server/_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
}))

vi.mock('../../server/agents/eliza/plugins/keeperOps/index.js', () => ({
  isKeeperWriteCommandText: isKeeperWriteCommandTextMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
  RATE_LIMITS: {
    chatCommandPreflight: { windowMs: 60_000, maxRequests: 120 },
  },
}))

vi.mock('../../server/auth/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>('../../server/auth/_shared.js')
  return {
    ...actual,
    readSessionFromRequest: readSessionFromRequestMock,
  }
})

describe('POST /api/v1/chat/command-preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.HERMIT_ALLOWED_USERS
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 119, resetAt: Date.now() + 60_000 })
    isKeeperWriteCommandTextMock.mockReturnValue(false)
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      config: {
        roles: {
          admins: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
        },
      },
    })
    readSessionFromRequestMock.mockReturnValue({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
  })

  it('returns 429 when preflight rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('allows non-mutating commands', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/wallet',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.guardCategory).toBe('none')
  })

  it('denies pinata source when pinata allowlist is not configured', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        source: 'pinata',
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/wallet',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.reason).toBe('pinata_allowlist_not_configured')
    expect(res.body?.data?.guardCategory).toBe('pinata_access_denied')
  })

  it('denies pinata source when session user is not allowlisted', async () => {
    process.env.HERMIT_ALLOWED_USERS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const req = createMockReq({
      method: 'POST',
      body: {
        source: 'pinata',
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/wallet',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.reason).toBe('pinata_user_not_allowlisted')
    expect(res.body?.data?.guardCategory).toBe('pinata_access_denied')
  })

  it('allows pinata source when session user is allowlisted', async () => {
    process.env.HERMIT_ALLOWED_USERS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const req = createMockReq({
      method: 'POST',
      body: {
        source: 'pinata',
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/wallet',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.reason).toBe('read_or_non_mutating_command')
  })

  it('treats hermit as the pinata source alias', async () => {
    process.env.HERMIT_ALLOWED_USERS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const req = createMockReq({
      method: 'POST',
      body: {
        source: 'hermit',
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/wallet',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.reason).toBe('read_or_non_mutating_command')
  })

  it('rejects write preflight when sender wallet is missing', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('wallet_missing')
  })

  it('rejects write preflight when auth session is missing', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    readSessionFromRequestMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('auth_required')
  })

  it('rejects write preflight when sender wallet mismatches session wallet', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    readSessionFromRequestMock.mockReturnValueOnce({
      address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('wallet_session_mismatch')
  })

  it('rejects write preflight for member role', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    readSessionFromRequestMock.mockReturnValueOnce({
      address: '0xcccccccccccccccccccccccccccccccccccccccc',
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xcccccccccccccccccccccccccccccccccccccccc',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('role_denied')
  })

  it('allows keeper writes when role checks pass', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(true)
    expect(res.body?.data?.role).toBe('OWNER')
    expect(res.body?.data?.walletMatch).toBeNull()
  })

  it('fails closed when backend checks throw', async () => {
    isKeeperWriteCommandTextMock.mockReturnValueOnce(true)
    getKeeprVaultByGroupIdMock.mockRejectedValueOnce(new Error('db unavailable'))
    const req = createMockReq({
      method: 'POST',
      body: {
        conversationId: 'group-1',
        senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        command: '/keepr tend',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.allowed).toBe(false)
    expect(res.body?.data?.guardCategory).toBe('runtime_unavailable')
  })
})
