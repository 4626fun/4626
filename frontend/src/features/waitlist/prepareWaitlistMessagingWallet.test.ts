import { describe, expect, it, vi } from 'vitest'

import {
  findLiveEmbeddedPrivyWallet,
  isWaitlistMessagingLoopbackHost,
  isWaitlistMessagingWagmiConnector,
  prepareWaitlistMessagingWallet,
  wrapWaitlistMessagingProvider,
} from './prepareWaitlistMessagingWallet'
import { privyAuthorizedWalletPersonalSign } from '@/lib/privy/privyAuthorizedWalletRpc'

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

vi.mock('@/lib/privy/refreshEmbeddedSignerSession', () => ({
  refreshPrivyEmbeddedSignerSession: vi.fn(async () => true),
}))

vi.mock('@/lib/privy/privyAuthorizedWalletRpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/privy/privyAuthorizedWalletRpc')>()
  return {
    ...actual,
    privyAuthorizedWalletPersonalSign: vi.fn(async () => `0x${'11'.repeat(65)}`),
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

  it('routes personal_sign through the authorized Wallet API lane for unified-stack wallets', async () => {
    const realRequest = vi.fn()
    const authorizedPersonalSign = vi.fn(async () => `0x${'ab'.repeat(65)}`)
    const provider = wrapWaitlistMessagingProvider({ request: realRequest }, authorizedPersonalSign)

    const messageHex = `0x${Buffer.from('XMTP : Authenticate to inbox').toString('hex')}`
    const signature = await provider.request({
      method: 'personal_sign',
      params: [messageHex, EMBEDDED],
    })

    expect(signature).toBe(`0x${'ab'.repeat(65)}`)
    expect(authorizedPersonalSign).toHaveBeenCalledWith(messageHex)
    expect(realRequest).not.toHaveBeenCalled()
  })

  it('falls back to the raw embedded provider when the authorized lane fails', async () => {
    const realRequest = vi.fn(async () => `0x${'cd'.repeat(65)}`)
    const authorizedPersonalSign = vi.fn(async () => {
      throw new Error('No valid authorization signatures were provided.')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const provider = wrapWaitlistMessagingProvider({ request: realRequest }, authorizedPersonalSign)

    const messageHex = `0x${Buffer.from('XMTP : Authenticate to inbox').toString('hex')}`
    const signature = await provider.request({
      method: 'personal_sign',
      params: [messageHex, EMBEDDED],
    })

    expect(signature).toBe(`0x${'cd'.repeat(65)}`)
    expect(authorizedPersonalSign).toHaveBeenCalledTimes(1)
    expect(realRequest).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: [messageHex, EMBEDDED],
    })
  })

  it('keeps personal_sign on the raw provider for legacy wallets without an authorized lane', async () => {
    const realRequest = vi.fn(async () => `0x${'ef'.repeat(65)}`)
    const provider = wrapWaitlistMessagingProvider({ request: realRequest })

    const messageHex = `0x${Buffer.from('hello').toString('hex')}`
    const signature = await provider.request({
      method: 'personal_sign',
      params: [messageHex, EMBEDDED],
    })

    expect(signature).toBe(`0x${'ef'.repeat(65)}`)
    expect(realRequest).toHaveBeenCalledTimes(1)
  })

  it('connects the canonical CSW via Coinbase connector for base-app-direct', async () => {
    const CSW = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const connectAsync = vi.fn(async () => ({ accounts: [CSW] }))
    const result = await prepareWaitlistMessagingWallet({
      wallets: [],
      embeddedEoaAddress: null,
      ensureEmbeddedWallet: vi.fn(),
      connectAsync,
      connectors: [{ id: 'coinbaseWalletSDK', name: 'Coinbase Wallet' }],
      messagingWalletReady: false,
      wagmiConfig,
      connectTrack: 'base-app-direct',
      canonicalCswAddress: CSW,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).toHaveBeenCalledTimes(1)
  })

  it('detects loopback hosts for authorized-sign gating', () => {
    vi.stubGlobal('window', {
      location: { hostname: '127.0.0.1' },
    } as Window & typeof globalThis)
    expect(isWaitlistMessagingLoopbackHost()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('returns localhost embedded-signer error before attempting authorized signing', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
    } as Window & typeof globalThis)

    const result = await prepareWaitlistMessagingWallet({
      wallets: [
        {
          id: 'wallet-unified',
          address: EMBEDDED,
          walletClientType: 'privy',
          recovery_method: 'privy-v2',
        },
      ],
      embeddedEoaAddress: EMBEDDED,
      ensureEmbeddedWallet: vi.fn(async () => ({ address: EMBEDDED })),
      connectAsync: vi.fn(),
      connectors: [],
      messagingWalletReady: false,
      wagmiConfig,
      generateAuthorizationSignature: vi.fn(async () => ({ signature: 'auth-sig' })),
    })

    expect(result).toEqual({
      ok: false,
      error:
        'Embedded signer session not ready on localhost (privy.4626.fun custom domain). Sign out completely, hard refresh, and sign in with email OTP again. If linking Zora/OAuth, also allowlist localhost:5173/5174 in your Privy Local Dev client Allowed Origins.',
    })
    expect(vi.mocked(privyAuthorizedWalletPersonalSign)).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
