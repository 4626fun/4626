import { describe, expect, it } from 'vitest'

import { createWaitlistMessagingWagmiConfig } from './waitlistMessagingWagmi'

describe('createWaitlistMessagingWagmiConfig', () => {
  it('caches config per connectTrack and enables ssr', () => {
    const emailConfig = createWaitlistMessagingWagmiConfig('privy-owner-install')
    const emailConfigAgain = createWaitlistMessagingWagmiConfig('privy-owner-install')
    const baseAppConfig = createWaitlistMessagingWagmiConfig('base-app-direct')

    expect(emailConfigAgain).toBe(emailConfig)
    expect(baseAppConfig).not.toBe(emailConfig)
    expect(emailConfig._internal.ssr).toBe(true)
    expect(baseAppConfig._internal.ssr).toBe(true)
  })
})
