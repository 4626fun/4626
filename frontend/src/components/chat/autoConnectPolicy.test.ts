import { describe, expect, it } from 'vitest'

import { shouldAutoConnectMessaging } from './autoConnectPolicy'

describe('shouldAutoConnectMessaging', () => {
  it('returns true for idle status', () => {
    expect(shouldAutoConnectMessaging('idle')).toBe(true)
    expect(shouldAutoConnectMessaging('signing')).toBe(false)
    expect(shouldAutoConnectMessaging('connecting')).toBe(false)
    expect(shouldAutoConnectMessaging('connected')).toBe(false)
  })

  it('retries auto-connect on transient error but not when local reset is required', () => {
    expect(shouldAutoConnectMessaging('error')).toBe(true)
    expect(shouldAutoConnectMessaging('error', { localStateResetRequired: true })).toBe(false)
    expect(shouldAutoConnectMessaging('error', { localStateResetRequired: false })).toBe(true)
  })
})
