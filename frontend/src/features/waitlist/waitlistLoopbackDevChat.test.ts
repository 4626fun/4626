import { describe, expect, it, vi } from 'vitest'

import { buildLoopbackAppChatHref, shouldShowLoopbackAppChatShortcut } from './waitlistLoopbackDevChat'

vi.mock('@/lib/env/host', () => ({
  getAppBaseUrl: () => 'http://localhost:5174',
}))

describe('waitlistLoopbackDevChat', () => {
  it('builds swap chat deep link on loopback app origin', () => {
    expect(buildLoopbackAppChatHref()).toBe('http://localhost:5174/swap?chatAction=help')
  })

  it('shows shortcut only on loopback hosts', () => {
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
    } as Window & typeof globalThis)
    expect(shouldShowLoopbackAppChatShortcut()).toBe(true)

    vi.stubGlobal('window', {
      location: { hostname: '4626.fun' },
    } as Window & typeof globalThis)
    expect(shouldShowLoopbackAppChatShortcut()).toBe(false)

    vi.unstubAllGlobals()
  })
})
