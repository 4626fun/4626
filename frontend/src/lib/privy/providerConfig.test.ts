import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/flags/flags', async () => {
  const actual = await vi.importActual<typeof import('@/lib/flags/flags')>('@/lib/flags/flags')
  return {
    ...actual,
    canUsePrivyEmbeddedWallets: () => true,
  }
})

import {
  buildPrivyExternalWallets,
  isWaitlistPrivyMode,
  resolvePrivyEmbeddedWallets,
  resolvePrivyLoginMethods,
  TELEGRAM_LINK_APPEARANCE,
  WAITLIST_EMBEDDED_WALLETS_OFF,
} from '@/lib/privy/providerConfig'

const solanaConnectors = {
  onMount: () => {},
  onUnmount: () => {},
  get: () => [],
}

describe('providerConfig modes', () => {
  it('keeps waitlist embedded wallets explicitly off', () => {
    expect(isWaitlistPrivyMode('waitlist')).toBe(true)
    expect(resolvePrivyEmbeddedWallets('waitlist')).toEqual(WAITLIST_EMBEDDED_WALLETS_OFF)
    expect(resolvePrivyLoginMethods('waitlist')).toEqual(['email', 'wallet', 'twitter'])
  })

  it('configures telegram-link as email-only with server-owned wallet creation', () => {
    expect(isWaitlistPrivyMode('telegram-link')).toBe(false)
    expect(resolvePrivyLoginMethods('telegram-link')).toEqual(['email'])
    expect(TELEGRAM_LINK_APPEARANCE.walletList).toEqual(['coinbase_wallet'])
    const embedded = resolvePrivyEmbeddedWallets('telegram-link')
    expect(embedded).toEqual(WAITLIST_EMBEDDED_WALLETS_OFF)
  })

  it('keeps one stable connector set for waitlist OTP and wallet actions', () => {
    const wallets = buildPrivyExternalWallets({
      mode: 'waitlist',
      solanaConnectors,
    }) as Record<string, unknown>
    expect(wallets.walletConnect).toEqual({ enabled: true })
    expect(wallets.coinbaseWallet).toEqual({ connectionOptions: 'all' })
    expect(wallets.crossApp).toEqual({ providerAppIds: ['clpgf04wn04hnkw0fv1m11mnb'] })
  })

  it('keeps telegram-link external wallets minimal', () => {
    const wallets = buildPrivyExternalWallets({
      mode: 'telegram-link',
      solanaConnectors,
    }) as Record<string, unknown>
    expect(wallets.walletConnect).toBeUndefined()
    expect(wallets.coinbaseWallet).toBeUndefined()
    expect(wallets.crossApp).toBeUndefined()
  })

  it('uses users-without-wallets only on the app shell', () => {
    expect(resolvePrivyEmbeddedWallets('default')).toEqual({
      ethereum: { createOnLogin: 'users-without-wallets' },
      solana: { createOnLogin: 'users-without-wallets' },
    })
  })
})
