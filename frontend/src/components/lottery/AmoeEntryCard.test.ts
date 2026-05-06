import { describe, expect, it, vi } from 'vitest'

import { __testHooks } from './AmoeEntryCard'

vi.mock('@/lib/env/host', () => ({
  getMarketingBaseUrl: () => 'https://4626.fun',
}))

describe('AmoeEntryCard share copy', () => {
  it('builds a dated X intent with the production 4626 URL', () => {
    const date = new Date('2026-05-06T19:00:00.000Z')
    const text = __testHooks.buildAmoeShareText(date)
    expect(text).toBe(
      'Today is May 6, 2026 Pacific Time. I am checking in as a real person for 4626 Alternative Method of Entry. No purchase necessary. Join 4626 and earn points for free jackpot entries:',
    )

    const intent = new URL(__testHooks.buildXIntentUrl(date))
    expect(intent.origin).toBe('https://twitter.com')
    expect(intent.pathname).toBe('/intent/tweet')
    expect(intent.searchParams.get('url')).toBe('https://4626.fun')
    expect(intent.searchParams.get('text')).toBe(text)
  })
})
