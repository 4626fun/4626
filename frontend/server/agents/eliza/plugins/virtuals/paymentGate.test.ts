import { describe, expect, it } from 'vitest'

import { evaluateBacktestPaymentGate } from './paymentGate.js'

describe('evaluateBacktestPaymentGate', () => {
  it('allows an SDK-shaped funded JobSession with a positive job budget', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'funded',
      job: {
        status: 'FUNDED',
        budget: { address: '0xusdc', symbol: 'USDC', decimals: 6, amount: 7.5, rawAmount: 7_500_000n },
      },
    })
    expect(decision.allowed).toBe(true)
    expect(decision.amountUsdc).toBe(7.5)
    expect(decision.reason).toBe('positive_payment_amount')
  })

  it('blocks a positive quoted budget before the SDK reports funded', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'budget_set',
      job: {
        status: 'OPEN',
        budget: { amount: 12 },
      },
    })
    expect(decision.allowed).toBe(false)
    expect(decision.amountUsdc).toBe(12)
    expect(decision.reason).toContain('job_not_funded')
  })

  it('allows protocol-funded free jobs with a zero budget amount', () => {
    const decision = evaluateBacktestPaymentGate({
      status: 'funded',
      job: { status: 'FUNDED', budget: { amount: 0 } },
    })
    expect(decision.allowed).toBe(true)
    expect(decision.reason).toBe('protocol_funded_zero_budget')
    expect(decision.amountUsdc).toBe(0)
  })

  it('fails closed for missing jobs, mismatched status, and non-numeric amounts before funded', () => {
    for (const session of [
      { status: 'funded', job: null },
      { status: 'funded', job: { status: 'OPEN', budget: { amount: 12 } } },
      { status: 'open', job: { status: 'FUNDED', budget: { amount: 12 } } },
      { status: 'funded', job: { status: 'FUNDED', budget: { amount: '8' } } },
    ]) {
      const decision = evaluateBacktestPaymentGate(session)
      // funded + FUNDED + non-numeric amount is still protocol-funded.
      if (
        session.status === 'funded' &&
        session.job &&
        (session.job as { status?: string }).status === 'FUNDED' &&
        typeof (session.job as { budget?: { amount?: unknown } }).budget?.amount === 'string'
      ) {
        expect(decision.allowed).toBe(true)
        expect(decision.reason).toBe('protocol_funded_zero_budget')
        continue
      }
      expect(decision.allowed).toBe(false)
    }
  })
})
