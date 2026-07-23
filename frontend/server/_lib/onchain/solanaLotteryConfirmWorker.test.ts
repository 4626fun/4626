import { beforeEach, describe, expect, it, vi } from 'vitest'

const listMock = vi.fn()
const confirmedMock = vi.fn()
const failedMock = vi.fn()
const retryableMock = vi.fn()
const receiptMock = vi.fn()
vi.mock('./solanaLotteryEntryInbox.js', () => ({
  listSubmittedSolanaLotteryInboxRows: (...args: unknown[]) => listMock(...args),
  markInboxConfirmed: (...args: unknown[]) => confirmedMock(...args),
  markSubmittedInboxFailed: (...args: unknown[]) => failedMock(...args),
  markSubmittedInboxRetryable: (...args: unknown[]) => retryableMock(...args),
}))
vi.mock('./solanaLotteryLzReceipt.js', () => ({
  readSolanaLotteryLzReceipt: (...args: unknown[]) => receiptMock(...args),
}))

import { confirmSolanaLotteryInboxBatch } from './solanaLotteryConfirmWorker.js'

const row = {
  id: 1, sourceEventId: 'g:p:s:0:0', lzGuid: `0x${'ab'.repeat(32)}`,
  transportSourceTxHash: '2'.repeat(64),
}

describe('confirmSolanaLotteryInboxBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.SOLANA_LOTTERY_OAPP_PROGRAM_ID = '8XdQnMpcRBfNTM8KAQfoz4QVCrYz6BS1LTr7E54ofRtC'
    listMock.mockResolvedValue([row])
  })

  it('marks a delivered receipt confirmed with its Base transaction', async () => {
    receiptMock.mockResolvedValue({ state: 'confirmed', status: 'DELIVERED', baseTxHash: `0x${'cd'.repeat(32)}` })
    await expect(confirmSolanaLotteryInboxBatch({ db: { sql: vi.fn() } as any }))
      .resolves.toMatchObject({ checked: 1, confirmed: 1, retryable: 0, failed: 0, pending: 0 })
    expect(confirmedMock).toHaveBeenCalledWith(expect.objectContaining({ id: 1, baseTxHash: `0x${'cd'.repeat(32)}` }))
    expect(receiptMock).toHaveBeenCalledWith(expect.objectContaining({ senderBytes32: expect.stringMatching(/^0x[0-9a-f]{64}$/) }))
  })

  it('quarantines terminal failures and leaves inflight receipts pending', async () => {
    receiptMock.mockResolvedValueOnce({ state: 'terminal_failed', status: 'APPLICATION_BURNED', baseTxHash: null, reason: 'burned' })
    await expect(confirmSolanaLotteryInboxBatch({ db: { sql: vi.fn() } as any }))
      .resolves.toMatchObject({ failed: 1 })
    expect(failedMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'layerzero_APPLICATION_BURNED:burned' }))

    receiptMock.mockResolvedValueOnce({ state: 'pending', status: 'INFLIGHT', baseTxHash: null })
    await expect(confirmSolanaLotteryInboxBatch({ db: { sql: vi.fn() } as any }))
      .resolves.toMatchObject({ pending: 1 })
  })

  it('persists a retryable failure and later confirms the same GUID exactly once', async () => {
    receiptMock
      .mockResolvedValueOnce({ state: 'retryable', status: 'FAILED', baseTxHash: null, reason: 'out of gas' })
      .mockResolvedValueOnce({ state: 'confirmed', status: 'DELIVERED', baseTxHash: `0x${'cd'.repeat(32)}` })

    await expect(confirmSolanaLotteryInboxBatch({ db: { sql: vi.fn() } as any }))
      .resolves.toMatchObject({ retryable: 1, confirmed: 0, failed: 0 })
    expect(retryableMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 1, reason: 'layerzero_retryable_FAILED:out of gas',
    }))
    expect(failedMock).not.toHaveBeenCalled()

    await expect(confirmSolanaLotteryInboxBatch({ db: { sql: vi.fn() } as any }))
      .resolves.toMatchObject({ retryable: 0, confirmed: 1, failed: 0 })
    expect(confirmedMock).toHaveBeenCalledTimes(1)
  })

  it('keeps a transient LayerZero lookup failure submitted for retry', async () => {
    receiptMock.mockRejectedValue(new Error('layerzero_scan_http_503'))
    await expect(confirmSolanaLotteryInboxBatch({ db: { sql: vi.fn() } as any }))
      .resolves.toMatchObject({ checked: 1, confirmed: 0, failed: 0, errors: [expect.stringContaining('layerzero_scan_http_503')] })
    expect(confirmedMock).not.toHaveBeenCalled()
    expect(failedMock).not.toHaveBeenCalled()
  })
})
