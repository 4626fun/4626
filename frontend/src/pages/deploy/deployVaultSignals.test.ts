import { describe, expect, it } from 'vitest'

import {
  buildShareVanitySkipLogKey,
  isProviderCollisionErrorMessage,
  shouldEmitShareVanitySkipLog,
} from './deployVaultSignals'

describe('deploy vault signals', () => {
  it('normalizes provider collision error signatures', () => {
    expect(isProviderCollisionErrorMessage('Cannot redefine property: ethereum')).toBe(true)
    expect(
      isProviderCollisionErrorMessage(
        'Cannot set property ethereum of #<Window> which has only a getter',
      ),
    ).toBe(true)
    expect(
      isProviderCollisionErrorMessage(
        'MetaMask encountered an error setting the global Ethereum provider',
      ),
    ).toBe(true)
    expect(
      isProviderCollisionErrorMessage(
        'Failed to add embedded wallet connector: Wallet proxy not initialized',
      ),
    ).toBe(true)
    expect(isProviderCollisionErrorMessage('Deploy ownership mismatch')).toBe(false)
    expect(isProviderCollisionErrorMessage('')).toBe(false)
  })

  it('emits share vanity skip log only once per unique key', () => {
    const keyA = buildShareVanitySkipLogKey({
      batcher: '0xeB872AB8830f5cE71Dc710C0394A0F68524D6d68',
      suffix: '4626',
    })
    expect(shouldEmitShareVanitySkipLog({ lastKey: null, nextKey: keyA })).toBe(true)
    expect(shouldEmitShareVanitySkipLog({ lastKey: keyA, nextKey: keyA })).toBe(false)

    const keyB = buildShareVanitySkipLogKey({
      batcher: '0xA9D5A2A9D5A2A9D5A2A9D5A2A9D5A2A9D5A2B912',
      suffix: '4626',
    })
    expect(shouldEmitShareVanitySkipLog({ lastKey: keyA, nextKey: keyB })).toBe(true)
  })
})

