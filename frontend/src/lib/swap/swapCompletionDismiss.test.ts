import { describe, expect, it } from 'vitest'

import { shouldResetSwapFormAfterCompletionDismiss } from './swapCompletionDismiss'

const ready = {
  swapCompletionConfirmed: true,
  amountInUnits: '1.5',
  completionAmountInUnits: '1.5',
  busy: null,
  txState: 'success',
}

describe('shouldResetSwapFormAfterCompletionDismiss', () => {
  it('resets only a confirmed idle success whose amount is unchanged', () => {
    expect(shouldResetSwapFormAfterCompletionDismiss(ready)).toBe(true)
    expect(
      shouldResetSwapFormAfterCompletionDismiss({
        ...ready,
        amountInUnits: '1.50',
        completionAmountInUnits: '1.5',
      }),
    ).toBe(true)
  })

  it('preserves an in-flight or edited next trade', () => {
    expect(
      shouldResetSwapFormAfterCompletionDismiss({
        ...ready,
        swapCompletionConfirmed: false,
      }),
    ).toBe(false)
    expect(
      shouldResetSwapFormAfterCompletionDismiss({
        ...ready,
        amountInUnits: '2',
      }),
    ).toBe(false)
    expect(
      shouldResetSwapFormAfterCompletionDismiss({
        ...ready,
        busy: 'quote',
      }),
    ).toBe(false)
    expect(
      shouldResetSwapFormAfterCompletionDismiss({
        ...ready,
        txState: 'signing',
      }),
    ).toBe(false)
  })
})
