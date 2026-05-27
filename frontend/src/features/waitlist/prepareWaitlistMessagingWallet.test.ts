import { describe, expect, it, vi } from 'vitest'

import {
  findLiveEmbeddedPrivyWallet,
  isWaitlistMessagingWagmiConnector,
  prepareWaitlistMessagingWallet,
} from './prepareWaitlistMessagingWallet'

describe('prepareWaitlistMessagingWallet', () => {
  it('finds the live embedded Privy wallet by address', () => {
    const wallet = findLiveEmbeddedPrivyWallet(
      [
        { address: '0x1111111111111111111111111111111111111111', walletClientType: 'metamask' },
        { address: '0x2222222222222222222222222222222222222222', walletClientType: 'privy' },
      ],
      '0x2222222222222222222222222222222222222222',
    )
    expect(wallet?.address).toBe('0x2222222222222222222222222222222222222222')
  })

  it('recognizes waitlist messaging connectors', () => {
    expect(isWaitlistMessagingWagmiConnector('privy-embedded-waitlist')).toBe(true)
    expect(isWaitlistMessagingWagmiConnector('io.privy.wallet')).toBe(true)
    expect(isWaitlistMessagingWagmiConnector('coinbaseWalletSDK')).toBe(false)
  })

  it('returns early when the embedded messaging wallet is already connected', async () => {
    const connectAsync = vi.fn()
    const result = await prepareWaitlistMessagingWallet({
      wallets: [],
      embeddedEoaAddress: null,
      ensureEmbeddedWallet: vi.fn(),
      connectAsync,
      connectors: [],
      messagingWalletReady: true,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).not.toHaveBeenCalled()
  })

  it('disconnects stale wagmi connectors before embedded connect', async () => {
    const connectAsync = vi.fn(async () => ({ accounts: ['0x2222222222222222222222222222222222222222'] }))
    const disconnectAsync = vi.fn(async () => undefined)
    const result = await prepareWaitlistMessagingWallet({
      wallets: [
        {
          address: '0x2222222222222222222222222222222222222222',
          walletClientType: 'privy',
          provider: { request: vi.fn() },
        },
      ],
      embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
      ensureEmbeddedWallet: vi.fn(async () => ({
        address: '0x2222222222222222222222222222222222222222',
      })),
      connectAsync,
      disconnectAsync,
      activeConnectorId: 'coinbaseWalletSDK',
      connectors: [],
      messagingWalletReady: false,
    })
    expect(result).toEqual({ ok: true })
    expect(disconnectAsync).toHaveBeenCalledTimes(1)
    expect(connectAsync).toHaveBeenCalledTimes(1)
  })

  it('connects injected fallback when Privy connector is unavailable', async () => {
    const connectAsync = vi.fn(async () => ({ accounts: ['0x2222222222222222222222222222222222222222'] }))
    const result = await prepareWaitlistMessagingWallet({
      wallets: [
        {
          address: '0x2222222222222222222222222222222222222222',
          walletClientType: 'privy',
          provider: { request: vi.fn() },
        },
      ],
      embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
      ensureEmbeddedWallet: vi.fn(async () => ({
        address: '0x2222222222222222222222222222222222222222',
      })),
      connectAsync,
      connectors: [],
      messagingWalletReady: false,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).toHaveBeenCalledTimes(1)
  })
})
