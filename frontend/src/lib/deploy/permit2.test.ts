import { describe, expect, it } from 'vitest'

import {
  buildPermit2SignatureTransfer,
  createPermit2Deadline,
  createPermit2Nonce,
} from './permit2'

describe('buildPermit2SignatureTransfer', () => {
  it('builds permit and EIP-712 payload for signature transfer', () => {
    const result = buildPermit2SignatureTransfer({
      chainId: 8453,
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      token: '0x0000000000000000000000000000000000000001',
      amount: 123n,
      spender: '0x0000000000000000000000000000000000000002',
      nonce: 456n,
      deadline: 789n,
    })

    expect(result.permit.permitted.token).toBe('0x0000000000000000000000000000000000000001')
    expect(result.permit.permitted.amount).toBe(123n)
    expect(result.permit.nonce).toBe(456n)
    expect(result.permit.deadline).toBe(789n)
    expect(result.typedData.primaryType).toBe('PermitTransferFrom')
    expect(result.typedData.domain).toEqual({
      name: 'Permit2',
      chainId: 8453,
      verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    })
    expect(result.typedData.message).toEqual({
      permitted: {
        token: '0x0000000000000000000000000000000000000001',
        amount: 123n,
      },
      spender: '0x0000000000000000000000000000000000000002',
      nonce: 456n,
      deadline: 789n,
    })
  })
})

describe('Permit2 timing helpers', () => {
  it('uses millisecond precision for nonces to reduce collisions', () => {
    expect(createPermit2Nonce(1_709_000_000_123)).toBe(1_709_000_000_123n)
  })

  it('creates deadline from current timestamp plus ttl', () => {
    expect(createPermit2Deadline({ nowSeconds: 1_709_000_000, ttlSeconds: 86_400 })).toBe(1_709_086_400n)
  })
})
