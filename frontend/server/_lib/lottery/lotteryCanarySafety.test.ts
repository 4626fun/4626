import { describe, expect, it } from 'vitest'

import { evaluateLotteryCanarySafety } from './lotteryCanarySafety'

describe('lottery canary safety', () => {
  it('requires single-vault payouts and an empty deferred VRF queue', () => {
    expect(evaluateLotteryCanarySafety({
      singleVaultReadOk: true,
      singleVaultJackpotOnly: true,
      deferredQueueReadOk: true,
      deferredVrfQueueLength: 0n,
    }).safe).toBe(true)

    expect(evaluateLotteryCanarySafety({
      singleVaultReadOk: true,
      singleVaultJackpotOnly: false,
      deferredQueueReadOk: true,
      deferredVrfQueueLength: 0n,
    })).toMatchObject({ safe: false, blocker: 'singleVaultJackpotOnly must be true before canary traffic' })

    expect(evaluateLotteryCanarySafety({
      singleVaultReadOk: true,
      singleVaultJackpotOnly: true,
      deferredQueueReadOk: true,
      deferredVrfQueueLength: 1n,
    })).toMatchObject({ safe: false, blocker: 'deferredVrfQueueLength must be zero before canary traffic' })
  })
})
