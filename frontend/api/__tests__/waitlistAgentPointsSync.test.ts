import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_agent-points-sync.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readRequestPrincipalAddressMock,
  getDbMock,
  ensureWaitlistSchemaMock,
  isAuthorizedWalletForProfileMock,
  buildReputationGraphMock,
  awardWaitlistPointsMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readRequestPrincipalAddressMock: vi.fn(() => '0x0000000000000000000000000000000000000001'),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  isAuthorizedWalletForProfileMock: vi.fn(async () => true),
  buildReputationGraphMock: vi.fn(async () => ({
    summary: { totalFeedback: 5, averageValue: 4.2 },
  })),
  awardWaitlistPointsMock: vi.fn(async () => {}),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
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

vi.mock('../../server/_lib/reputationGraph.js', () => ({
  buildReputationGraph: buildReputationGraphMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  WAITLIST_POINTS: { agentFeedback: 20, agentReputation: 200 },
  awardWaitlistPoints: awardWaitlistPointsMock,
}))

describe('waitlist/agent-points-sync hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('select id, primary_wallet')) {
          return {
            rows: [
              {
                id: 42,
                primary_wallet: '0x0000000000000000000000000000000000000001',
                embedded_wallet: null,
                csw_address: null,
                erc8004_agent_id: 123,
              },
            ],
          }
        }
        return { rows: [] }
      }),
    } as any)
  })

  it('rejects body agentId override when it does not match profile-linked agent', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'creator@example.com',
        agentId: 999,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('must match the profile-linked agent')
    expect(awardWaitlistPointsMock).not.toHaveBeenCalled()
  })

  it('uses stable idempotent source IDs for feedback and reputation awards', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'creator@example.com',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(awardWaitlistPointsMock).toHaveBeenCalledTimes(2)
    expect(awardWaitlistPointsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        source: 'agent_feedback',
        sourceId: 'agent:123:feedback',
      }),
    )
    expect(awardWaitlistPointsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        source: 'agent_reputation',
        sourceId: 'agent:123:reputation',
      }),
    )
  })
})
