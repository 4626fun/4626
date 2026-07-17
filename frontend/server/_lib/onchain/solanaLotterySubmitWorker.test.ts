import { beforeEach, describe, expect, it, vi } from 'vitest'

const claimMock = vi.fn()
const prepareMock = vi.fn()
const beginMock = vi.fn()
const submittedMock = vi.fn()
const skipIdentityMock = vi.fn()
const skipPricingMock = vi.fn()
const quarantineMock = vi.fn()
const releaseMock = vi.fn()
const readinessMock = vi.fn()

vi.mock('./solanaLotteryEntryInbox.js', () => ({
  claimSolanaLotteryInboxLeases: (...args: unknown[]) => claimMock(...args),
  beginInboxSubmit: (...args: unknown[]) => beginMock(...args),
  markInboxSubmitted: (...args: unknown[]) => submittedMock(...args),
  markInboxSkippedIdentity: (...args: unknown[]) => skipIdentityMock(...args),
  markInboxSkippedPricing: (...args: unknown[]) => skipPricingMock(...args),
  markInboxQuarantined: (...args: unknown[]) => quarantineMock(...args),
  releaseInboxLease: (...args: unknown[]) => releaseMock(...args),
}))

vi.mock('./solanaLotterySubmission.js', () => ({
  prepareSolanaLotteryInboxForSubmit: (...args: unknown[]) => prepareMock(...args),
}))

vi.mock('./solanaLotteryLzTransport.js', () => ({
  assessSolanaLotteryLzTransportReadiness: (...args: unknown[]) => readinessMock(...args),
  submitSolanaLotteryEntryViaLz: vi.fn(),
}))

import { processSolanaLotteryInboxSubmitBatch } from './solanaLotterySubmitWorker.js'

const leasedRow = {
  id: 7,
  sourceEventId: 'g:p:sig:0:0',
  status: 'leased',
  instructionKind: 'buy_path',
  creatorMint: 'ShareMesh111111111111111111111111111111111',
  buyerSolana: '7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY',
  amountRaw: '100',
  beneficiaryCsw: null,
  shareOft: null,
  amountScaled: null,
}

describe('processSolanaLotteryInboxSubmitBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readinessMock.mockReturnValue({ ready: true, reasons: [] })
  })

  it('wires prepare → begin → send → mark submitted', async () => {
    claimMock.mockResolvedValue([leasedRow])
    prepareMock.mockResolvedValue({
      ...leasedRow,
      beneficiaryCsw: '0x1111111111111111111111111111111111111111',
      shareOft: '0x2222222222222222222222222222222222222222',
      amountScaled: '100',
    })
    beginMock.mockResolvedValue({
      ...leasedRow,
      status: 'submitting',
      beneficiaryCsw: '0x1111111111111111111111111111111111111111',
      shareOft: '0x2222222222222222222222222222222222222222',
      amountScaled: '100',
      submitAttemptId: 'attempt-1',
    })
    submittedMock.mockResolvedValue({ ...leasedRow, status: 'submitted' })

    const submit = vi.fn(async () => ({
      ok: true as const,
      lzGuid: 'guid-1',
      baseTxHash: null,
      payload: '0x' as `0x${string}`,
    }))

    const result = await processSolanaLotteryInboxSubmitBatch({
      db: { sql: vi.fn() } as any,
      leaseOwner: 'worker-a',
      submit,
    })

    expect(prepareMock).toHaveBeenCalled()
    expect(beginMock).toHaveBeenCalled()
    expect(submit).toHaveBeenCalledWith({
      sourceEventId: 'g:p:sig:0:0',
      buyer: '0x1111111111111111111111111111111111111111',
      tokenIn: '0x2222222222222222222222222222222222222222',
      amount: 100n,
    })
    expect(submittedMock).toHaveBeenCalled()
    expect(result.submitted).toBe(1)
  })

  it('skips identity failures through prepareSolanaLotteryInboxForSubmit', async () => {
    claimMock.mockResolvedValue([leasedRow])
    prepareMock.mockRejectedValue(new Error('solana_lottery_identity_missing_mapping'))
    skipIdentityMock.mockResolvedValue({ ...leasedRow, status: 'skipped_identity' })

    const result = await processSolanaLotteryInboxSubmitBatch({
      db: { sql: vi.fn() } as any,
      leaseOwner: 'worker-a',
      submit: vi.fn(),
    })

    expect(skipIdentityMock).toHaveBeenCalled()
    expect(result.skippedIdentity).toBe(1)
    expect(result.submitted).toBe(0)
  })
})
