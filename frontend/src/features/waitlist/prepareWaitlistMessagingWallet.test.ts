import { describe, expect, it, vi } from 'vitest'

import {
  findLiveEmbeddedPrivyWallet,
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

  it('returns early when wagmi already has a wallet client', async () => {
    const connectAsync = vi.fn()
    const result = await prepareWaitlistMessagingWallet({
      wallets: [],
      embeddedEoaAddress: null,
      ensureEmbeddedWallet: vi.fn(),
      connectAsync,
      connectors: [],
      hasWagmiWallet: true,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).not.toHaveBeenCalled()
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
      hasWagmiWallet: false,
    })
    expect(result).toEqual({ ok: true })
    expect(connectAsync).toHaveBeenCalledTimes(1)
  })
})
