import { describe, expect, it } from 'vitest'

import { shouldReloadAccountForAuthIdentity } from './useAccountSetupController'

describe('account setup auth identity refresh', () => {
  it('reloads on login, logout, and authenticated-user switches', () => {
    expect(shouldReloadAccountForAuthIdentity(null, 'signed-out')).toBe(true)
    expect(shouldReloadAccountForAuthIdentity('signed-out', 'did:privy:alice')).toBe(true)
    expect(shouldReloadAccountForAuthIdentity('did:privy:alice', 'did:privy:bob')).toBe(true)
    expect(shouldReloadAccountForAuthIdentity('did:privy:bob', 'signed-out')).toBe(true)
  })

  it('does not refetch merely because the stable identity is rendered again', () => {
    expect(shouldReloadAccountForAuthIdentity('did:privy:alice', 'did:privy:alice')).toBe(false)
  })
})
