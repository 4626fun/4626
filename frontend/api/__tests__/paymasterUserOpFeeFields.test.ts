import { describe, expect, it } from 'vitest'

import { ensurePaymasterUserOpFeeFields } from '../_handlers/paymaster/userOpFeeFields.js'

describe('ensurePaymasterUserOpFeeFields', () => {
  it('injects zeroish maxFeePerGas and maxPriorityFeePerGas when omitted', () => {
    const out = ensurePaymasterUserOpFeeFields({
      sender: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      callGasLimit: '0x0',
      preVerificationGas: '0x0',
      verificationGasLimit: '0x61a80',
    })

    expect(out.maxFeePerGas).toBe('0x0')
    expect(out.maxPriorityFeePerGas).toBe('0x0')
    expect(out.callGasLimit).toBe('0x0')
  })

  it('preserves caller-provided fee fields', () => {
    const out = ensurePaymasterUserOpFeeFields({
      maxFeePerGas: '0x5f5e100',
      maxPriorityFeePerGas: '0xf4240',
    })

    expect(out.maxFeePerGas).toBe('0x5f5e100')
    expect(out.maxPriorityFeePerGas).toBe('0xf4240')
  })

  it('treats blank strings as missing', () => {
    const out = ensurePaymasterUserOpFeeFields({
      maxFeePerGas: '   ',
      maxPriorityFeePerGas: '',
    })

    expect(out.maxFeePerGas).toBe('0x0')
    expect(out.maxPriorityFeePerGas).toBe('0x0')
  })
})
