import { describe, expect, it, vi } from 'vitest'

import { createLivePrivyClientView } from './safeHooks'
import type { SafePrivyClient } from './safeHooks'

describe('createLivePrivyClientView', () => {
  it('reflects later mutations to the ref instead of freezing the initial snapshot', () => {
    const ref: { current: SafePrivyClient } = { current: { ready: true, authenticated: false } }
    const view = createLivePrivyClientView(ref)

    expect(view.authenticated).toBe(false)

    // Simulate a React re-render swapping in a brand-new object from usePrivy(),
    // the same way `privyRef.current = privy` does in an effect with no deps.
    ref.current = { ready: true, authenticated: true }

    expect(view.authenticated).toBe(true)
  })

  it('reflects later changes to ready and user', () => {
    const ref: { current: SafePrivyClient } = { current: { ready: false, user: null } }
    const view = createLivePrivyClientView(ref)

    expect(view.ready).toBe(false)
    expect(view.user).toBeNull()

    ref.current = { ready: true, user: { id: 'did:privy:123' } }

    expect(view.ready).toBe(true)
    expect(view.user).toEqual({ id: 'did:privy:123' })
  })

  it('delegates getAccessToken to whatever is on the ref at call time', async () => {
    const ref: { current: SafePrivyClient } = { current: {} }
    const view = createLivePrivyClientView(ref)

    await expect(view.getAccessToken?.()).resolves.toBeNull()

    const getAccessToken = vi.fn(async () => 'fresh-token')
    ref.current = { getAccessToken }

    await expect(view.getAccessToken?.()).resolves.toBe('fresh-token')
    expect(getAccessToken).toHaveBeenCalledTimes(1)
  })

  it('delegates logout to whatever is on the ref at call time', async () => {
    const ref: { current: SafePrivyClient } = { current: {} }
    const view = createLivePrivyClientView(ref)

    await expect(view.logout?.()).resolves.toBeUndefined()

    const logout = vi.fn(async () => undefined)
    ref.current = { logout }

    await view.logout?.()
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
