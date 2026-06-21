// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearWaitlistAuthPending,
  readWaitlistAuthPending,
  writeWaitlistAuthPending,
} from './waitlistStorage'

describe('waitlistAuthPending', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('tracks pending auth only while the user initiated sign-in', () => {
    expect(readWaitlistAuthPending()).toBe(false)
    writeWaitlistAuthPending(true)
    expect(readWaitlistAuthPending()).toBe(true)
    clearWaitlistAuthPending()
    expect(readWaitlistAuthPending()).toBe(false)
  })
})
