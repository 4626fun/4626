import { describe, expect, it, vi } from 'vitest'

import { refreshPrivyEmbeddedSignerSession } from '@/lib/privy/refreshEmbeddedSignerSession'

describe('refreshPrivyEmbeddedSignerSession', () => {
  it('re-selects the embedded wallet and re-acquires the provider when token is live', async () => {
    const setActiveWallet = vi.fn(async () => undefined)
    const getEthereumProvider = vi.fn(async () => ({ request: vi.fn() }))
    const wallet = { getEthereumProvider }

    await expect(
      refreshPrivyEmbeddedSignerSession({
        wallet,
        setActiveWallet,
        getToken: async () => 'header.payload.signature',
      }),
    ).resolves.toBe(true)

    expect(setActiveWallet).toHaveBeenCalledWith(wallet)
    expect(getEthereumProvider).toHaveBeenCalledTimes(1)
  })

  it('throws when the access token is missing or expired', async () => {
    await expect(
      refreshPrivyEmbeddedSignerSession({
        getToken: async () => null,
      }),
    ).rejects.toThrow(/Privy session expired/)
  })

  it('throws a signing-session-not-ready error when getEthereumProvider fails on both attempts', async () => {
    const setActiveWallet = vi.fn(async () => undefined)
    const getEthereumProvider = vi.fn(async () => {
      throw new Error('Missing auth token')
    })
    const wallet = { getEthereumProvider }

    await expect(
      refreshPrivyEmbeddedSignerSession({
        wallet,
        setActiveWallet,
        getToken: async () => 'header.payload.signature',
      }),
    ).rejects.toThrow(/signing session could not be refreshed/i)

    // Initial setActiveWallet call + one bounded retry re-selection.
    expect(setActiveWallet).toHaveBeenCalledTimes(2)
    expect(getEthereumProvider).toHaveBeenCalledTimes(2)
  })

  it('throws when getEthereumProvider resolves but the iframe still 401s on a real RPC probe', async () => {
    const request = vi.fn(async () => {
      throw new Error('UnknownRpcError: Missing auth token')
    })
    const getEthereumProvider = vi.fn(async () => ({ request }))
    const wallet = { getEthereumProvider }

    await expect(
      refreshPrivyEmbeddedSignerSession({
        wallet,
        getToken: async () => 'header.payload.signature',
      }),
    ).rejects.toThrow(/signing session could not be refreshed/i)

    expect(getEthereumProvider).toHaveBeenCalledTimes(2)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('recovers on the bounded retry when the embedded provider is only transiently not ready', async () => {
    const setActiveWallet = vi.fn(async () => undefined)
    const getEthereumProvider = vi
      .fn()
      .mockRejectedValueOnce(new Error('Missing auth token'))
      .mockResolvedValueOnce({ request: vi.fn(async () => ['0xabc']) })
    const wallet = { getEthereumProvider }

    await expect(
      refreshPrivyEmbeddedSignerSession({
        wallet,
        setActiveWallet,
        getToken: async () => 'header.payload.signature',
      }),
    ).resolves.toBe(true)

    expect(getEthereumProvider).toHaveBeenCalledTimes(2)
  })
})
