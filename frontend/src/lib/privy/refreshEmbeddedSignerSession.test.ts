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
})
