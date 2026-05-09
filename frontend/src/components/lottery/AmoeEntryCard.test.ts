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
