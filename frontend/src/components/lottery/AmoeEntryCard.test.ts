import { describe, expect, it, vi } from 'vitest'

import { __testHooks } from './AmoeEntryCard'

vi.mock('@/lib/env/host', () => ({
  getMarketingBaseUrl: () => 'https://4626.fun',
}))

describe('AmoeEntryCard share copy', () => {
  it('builds a concise X intent with the production 4626 URL', () => {
    const text = __testHooks.buildAmoeShareText()
    expect(text).toBe(
      'Checking in for 4626 Alternative Method of Entry. No purchase necessary. Earn points through eligible actions and use them for free jackpot entries. Join me:',
    )

    const intent = new URL(__testHooks.buildXIntentUrl())
    expect(intent.origin).toBe('https://twitter.com')
    expect(intent.pathname).toBe('/intent/tweet')
    expect(intent.searchParams.get('url')).toBe('https://4626.fun')
    expect(intent.searchParams.get('text')).toBe(text)
  })
})

describe('AmoeEntryCard asynchronous burn safety', () => {
  const pending = {
    wallet: '0x1111111111111111111111111111111111111111',
    creatorCoin: '0x2222222222222222222222222222222222222222',
    pointsBurned: 100,
    twitterHandle: 'wallet_111111111111',
    spendRefId: 'amoe-ui:creator:nonce',
    eligibleSubmitAfterUnixSec: 2_000,
  } as const

  it('does not consider a burn ready until the epoch boundary and publisher buffer pass', () => {
    expect(__testHooks.isPendingAmoeEntryReady(pending, 2_899)).toBe(false)
    expect(__testHooks.isPendingAmoeEntryReady(pending, 2_900)).toBe(true)
  })

  it('rejects malformed or oversized persisted pending intents', () => {
    expect(__testHooks.isPendingAmoeEntry(pending)).toBe(true)
    expect(__testHooks.isPendingAmoeEntry({ ...pending, spendRefId: 'x'.repeat(191) })).toBe(false)
    expect(__testHooks.isPendingAmoeEntry({ ...pending, pointsBurned: 99 })).toBe(false)
  })
})
