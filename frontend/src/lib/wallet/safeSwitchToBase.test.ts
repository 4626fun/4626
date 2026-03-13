import { describe, expect, it, vi } from 'vitest'

import { BASE_CHAIN_ID_HEX, ensureProviderOnBase, ensureWagmiChainOnBase } from './safeSwitchToBase'

describe('safeSwitchToBase', () => {
  it('switches wagmi chain to Base when needed', async () => {
    const switchChainAsync = vi.fn(async () => {})

    await ensureWagmiChainOnBase({
      currentChainId: 1,
      switchChainAsync,
      label: 'wallet',
    })

    expect(switchChainAsync).toHaveBeenCalledWith({ chainId: 8453 })
  })

  it('throws clear wagmi error when switch is unavailable', async () => {
    await expect(
      ensureWagmiChainOnBase({
        currentChainId: 1,
        switchChainAsync: null,
        label: 'wallet',
      }),
    ).rejects.toThrow('Please switch wallet to Base network to continue.')
  })

  it('does not call wagmi switch when already on Base', async () => {
    const switchChainAsync = vi.fn(async () => {})

    await ensureWagmiChainOnBase({
      currentChainId: 8453,
      switchChainAsync,
      label: 'wallet',
    })

    expect(switchChainAsync).not.toHaveBeenCalled()
  })

  it('switches provider chain to Base when needed', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce('0x1')
      .mockResolvedValueOnce(null)

    await ensureProviderOnBase({
      provider: { request },
      label: 'embedded wallet',
    })

    expect(request).toHaveBeenNthCalledWith(1, { method: 'eth_chainId' })
    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    })
  })

  it('throws when provider switch is blocked', async () => {
    const request = vi.fn().mockResolvedValueOnce('0x1')

    await expect(
      ensureProviderOnBase({
        provider: { request },
        label: 'embedded wallet',
        allowSwitch: false,
      }),
    ).rejects.toThrow('Please switch embedded wallet to Base network to continue.')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('throws when provider switch request fails', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce('0x1')
      .mockRejectedValueOnce(new Error('switch failed'))

    await expect(
      ensureProviderOnBase({
        provider: { request },
        label: 'embedded wallet',
      }),
    ).rejects.toThrow('Please switch embedded wallet to Base network to continue.')
  })
})
