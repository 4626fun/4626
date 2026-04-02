import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/keepr/_join.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  handleOptionsMock,
  readJsonBodyMock,
  setCorsMock,
  setNoStoreMock,
  checkSharesEligibilityMock,
  getKeeprBaseRpcUrlsMock,
  enqueueKeeprActionMock,
  getKeeprVaultByVaultAddressMock,
  isKeeprJoinLockedMock,
  ensureKeeprSchemaMock,
  verifyKeeprJoinProofMock,
} = vi.hoisted(() => ({
  handleOptionsMock: vi.fn(() => false),
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  setCorsMock: vi.fn(),
  setNoStoreMock: vi.fn(),
  checkSharesEligibilityMock: vi.fn(),
  getKeeprBaseRpcUrlsMock: vi.fn(() => []),
  enqueueKeeprActionMock: vi.fn(),
  getKeeprVaultByVaultAddressMock: vi.fn(),
  isKeeprJoinLockedMock: vi.fn(),
  ensureKeeprSchemaMock: vi.fn(async () => {}),
  verifyKeeprJoinProofMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: handleOptionsMock,
  readJsonBody: readJsonBodyMock,
  setCors: setCorsMock,
  setNoStore: setNoStoreMock,
  getDb: vi.fn(async () => null),
}))

vi.mock('../../server/_lib/keeprGating.js', () => ({
  checkSharesEligibility: checkSharesEligibilityMock,
  getKeeprBaseRpcUrls: getKeeprBaseRpcUrlsMock,
}))

vi.mock('../../server/_lib/keeprRegistry.js', () => ({
  enqueueKeeprAction: enqueueKeeprActionMock,
  getKeeprVaultByVaultAddress: getKeeprVaultByVaultAddressMock,
  isKeeprJoinLocked: isKeeprJoinLockedMock,
}))

vi.mock('../../server/_lib/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../../server/_lib/keeprProof.js', () => ({
  verifyKeeprJoinProof: verifyKeeprJoinProofMock,
}))

describe('POST /api/keepr/join join lock enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyKeeprJoinProofMock.mockResolvedValue({
      wallet: '0x1111111111111111111111111111111111111111',
    })
    getKeeprVaultByVaultAddressMock.mockResolvedValue({
      vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chainId: 8453,
      groupId: 'xmtp:group-1',
      lensGroupAddress: null,
      creatorCoinAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      canonicalOwnerAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      shareTokenAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
      gatingEnabled: false,
      joinLocked: true,
      gatingMode: 'none',
      minShares: null,
      failClosed: true,
      configVersion: 1,
      configHash: 'hash',
      config: {},
    })
    isKeeprJoinLockedMock.mockReturnValue(true)
  })

  it('returns join_locked and skips queueing add-member actions', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        message: 'join me',
        signature: '0x1234',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.eligible).toBe(false)
    expect(res.body?.data?.reason).toBe('join_locked')
    expect(res.body?.data?.actionStatus).toBe('needs_user_setup')
    expect(checkSharesEligibilityMock).not.toHaveBeenCalled()
    expect(enqueueKeeprActionMock).not.toHaveBeenCalled()
  })
})
