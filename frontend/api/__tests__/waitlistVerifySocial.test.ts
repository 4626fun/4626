import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  isAuthorizedWalletForProfileMock,
  readRequestPrincipalAddressMock,
  awardWaitlistPointsMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getClientIpMock,
  readNeynarApiKeyMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  isAuthorizedWalletForProfileMock: vi.fn(async () => true),
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  awardWaitlistPointsMock: vi.fn(async () => {}),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'rl-key'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  readNeynarApiKeyMock: vi.fn(() => null),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  isAuthorizedWalletForProfile: isAuthorizedWalletForProfileMock,
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/neynarConfig.js', () => ({
  readNeynarApiKey: readNeynarApiKeyMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  WAITLIST_POINTS: { farcaster: 100, discord: 25, telegram: 25 },
  awardWaitlistPoints: awardWaitlistPointsMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('from profiles') && text.includes('where email')) {
        return {
          rows: [
            {
              id: 1,
              farcaster_fid: null,
              primary_wallet: '0x00000000000000000000000000000000000000aa',
              embedded_wallet: null,
              csw_address: null,
            },
          ],
        }
      }
      return { rows: [] }
    }),
  }
}

describe('waitlist/verify-social telegram membership', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    if (restoreEnv) restoreEnv()
    restoreEnv = applyEnv({
      TELEGRAM_BOT_TOKEN: 'test-telegram-bot-token',
      TELEGRAM_WAITLIST_VERIFY_CHAT_ID: '-100123',
    })
    getDbMock.mockResolvedValue(createDb() as any)
  })

  it('verifies telegram membership via Bot API and awards points', async () => {
    const { default: handler } = await import('../_handlers/waitlist/_verify-social.ts')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { status: 'member' } }),
      })),
    )

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'user@example.com',
        platform: 'telegram',
        telegramUserId: '42',
      },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.verified).toBe(true)
    expect(res.body?.data?.awarded).toBe(true)
    expect(awardWaitlistPointsMock).toHaveBeenCalledTimes(1)
  })

  it('fails verification when telegram membership status is left', async () => {
    const { default: handler } = await import('../_handlers/waitlist/_verify-social.ts')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { status: 'left' } }),
      })),
    )

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'user@example.com',
        platform: 'telegram',
        telegramUserId: '42',
      },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.verified).toBe(false)
    expect(res.body?.data?.awarded).toBe(false)
    expect(awardWaitlistPointsMock).not.toHaveBeenCalled()
  })
})
