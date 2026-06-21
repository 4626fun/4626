import { describe, expect, it, vi } from 'vitest'

import {
  findLiveEmbeddedPrivyWallet,
  isWaitlistMessagingWagmiConnector,
  prepareWaitlistMessagingWallet,
} from './prepareWaitlistMessagingWallet'

const EMBEDDED = '0x2222222222222222222222222222222222222222'

const mockWalletClient = {
  account: { address: EMBEDDED },
  signMessage: vi.fn(),
}

vi.mock('@/lib/xmtp/waitForMessagingWallet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/xmtp/waitForMessagingWallet')>()
  return {
    ...actual,
    waitForMessagingWallet: vi.fn(async () => ({
      address: EMBEDDED,
      walletClient: mockWalletClient,
      connector: { id: 'privy-embedded-waitlist' },
    })),
  }
})

const wagmiConfig = {} as import('wagmi').Config

describe('prepareWaitlistMessagingWallet', () => {
  it('finds the live embedded Privy wallet by address', () => {
    const wallet = findLiveEmbeddedPrivyWallet(
      [
        { address: '0x1111111111111111111111111111111111111111', walletClientType: 'metamask' },
        { address: EMBEDDED, walletClientType: 'privy' },
      ],
      EMBEDDED,
    )
    expect(wallet?.address).toBe(EMBEDDED)
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
      wagmiConfig,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).not.toHaveBeenCalled()
  })

  it('disconnects stale wagmi connectors before embedded connect', async () => {
    const connectAsync = vi.fn(async () => ({ accounts: [EMBEDDED] }))
    const disconnectAsync = vi.fn(async () => undefined)
    const result = await prepareWaitlistMessagingWallet({
      wallets: [
        {
          address: EMBEDDED,
          walletClientType: 'privy',
          provider: { request: vi.fn() },
        },
      ],
      embeddedEoaAddress: EMBEDDED,
      ensureEmbeddedWallet: vi.fn(async () => ({
        address: EMBEDDED,
      })),
      connectAsync,
      disconnectAsync,
      activeConnectorId: 'coinbaseWalletSDK',
      connectors: [],
      messagingWalletReady: false,
      wagmiConfig,
    })
    expect(result).toEqual({ ok: true })
    expect(disconnectAsync).toHaveBeenCalledTimes(1)
    expect(connectAsync).toHaveBeenCalledTimes(1)
  })

  it('connects injected fallback when Privy connector is unavailable', async () => {
    const connectAsync = vi.fn(async () => ({ accounts: [EMBEDDED] }))
    const result = await prepareWaitlistMessagingWallet({
      wallets: [
        {
          address: EMBEDDED,
          walletClientType: 'privy',
          provider: { request: vi.fn() },
        },
      ],
      embeddedEoaAddress: EMBEDDED,
      ensureEmbeddedWallet: vi.fn(async () => ({
        address: EMBEDDED,
      })),
      connectAsync,
      connectors: [],
      messagingWalletReady: false,
      wagmiConfig,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).toHaveBeenCalledTimes(1)
  })
})
