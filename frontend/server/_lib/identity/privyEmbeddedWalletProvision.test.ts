// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const createWalletsMock = vi.fn()
const getUserByIdMock = vi.fn()
const walletApiCreateMock = vi.fn()

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    createWallets = createWalletsMock
    getUserById = getUserByIdMock
    walletApi = { create: walletApiCreateMock }
  },
}))

import { PrivyClient } from '@privy-io/server-auth'
import { ensurePrivyUserEmbeddedWallet } from './privyEmbeddedWalletProvision.ts'

describe('ensurePrivyUserEmbeddedWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserByIdMock.mockResolvedValue({
      id: 'did:privy:user',
      linkedAccounts: [],
    })
    createWalletsMock.mockResolvedValue({
      id: 'did:privy:user',
      linkedAccounts: [],
    })
    walletApiCreateMock.mockRejectedValue(new Error('unavailable'))
  })

  it('uses createEthereumWallet first and returns when an embedded EOA appears', async () => {
    createWalletsMock.mockResolvedValueOnce({
      id: 'did:privy:user',
      linkedAccounts: [
        {
          type: 'wallet',
          address: '0x00000000000000000000000000000000000000aa',
          walletClientType: 'privy',
          chainType: 'ethereum',
        },
      ],
    })

    const client = new PrivyClient('app', 'secret') as any
    const result = await ensurePrivyUserEmbeddedWallet(client, 'did:privy:user')

    expect(createWalletsMock).toHaveBeenCalledWith({
      userId: 'did:privy:user',
      createEthereumWallet: true,
      createSolanaWallet: false,
      createEthereumSmartWallet: false,
      numberOfEthereumWalletsToCreate: 1,
    })
    expect(walletApiCreateMock).not.toHaveBeenCalled()
    expect(result.classified.embeddedEoa?.address).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('synthesizes a linked account when walletApi.create returns an address', async () => {
    walletApiCreateMock.mockResolvedValue({
      id: 'wallet-1',
      address: '0x00000000000000000000000000000000000000bb',
    })

    const client = new PrivyClient('app', 'secret') as any
    const result = await ensurePrivyUserEmbeddedWallet(client, 'did:privy:user')

    expect(walletApiCreateMock).toHaveBeenCalledWith({
      chainType: 'ethereum',
      owner: { userId: 'did:privy:user' },
    })
    expect(result.classified.embeddedEoa?.address).toBe('0x00000000000000000000000000000000000000bb')
  })
})
