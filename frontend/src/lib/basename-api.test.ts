import { describe, expect, it } from 'vitest'

import { isExpectedBasenameLookupError } from './basename-api'

describe('isExpectedBasenameLookupError', () => {
  it('returns true for known reverseWithGateways misses', () => {
    const err = new Error(
      'ContractFunctionExecutionError: reverseWithGateways reverted with signature 0x0d1947a9',
    )
    expect(isExpectedBasenameLookupError(err)).toBe(true)
  })

  it('returns true for known browser gateway/cors failures', () => {
    const err = new Error(
      "Access to fetch at 'https://api.coinbase.com/api/v1/domain/resolver/resolveDomain/' from origin 'http://localhost:5173' has been blocked by CORS policy",
    )
    expect(isExpectedBasenameLookupError(err)).toBe(true)
  })

  it('returns false for unexpected failures', () => {
    const err = new Error('TypeError: cannot read properties of undefined')
    expect(isExpectedBasenameLookupError(err)).toBe(false)
  })
})
