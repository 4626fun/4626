import { describe, expect, it } from 'vitest'

import { directBatchAction, type PlannedHarvestConversion } from '../../../../shared/payout-router/harvestCommon.js'
import { executePlannedHarvestConversions } from '../../../../shared/payout-router/harvestExecute.js'

function planned(label: string): PlannedHarvestConversion {
  const token = `0x${label.padStart(40, '0')}` as `0x${string}`
  return {
    token,
    label,
    balance: 100n,
    route: 'direct',
    action: directBatchAction(token, 100n, 0n),
  }
}

describe('executePlannedHarvestConversions', () => {
  it('returns empty when no conversions are planned', async () => {
    const outcome = await executePlannedHarvestConversions({
      conversions: [],
      submitBatch: async () => ({ success: true, txHash: '0xabc' as `0x${string}` }),
    })
    expect(outcome.converted).toHaveLength(0)
    expect(outcome.failed).toHaveLength(0)
    expect(outcome.usedPerTokenFallback).toBe(false)
  })

  it('retries per token when the combined batch fails', async () => {
    const a = planned('a')
    const b = planned('b')
    let batchCalls = 0

    const outcome = await executePlannedHarvestConversions({
      conversions: [a, b],
      submitBatch: async (actions) => {
        batchCalls += 1
        if (actions.length === 2) {
          return { success: false, error: 'batch_reverted' }
        }
        if (actions[0]?.tokenIn === a.token) {
          return { success: true, txHash: '0xaaa' as `0x${string}` }
        }
        return { success: false, error: 'token_b_failed' }
      },
    })

    expect(batchCalls).toBe(3)
    expect(outcome.usedPerTokenFallback).toBe(true)
    expect(outcome.converted).toEqual([{ conversion: a, txHash: '0xaaa' }])
    expect(outcome.failed).toHaveLength(1)
    expect(outcome.failed[0]?.conversion).toEqual(b)
  })

  it('does not retry individually when fallback is disabled', async () => {
    const a = planned('a')
    const b = planned('b')
    let batchCalls = 0

    const outcome = await executePlannedHarvestConversions({
      conversions: [a, b],
      perTokenFallback: false,
      submitBatch: async () => {
        batchCalls += 1
        return { success: false, error: 'batch_reverted' }
      },
    })

    expect(batchCalls).toBe(1)
    expect(outcome.usedPerTokenFallback).toBe(false)
    expect(outcome.converted).toHaveLength(0)
    expect(outcome.failed).toHaveLength(2)
  })
})
