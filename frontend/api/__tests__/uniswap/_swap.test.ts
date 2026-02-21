import { describe, expect, it } from 'vitest'

import { validateSwapTransactionPayload } from '../../_handlers/uniswap/_swap'

const BASE_SWAP = {
  swap: {
    to: '0x0000000000000000000000000000000000000001',
    from: '0x0000000000000000000000000000000000000002',
    data: '0x1234',
    value: '0x00',
    gasLimit: '180000',
    maxFeePerGas: '10',
    maxPriorityFeePerGas: '2',
    chainId: 8453,
  },
}

describe('validateSwapTransactionPayload', () => {
  it('accepts a valid swap payload', () => {
    expect(validateSwapTransactionPayload(BASE_SWAP)).toBeNull()
  })

  it('rejects empty or invalid transaction data', () => {
    expect(validateSwapTransactionPayload({ swap: { ...BASE_SWAP.swap, data: '0x' } })).toBe(
      'Uniswap swap response contains invalid transaction data',
    )
    expect(validateSwapTransactionPayload({ swap: { ...BASE_SWAP.swap, data: 'abc' } })).toBe(
      'Uniswap swap response contains invalid transaction data',
    )
  })

  it('rejects conflicting gas fields', () => {
    expect(
      validateSwapTransactionPayload({
        swap: { ...BASE_SWAP.swap, gasPrice: '1' },
      }),
    ).toBe('Uniswap swap response contains conflicting gas fields')
  })

  it('rejects invalid recipient/sender addresses', () => {
    expect(validateSwapTransactionPayload({ swap: { ...BASE_SWAP.swap, to: '0x1234' } })).toBe(
      'Uniswap swap response contains invalid recipient address',
    )
    expect(validateSwapTransactionPayload({ swap: { ...BASE_SWAP.swap, from: 'bad' } })).toBe(
      'Uniswap swap response contains invalid sender address',
    )
  })
})
