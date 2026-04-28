import { describe, expect, it } from 'vitest'

import { shouldFallbackToOwnerDirectExecute } from './adminOpsHelpers'

describe('adminOpsHelpers', () => {
  it('allows direct owner fallback for recoverable paymaster quota failures', () => {
    expect(
      shouldFallbackToOwnerDirectExecute(
        new Error('Request exceeds defined limit. Details: Sponsorship limit exceeded for this sender'),
      ),
    ).toBe(true)
    expect(shouldFallbackToOwnerDirectExecute(new Error('Rate limit exceeded'))).toBe(true)
  })

  it('does not direct-fallback user rejection or owner-authority failures', () => {
    expect(shouldFallbackToOwnerDirectExecute(new Error('User rejected the request'))).toBe(false)
    expect(shouldFallbackToOwnerDirectExecute(new Error('invalid wallet sig'))).toBe(false)
    expect(shouldFallbackToOwnerDirectExecute(new Error('not an onchain owner'))).toBe(false)
  })
})
