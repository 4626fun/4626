import { beforeEach, describe, expect, it, vi } from 'vitest'

const { syncUserWalletsMock } = vi.hoisted(() => ({
  syncUserWalletsMock: vi.fn(async () => ({ profileId: 42 })),
}))

vi.mock('../wallet/walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
}))

import { hasLinkedExternalEoa, refineAccountIdentityFromPrivy } from './accountsIdentity'

describe('hasLinkedExternalEoa', () => {
  it('returns false for email-only Privy users', () => {
    expect(
      hasLinkedExternalEoa({
        linkedAccounts: [{ type: 'email', address: 'user@example.com' }],
      } as any),
    ).toBe(false)
  })

  it('returns true when an external wallet is linked', () => {
    expect(
      hasLinkedExternalEoa({
        linkedAccounts: [
          {
            type: 'wallet',
            address: '0x1111111111111111111111111111111111111111',
            chainType: 'ethereum',
            walletClientType: 'metamask',
          },
        ],
      } as any),
    ).toBe(true)
  })
})

describe('refineAccountIdentityFromPrivy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls syncUserWallets for the Privy user', async () => {
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    await refineAccountIdentityFromPrivy({
      db: { sql: vi.fn() } as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })

    expect(syncUserWalletsMock).toHaveBeenCalledWith({ sql: expect.any(Function) }, privyUser)
  })

  it('continues when wallet sync fails', async () => {
    syncUserWalletsMock.mockRejectedValueOnce(new Error('wallet_sync_failed'))

    await expect(
      refineAccountIdentityFromPrivy({
        db: { sql: vi.fn() } as any,
        privyUserId: 'did:privy:test-user',
        privyUser: { id: 'did:privy:test-user' } as any,
      }),
    ).resolves.toBeUndefined()
  })
})
