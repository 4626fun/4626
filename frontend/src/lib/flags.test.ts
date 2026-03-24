import { describe, expect, it } from 'vitest'

import { isPrivyHostModeAllowed } from './flags'

describe('isPrivyHostModeAllowed', () => {
  it('disables the Privy browser client on the marketing host', () => {
    expect(isPrivyHostModeAllowed('marketing')).toBe(false)
  })

  it('keeps the Privy browser client available on the app host', () => {
    expect(isPrivyHostModeAllowed('app')).toBe(true)
  })
})
