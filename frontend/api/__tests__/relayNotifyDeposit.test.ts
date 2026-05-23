import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock, notifyRelaySolverDepositMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  notifyRelaySolverDepositMock: vi.fn(async () => ({
    indexed: true,
    sameChainSingle: false,
    warnings: [] as string[],
  })),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: { body?: unknown }) => req.body ?? null),
  checkRateLimit: checkRateLimitMock,
  RATE_LIMITS: { creatorQuickstart: { windowMs: 60_000, maxRequests: 100 } },
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  getClientIp: vi.fn(() => '203.0.113.42'),
}))

vi.mock('../../server/_lib/relay/notifyRelaySolverDeposit.js', () => ({
  notifyRelaySolverDeposit: notifyRelaySolverDepositMock,
}))

describe('POST /api/relay/notify-deposit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('parses readJsonBody object responses and wakes Relay index', async () => {
    const { default: handler } = await import('../_handlers/relay/_notify-deposit.js')
    const req = createMockReq({
      method: 'POST',
      body: {
        chainId: 8453,
        depositTxHash: '0x' + 'aa'.repeat(32),
        indexRequestIds: ['0x' + 'bb'.repeat(32)],
        userCall: {
          to: '0x4cd00e387622c35bddb9b4c962c136462338bc31',
          data: '0x49290c1c' + '00'.repeat(32),
          value: '0x10',
        },
        referrer: '4626-add-owner',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(notifyRelaySolverDepositMock).toHaveBeenCalledOnce()
  })
})
