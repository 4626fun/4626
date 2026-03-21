import { describe, expect, it } from 'vitest'

import { shouldAutoConnectMessaging } from './autoConnectPolicy'

describe('shouldAutoConnectMessaging', () => {
  it('returns true only for idle status', () => {
    expect(shouldAutoConnectMessaging('idle')).toBe(true)
    expect(shouldAutoConnectMessaging('error')).toBe(false)
    expect(shouldAutoConnectMessaging('signing')).toBe(false)
    expect(shouldAutoConnectMessaging('connecting')).toBe(false)
    expect(shouldAutoConnectMessaging('connected')).toBe(false)
  })
})
