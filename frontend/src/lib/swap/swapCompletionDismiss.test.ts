import { describe, expect, it } from 'vitest'

import {
  canAutoDismissSwapCompletion,
  canManuallyDismissSwapCompletion,
  classifySwapCompletionReceipt,
  isSwapExecutionLocked,
  shouldBlockSwapSubmitWhileSettling,
  shouldClearSwapCompletionOnTradeReset,
  shouldClearSwapCompletionForExecutionAddressChange,
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

describe('swap settlement execution lock', () => {
  it('locks pending and delayed completions against a second submit', () => {
    expect(isSwapExecutionLocked('pending')).toBe(true)
    expect(isSwapExecutionLocked('delayed')).toBe(true)
    expect(isSwapExecutionLocked('confirmed')).toBe(false)
    expect(isSwapExecutionLocked('failed')).toBe(false)
  })

  it('blocks review/submit while an unresolved completion exists', () => {
    expect(
      shouldBlockSwapSubmitWhileSettling({
        hasSwapCompletion: true,
        settlement: 'pending',
      }),
    ).toBe(true)
    expect(
      shouldBlockSwapSubmitWhileSettling({
        hasSwapCompletion: true,
        settlement: 'delayed',
      }),
    ).toBe(true)
    expect(
      shouldBlockSwapSubmitWhileSettling({
        hasSwapCompletion: true,
        settlement: null,
      }),
    ).toBe(false)
    expect(
      shouldBlockSwapSubmitWhileSettling({
        hasSwapCompletion: true,
        settlement: 'confirmed',
      }),
    ).toBe(false)
    expect(
      shouldBlockSwapSubmitWhileSettling({
        hasSwapCompletion: true,
        settlement: 'failed',
      }),
    ).toBe(false)
    expect(
      shouldBlockSwapSubmitWhileSettling({
        hasSwapCompletion: false,
        settlement: 'pending',
      }),
    ).toBe(false)
  })

  it('only auto-dismisses confirmed settlements', () => {
    expect(canAutoDismissSwapCompletion('confirmed')).toBe(true)
    expect(canAutoDismissSwapCompletion('delayed')).toBe(false)
    expect(canAutoDismissSwapCompletion('pending')).toBe(false)
    expect(canAutoDismissSwapCompletion('failed')).toBe(false)
  })

  it('allows manual dismiss for delayed recovery but not pending', () => {
    expect(canManuallyDismissSwapCompletion('pending')).toBe(false)
    expect(canManuallyDismissSwapCompletion('delayed')).toBe(true)
    expect(canManuallyDismissSwapCompletion('failed')).toBe(true)
    expect(canManuallyDismissSwapCompletion('confirmed')).toBe(true)
  })

  it('preserves completion across ordinary form resets', () => {
    expect(shouldClearSwapCompletionOnTradeReset()).toBe(false)
    expect(shouldClearSwapCompletionOnTradeReset({})).toBe(false)
    expect(shouldClearSwapCompletionOnTradeReset({ clearCompletion: false })).toBe(false)
    expect(shouldClearSwapCompletionOnTradeReset({ clearCompletion: true })).toBe(true)
  })

  it('clears completion only when switching between distinct execution accounts', () => {
    expect(
      shouldClearSwapCompletionForExecutionAddressChange({
        previousExecutionAddress: '0xAbc',
        nextExecutionAddress: null,
      }),
    ).toBe(false)
    expect(
      shouldClearSwapCompletionForExecutionAddressChange({
        previousExecutionAddress: '0xAbc',
        nextExecutionAddress: '0xabc',
      }),
    ).toBe(false)
    expect(
      shouldClearSwapCompletionForExecutionAddressChange({
        previousExecutionAddress: '0xAbc',
        nextExecutionAddress: '0xDef',
      }),
    ).toBe(true)
  })
})
