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

  it('uses an in-memory (non-noopStorage) store that round-trips writes within a session', async () => {
    // A distinct connectTrack avoids the module-level config cache colliding
    // with the other test in this file.
    const config = createWaitlistMessagingWagmiConfig('zora-owner-install')
    const storage = config.storage
    expect(storage).toBeTruthy()

    await storage?.setItem('waitlist-messaging-test-key', 'warm')
    const readBack = await storage?.getItem('waitlist-messaging-test-key')
    // wagmi's noopStorage always returns null regardless of what was written;
    // asserting a real round-trip here guards against silently regressing
    // back to noopStorage.
    expect(readBack).toBe('warm')
  })
})
