import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_lens-points-sync.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readRequestPrincipalAddressMock,
  getDbMock,
  ensureWaitlistSchemaMock,
  isAuthorizedWalletForProfileMock,
  resolveLensUserByOwnerMock,
  tryUploadImmutableJsonMock,
  awardWaitlistPointsMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readRequestPrincipalAddressMock: vi.fn(() => '0x0000000000000000000000000000000000000001'),
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  isAuthorizedWalletForProfileMock: vi.fn(async () => true),
  resolveLensUserByOwnerMock: vi.fn(async () => ({
    handle: 'akita.base',
    username: 'akita',
    displayName: 'Akita',
    accountAddress: '0x00000000000000000000000000000000000000aa',
    ownerAddress: '0x0000000000000000000000000000000000000001',
    avatar: null,
  })),
  tryUploadImmutableJsonMock: vi.fn(async () => ({
    ok: true,
    result: { lensUri: 'grove://lens/snapshot/123' },
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

vi.mock('../../server/_lib/lensAccounts.js', () => ({
  resolveLensUserByOwner: resolveLensUserByOwnerMock,
}))

vi.mock('../../server/_lib/lensGrove.js', () => ({
  getGroveChainId: vi.fn(() => 8453),
  tryUploadImmutableJson: tryUploadImmutableJsonMock,
}))

vi.mock('../../server/_lib/waitlistPoints.js', () => ({
  WAITLIST_POINTS: { lensIdentity: 80, groveProof: 40 },
  awardWaitlistPoints: awardWaitlistPointsMock,
}))

describe('waitlist/lens-points-sync hardening', () => {
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
              },
            ],
          }
        }
        return { rows: [] }
      }),
    } as any)
  })

  it('uses a stable grove_proof source ID independent of grove URI churn', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: 'creator@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(awardWaitlistPointsMock).toHaveBeenCalledTimes(2)
    expect(awardWaitlistPointsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'grove_proof',
        sourceId: 'lens:0x00000000000000000000000000000000000000aa:grove',
      }),
    )
    expect(awardWaitlistPointsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'lens_identity',
        sourceId: 'lens:0x00000000000000000000000000000000000000aa',
      }),
    )
  })
})
