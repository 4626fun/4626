import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./solanaB2Readiness.js', () => ({
  verifySolanaB2Readiness: vi.fn(),
}))
vi.mock('./solanaLotteryEntryInbox.js', () => ({
  markInboxIdentity: vi.fn(),
}))
vi.mock('./solanaLotteryIdentity.js', () => ({
  resolveSolanaLotteryBeneficiary: vi.fn(),
}))
vi.mock('./solanaShareMeshMappings.js', () => ({
  resolveAppliedSolanaShareMeshMappingByMint: vi.fn(),
}))

import { verifySolanaB2Readiness } from './solanaB2Readiness.js'
import {
  markInboxIdentity,
  type SolanaLotteryInboxRow,
} from './solanaLotteryEntryInbox.js'
import { resolveSolanaLotteryBeneficiary } from './solanaLotteryIdentity.js'
import { prepareSolanaLotteryInboxForSubmit } from './solanaLotterySubmission.js'
import { resolveAppliedSolanaShareMeshMappingByMint } from './solanaShareMeshMappings.js'

const row = {
  id: 1,
  sourceEventId: 'g:p:s:0:0',
  clusterGenesisHash: 'g',
  programId: 'p',
  signature: 's',
  instructionIndex: 0,
  eventIndex: 0,
  instructionKind: 'buy_path',
  creatorMint: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
  buyerSolana: '9Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
  amountRaw: '100',
  slot: 1,
  blockTime: null,
  commitment: 'finalized',
  status: 'leased',
  beneficiaryCsw: null,
  profileId: null,
  shareOft: null,
  amountScaled: null,
  coverageShareBalance: '0',
  leaseOwner: 'worker-a',
  leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  leasedAt: new Date().toISOString(),
  quarantineReason: null,
  skipReason: null,
  lzGuid: null,
  baseTxHash: null,
  submittedAt: null,
  confirmedAt: null,
  submitAttemptId: null,
  attemptCount: 1,
  lastError: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies SolanaLotteryInboxRow

const mapping = {
  id: 1,
  creatorToken: '0x1111111111111111111111111111111111111111',
  shareOft: '0x2222222222222222222222222222222222222222',
  shareMeshMint: row.creatorMint,
  sourceSessionId: null,
  status: 'applied',
  applyAttemptCount: 1,
  lastError: null,
  appliedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as const

describe('prepareSolanaLotteryInboxForSubmit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(resolveAppliedSolanaShareMeshMappingByMint).mockResolvedValue(mapping)
    vi.mocked(verifySolanaB2Readiness).mockResolvedValue({
      ready: true,
      creatorToken: mapping.creatorToken,
      shareOft: mapping.shareOft,
      shareMeshMint: mapping.shareMeshMint,
      checks: [],
    })
    vi.mocked(resolveSolanaLotteryBeneficiary).mockResolvedValue({
      ok: true,
      buyerSolana: row.buyerSolana,
      profileId: 'profile-1',
      beneficiaryCsw: '0x3333333333333333333333333333333333333333',
      identityKind: 'parent_csw',
    })
    vi.mocked(markInboxIdentity).mockResolvedValue({
      ...row,
      beneficiaryCsw: '0x3333333333333333333333333333333333333333',
      profileId: 'profile-1',
      shareOft: mapping.shareOft,
      amountScaled: '100',
    })
  })

  it('binds only a ready B2 mint route to the unique parent CSW', async () => {
    const db = { sql: vi.fn() }
    await expect(prepareSolanaLotteryInboxForSubmit({
      db,
      row,
      leaseOwner: 'worker-a',
      amountScaled: '100',
    })).resolves.toMatchObject({
      beneficiaryCsw: '0x3333333333333333333333333333333333333333',
      shareOft: mapping.shareOft,
      coverageShareBalance: '0',
    })
    expect(markInboxIdentity).toHaveBeenCalledWith(expect.objectContaining({
      leaseOwner: 'worker-a',
      shareOft: mapping.shareOft,
    }))
  })

  it('fails closed when the event mint has no applied B2 route', async () => {
    vi.mocked(resolveAppliedSolanaShareMeshMappingByMint).mockResolvedValue(null)
    await expect(prepareSolanaLotteryInboxForSubmit({
      db: { sql: vi.fn() },
      row,
      leaseOwner: 'worker-a',
      amountScaled: '100',
    })).rejects.toThrow('solana_lottery_b2_mapping_missing')
  })

  it('fails closed when live B2 readiness or identity is unresolved', async () => {
    vi.mocked(verifySolanaB2Readiness).mockResolvedValue({
      ready: false,
      creatorToken: mapping.creatorToken,
      shareOft: mapping.shareOft,
      shareMeshMint: mapping.shareMeshMint,
      checks: [{ id: 'pool', passed: false, detail: 'missing' }],
    })
    await expect(prepareSolanaLotteryInboxForSubmit({
      db: { sql: vi.fn() },
      row,
      leaseOwner: 'worker-a',
      amountScaled: '100',
    })).rejects.toThrow('solana_lottery_b2_route_not_ready')

    vi.mocked(verifySolanaB2Readiness).mockResolvedValue({
      ready: true,
      creatorToken: mapping.creatorToken,
      shareOft: mapping.shareOft,
      shareMeshMint: mapping.shareMeshMint,
      checks: [],
    })
    vi.mocked(resolveSolanaLotteryBeneficiary).mockResolvedValue({
      ok: false,
      buyerSolana: row.buyerSolana,
      reason: 'ambiguous_mapping',
    })
    await expect(prepareSolanaLotteryInboxForSubmit({
      db: { sql: vi.fn() },
      row,
      leaseOwner: 'worker-a',
      amountScaled: '100',
    })).rejects.toThrow('solana_lottery_identity_ambiguous_mapping')
  })
})
