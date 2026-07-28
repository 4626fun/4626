import { describe, expect, it } from 'vitest'

import {
  assertSuccessfulUserOperationReceipt,
  evaluateUnwindCompletion,
  parseUnwindStep,
  readCliValue,
} from './emergencyUnwindGuards.js'

describe('emergency unwind guards', () => {
  it('reads both inline and split CLI values', () => {
    expect(readCliValue(['--confirm=AKITA-B2-UNWIND'], '--confirm')).toBe('AKITA-B2-UNWIND')
    expect(readCliValue(['--step', 'drain'], '--step')).toBe('drain')
  })

  it('rejects unknown unwind steps instead of defaulting to all', () => {
    expect(() => parseUnwindStep('unknown')).toThrow('Invalid --step')
    expect(parseUnwindStep('drain')).toBe('drain')
  })

  it('rejects failed or indeterminate UserOperation receipts', () => {
    expect(() => assertSuccessfulUserOperationReceipt({ success: false }, 'shutdownVault')).toThrow(
      'UserOp failed (shutdownVault)',
    )
    expect(() => assertSuccessfulUserOperationReceipt({}, 'shutdownVault')).toThrow(
      'UserOp failed (shutdownVault)',
    )
    expect(() => assertSuccessfulUserOperationReceipt({ success: true }, 'shutdownVault')).not.toThrow()
  })

  it('requires debt, adapter assets, and tracked bucket LP to be fully cleared', () => {
    expect(
      evaluateUnwindCompletion({
        totalDebt: 0n,
        ajnaAdapterAssets: 0n,
        ajnaBucketLp: [],
      }),
    ).toBe(true)
    expect(
      evaluateUnwindCompletion({
        totalDebt: 1n,
        ajnaAdapterAssets: 0n,
        ajnaBucketLp: [],
      }),
    ).toBe(false)
    expect(
      evaluateUnwindCompletion({
        totalDebt: 0n,
        ajnaAdapterAssets: 1n,
        ajnaBucketLp: [],
      }),
    ).toBe(false)
    expect(
      evaluateUnwindCompletion({
        totalDebt: 0n,
        ajnaAdapterAssets: 0n,
        ajnaBucketLp: [1n],
      }),
    ).toBe(false)
  })
})
