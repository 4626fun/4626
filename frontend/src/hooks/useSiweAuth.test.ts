import { describe, expect, it } from 'vitest'

import { shouldResetPrivyBridgeState } from './useSiweAuth'

describe('shouldResetPrivyBridgeState', () => {
  it('resets for invalid or missing Privy auth tokens', () => {
    expect(shouldResetPrivyBridgeState('Invalid Privy auth token')).toBe(true)
    expect(shouldResetPrivyBridgeState('Missing Privy auth token')).toBe(true)
    expect(shouldResetPrivyBridgeState('Privy token expired')).toBe(true)
    expect(shouldResetPrivyBridgeState('Privy verification failed')).toBe(true)
  })

  it('does NOT reset for bare unauthorized/forbidden (too broad)', () => {
    expect(shouldResetPrivyBridgeState('Unauthorized')).toBe(false)
    expect(shouldResetPrivyBridgeState('Forbidden')).toBe(false)
    expect(shouldResetPrivyBridgeState('401 Unauthorized')).toBe(false)
  })

  it('does not reset for generic non-Privy errors', () => {
    expect(shouldResetPrivyBridgeState('Network error')).toBe(false)
    expect(shouldResetPrivyBridgeState('Request failed')).toBe(false)
    expect(shouldResetPrivyBridgeState('')).toBe(false)
  })
})
