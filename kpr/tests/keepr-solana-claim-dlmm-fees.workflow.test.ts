import { afterEach, describe, expect, it, vi } from 'vitest'

const executeClaimMock = vi.hoisted(() => vi.fn())

vi.mock('../actions/keepr-solana-claim-dlmm-fees.action.js', () => ({
  executeSolanaDlmmFeeClaim: executeClaimMock,
}))

vi.mock('../utils/alerts.js', () => ({
  alertCritical: vi.fn(async () => undefined),
}))

import { handler } from '../workflows/keepr-solana-claim-dlmm-fees.workflow.js'

describe('keepr Solana DLMM fee-claim workflow', () => {
  const originalEnabled = process.env.SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED

  afterEach(() => {
    vi.clearAllMocks()
    if (originalEnabled === undefined) delete process.env.SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED
    else process.env.SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED = originalEnabled
  })

  it('does not claim fees until the dedicated worker flag is enabled', async () => {
    process.env.SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED = '0'

    await handler()

    expect(executeClaimMock).not.toHaveBeenCalled()
  })

  it('claims fees when the dedicated worker flag is enabled', async () => {
    process.env.SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED = '1'
    executeClaimMock.mockResolvedValue({
      poolsProcessed: 1,
      positionsClaimed: 1,
      quoteHarvestedAmount: '690',
      harvestThresholdMet: false,
      signatures: [],
    })

    await handler()

    expect(executeClaimMock).toHaveBeenCalledTimes(1)
  })
})
