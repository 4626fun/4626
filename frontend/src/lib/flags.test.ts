import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPrivyClientId, isPrivyHostModeAllowed } from './flags'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isPrivyHostModeAllowed', () => {
  it('disables the Privy browser client on the marketing host', () => {
    expect(isPrivyHostModeAllowed('marketing')).toBe(false)
  })

  it('keeps the Privy browser client available on the app host', () => {
    expect(isPrivyHostModeAllowed('app')).toBe(true)
  })
})

describe('getPrivyClientId', () => {
  it('returns null when no browser client id is configured', () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', '')
    expect(getPrivyClientId()).toBeNull()
  })

  it('returns the configured Privy browser client id', () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', 'client_live_123')
    expect(getPrivyClientId()).toBe('client_live_123')
  })
})
