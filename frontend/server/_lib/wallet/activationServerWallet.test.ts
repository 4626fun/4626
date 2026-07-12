import { describe, expect, it, vi } from 'vitest'

import { resolveActivationServerWallet } from './activationServerWallet'

const CSW = '0x1111111111111111111111111111111111111111'
const SERVER = '0x2222222222222222222222222222222222222222'

describe('resolveActivationServerWallet', () => {
  it('reuses a persisted wallet without creating a replacement', async () => {
    const fetchWallet = vi.fn(async () => ({ walletId: 'wallet-1', address: SERVER }))
    const createWallet = vi.fn(async () => ({ walletId: 'wallet-2', address: SERVER }))

    await expect(
      resolveActivationServerWallet({
        profileId: 42,
        parentCswAddress: CSW,
        persistedWalletId: 'wallet-1',
        persistedWalletAddress: SERVER,
        fetchWallet,
        createWallet,
      }),
    ).resolves.toEqual({ walletId: 'wallet-1', address: SERVER })
    expect(fetchWallet).toHaveBeenCalledWith('wallet-1')
    expect(createWallet).not.toHaveBeenCalled()
  })

  it('creates with a profile-and-parent-CSW idempotency key when unbound', async () => {
    const createWallet = vi.fn(async () => ({ walletId: 'wallet-1', address: SERVER }))
    await resolveActivationServerWallet({
      profileId: 42,
      parentCswAddress: CSW,
      persistedWalletId: null,
      persistedWalletAddress: null,
      fetchWallet: vi.fn(),
      createWallet,
    })

    expect(createWallet).toHaveBeenCalledWith(`enable-4626:42:${CSW}`)
  })

  it('fails closed when the persisted address does not match Privy', async () => {
    await expect(
      resolveActivationServerWallet({
        profileId: 42,
        parentCswAddress: CSW,
        persistedWalletId: 'wallet-1',
        persistedWalletAddress: SERVER,
        fetchWallet: async () => ({
          walletId: 'wallet-1',
          address: '0x3333333333333333333333333333333333333333',
        }),
        createWallet: vi.fn(),
      }),
    ).rejects.toThrow('persisted_server_wallet_binding_mismatch')
  })

  it('recreates when a persisted Privy wallet ID is gone', async () => {
    const createWallet = vi.fn(async () => ({ walletId: 'wallet-2', address: SERVER }))
    await expect(
      resolveActivationServerWallet({
        profileId: 42,
        parentCswAddress: CSW,
        persistedWalletId: 'wallet-missing',
        persistedWalletAddress: SERVER,
        fetchWallet: async () => {
          throw new Error('privy_http_404: wallet not found')
        },
        createWallet,
      }),
    ).resolves.toEqual({ walletId: 'wallet-2', address: SERVER })
    expect(createWallet).toHaveBeenCalledWith(`enable-4626:42:${CSW}`)
  })

  it('still fails closed on non-404 Privy fetch errors', async () => {
    const createWallet = vi.fn()
    await expect(
      resolveActivationServerWallet({
        profileId: 42,
        parentCswAddress: CSW,
        persistedWalletId: 'wallet-1',
        persistedWalletAddress: SERVER,
        fetchWallet: async () => {
          throw new Error('privy_http_500: boom')
        },
        createWallet,
      }),
    ).rejects.toThrow('privy_http_500')
    expect(createWallet).not.toHaveBeenCalled()
  })
})
