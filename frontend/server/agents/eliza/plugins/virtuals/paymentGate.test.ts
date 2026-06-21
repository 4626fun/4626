import { describe, expect, it } from 'vitest'

import { evaluateBacktestPaymentGate } from './paymentGate.js'

describe('evaluateBacktestPaymentGate', () => {
  it('allows when nested budget amount is positive', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'awaiting_response',
      job: { payment: { amountUsdc: 7.5 } },
    })
    expect(decision.allowed).toBe(true)
    expect(decision.amountUsdc).toBe(7.5)
    expect(decision.reason).toBe('positive_budget_signal')
  })

  it('blocks when status explicitly indicates unpaid', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'awaiting_funding',
      paymentAmount: 12,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('job_status_unpaid')
  })

  it('allows on funded/active status even without explicit amount', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'in_progress',
    })
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toContain('status_allows_without_amount')
  })

  it('blocks when no payment signal is present', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'new',
      metadata: { unrelated: true },
    })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('missing_payment_signal')
  })
})
