import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_task-claim.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  readRequestPrincipalAddressMock,
  awardWaitlistPointsMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  awardWaitlistPointsMock: vi.fn(async () => {}),
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

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  WAITLIST_POINTS: { github: 40, tiktok: 25, instagram: 25, reddit: 20 },
  awardWaitlistPoints: awardWaitlistPointsMock,
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

describe('waitlist/task-claim hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb() as any)
  })

  it('rejects non-bonus tasks and requires verifier endpoints', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: 'user@example.com', taskKey: 'farcaster' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('platform verification')
    expect(awardWaitlistPointsMock).not.toHaveBeenCalled()
  })

  it('awards bonus tasks for authorized profile owner', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: 'user@example.com', taskKey: 'github' },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.awarded).toBe(true)
    expect(res.body?.data?.taskKey).toBe('github')
    expect(awardWaitlistPointsMock).toHaveBeenCalledTimes(1)
    const [firstArg] = (awardWaitlistPointsMock.mock.calls[0] ?? []) as [Record<string, unknown>?]
    expect(firstArg).toMatchObject({
      signupId: 1,
      source: 'bonus_github',
      sourceId: 'github',
      amount: 40,
    })
  })
})
