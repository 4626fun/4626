import { afterEach, describe, expect, it, vi } from 'vitest'

import type { InAppEnvironment } from '@/lib/wallet/inAppBrowser'

import { shouldPromptNativeConfirmForXmtpInstallationReset } from './xmtpInstallationReset'

function env(partial: Partial<InAppEnvironment>): InAppEnvironment {
  return {
    hasInjectedEthereum: true,
    isCoinbaseInApp: false,
    isBaseAppInApp: false,
    isAnyWalletInApp: false,
    userAgent: 'Mozilla/5.0',
    ...partial,
  }
}

describe('shouldPromptNativeConfirmForXmtpInstallationReset', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prompts on desktop browsers outside wallet webviews', () => {
    vi.stubGlobal('window', {})
    expect(shouldPromptNativeConfirmForXmtpInstallationReset(env({}))).toBe(true)
  })

  it('skips confirm during SSR when window is unavailable', () => {
    vi.stubGlobal('window', undefined)
    expect(shouldPromptNativeConfirmForXmtpInstallationReset(env({}))).toBe(false)
  })

  it('skips confirm in Base App in-app context', () => {
    vi.stubGlobal('window', {})
    expect(
      shouldPromptNativeConfirmForXmtpInstallationReset(
        env({
          isBaseAppInApp: true,
          isAnyWalletInApp: true,
          userAgent: 'Mozilla/5.0 Toshi BaseApp',
        }),
      ),
    ).toBe(false)
  })

  it('skips confirm for Coinbase Wallet in-app webviews', () => {
    vi.stubGlobal('window', {})
    expect(
      shouldPromptNativeConfirmForXmtpInstallationReset(
        env({
          isCoinbaseInApp: true,
          isAnyWalletInApp: true,
          userAgent: 'Mozilla/5.0 CoinbaseWallet wv',
        }),
      ),
    ).toBe(false)
  })

  it('skips confirm for Base App UA markers without isBaseApp flag', () => {
    vi.stubGlobal('window', {})
    expect(
      shouldPromptNativeConfirmForXmtpInstallationReset(
        env({
          userAgent: 'Mozilla/5.0 (iPhone; cbios) baseapp',
        }),
      ),
    ).toBe(false)
  })
})
