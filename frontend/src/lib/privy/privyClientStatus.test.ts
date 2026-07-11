import { describe, expect, it } from 'vitest'

import { latchPrivyClientStatus } from './privyClientStatus'

describe('latchPrivyClientStatus', () => {
  it('latches ready so later loading flaps cannot remount the waitlist shell', () => {
    expect(latchPrivyClientStatus('loading', 'ready')).toBe('ready')
    expect(latchPrivyClientStatus('ready', 'loading')).toBe('ready')
    expect(latchPrivyClientStatus('ready', 'ready')).toBe('ready')
  })

  it('passes through loading until the first ready signal', () => {
    expect(latchPrivyClientStatus('loading', 'loading')).toBe('loading')
    expect(latchPrivyClientStatus('disabled', 'loading')).toBe('loading')
  })
})
