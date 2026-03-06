import { describe, expect, it } from 'vitest'

import { shouldResetPrivyBridgeState } from './useSiweAuth'

describe('shouldResetPrivyBridgeState', () => {
  it('resets client auth state for invalid Privy auth tokens', () => {
    expect(shouldResetPrivyBridgeState('Invalid Privy auth token')).toBe(true)
  })

  it('resets client auth state for unauthorized bridge failures', () => {
    expect(shouldResetPrivyBridgeState('Unauthorized')).toBe(true)
    expect(shouldResetPrivyBridgeState('Missing Privy auth token')).toBe(true)
  })

  it('does not reset client auth state for generic bridge failures', () => {
    expect(shouldResetPrivyBridgeState('Privy verification failed')).toBe(false)
  })
})
