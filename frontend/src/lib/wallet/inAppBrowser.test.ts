import { afterEach, describe, expect, it, vi } from 'vitest'

import { detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'

function mockWindow(options: {
  userAgent: string
  ethereum?: Record<string, unknown> | null
}) {
  vi.stubGlobal('navigator', { userAgent: options.userAgent })
  vi.stubGlobal('window', {
    ethereum: options.ethereum ?? undefined,
  })
}

describe('isBaseAppInAppContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not treat desktop Chrome with Coinbase Wallet extension as Base App', () => {
    mockWindow({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ethereum: { isCoinbaseWallet: true },
    })
    const env = detectInAppEnvironment()
    expect(env?.isBaseAppInApp).toBe(false)
    expect(isBaseAppInAppContext(env)).toBe(false)
  })

  it('detects Base App webview via isToshi', () => {
    mockWindow({
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      ethereum: { isToshi: true, isCoinbaseWallet: true },
    })
    expect(isBaseAppInAppContext()).toBe(true)
  })

  it('detects Coinbase in-app webview via wv user agent', () => {
    mockWindow({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 CoinbaseWallet/1.0',
      ethereum: { isCoinbaseWallet: true, isCoinbaseBrowser: true },
    })
    expect(isBaseAppInAppContext()).toBe(true)
  })
})
