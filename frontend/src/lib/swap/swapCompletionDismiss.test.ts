import { describe, expect, it } from 'vitest'

import {
  classifySwapCompletionReceipt,
  shouldResetSwapFormAfterCompletionDismiss,
} from './swapCompletionDismiss'

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

describe('classifySwapCompletionReceipt', () => {
  it('confirms only a successful original or repriced transaction', () => {
    expect(
      classifySwapCompletionReceipt({
        receiptStatus: 'success',
      }),
    ).toBe('confirmed')
    expect(
      classifySwapCompletionReceipt({
        receiptStatus: 'success',
        replacementReason: 'repriced',
      }),
    ).toBe('confirmed')
  })

  it('rejects reverted, cancelled, and changed replacements', () => {
    expect(
      classifySwapCompletionReceipt({
        receiptStatus: 'reverted',
      }),
    ).toBe('failed')
    expect(
      classifySwapCompletionReceipt({
        receiptStatus: 'success',
        replacementReason: 'cancelled',
      }),
    ).toBe('failed')
    expect(
      classifySwapCompletionReceipt({
        receiptStatus: 'success',
        replacementReason: 'replaced',
      }),
    ).toBe('failed')
  })
})
