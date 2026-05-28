// @vitest-environment happy-dom

import { describe, expect, it, beforeEach } from 'vitest'

import {
  WAITLIST_RECOVERY_GATE_STORAGE_KEY,
  clearWaitlistRecoveryGate,
  readWaitlistRecoveryGate,
  writeWaitlistRecoveryGate,
} from './waitlistRecoveryGate'

describe('waitlistRecoveryGate', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('persists and clears the recovery gate flag', () => {
    expect(readWaitlistRecoveryGate()).toBe(false)
    writeWaitlistRecoveryGate(true)
    expect(sessionStorage.getItem(WAITLIST_RECOVERY_GATE_STORAGE_KEY)).toBe('1')
    expect(readWaitlistRecoveryGate()).toBe(true)
    clearWaitlistRecoveryGate()
    expect(readWaitlistRecoveryGate()).toBe(false)
  })
})
