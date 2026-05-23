import { describe, it, expect, vi } from 'vitest'

import {
  getExistingSubAccount,
  createSubAccount,
  configureSubAccountSigner,
  type SubAccount,
} from './subAccountSetup'

const PARENT_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const SUB_ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111' as const
const EMBEDDED_ADDRESS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const

function mockSubAccount(overrides?: Partial<SubAccount>): SubAccount {
  return {
    address: SUB_ACCOUNT_ADDRESS,
    ...overrides,
  }
}

function mockProvider(handlers: Record<string, unknown>) {
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      const handler = handlers[method]
      if (typeof handler === 'function') return handler()
      return handler
    }),
  }
}

describe('getExistingSubAccount', () => {
  it('returns the first sub-account when present', async () => {
    const sub = mockSubAccount()
    const provider = mockProvider({
      wallet_getSubAccounts: { subAccounts: [sub] },
    })

    const result = await getExistingSubAccount({
      provider,
      parentAddress: PARENT_ADDRESS,
    })

    expect(result).toEqual(sub)
  })

  it('returns null when no sub-accounts exist', async () => {
    const provider = mockProvider({
      wallet_getSubAccounts: { subAccounts: [] },
    })

    const result = await getExistingSubAccount({
      provider,
      parentAddress: PARENT_ADDRESS,
    })

    expect(result).toBeNull()
  })
})

describe('createSubAccount', () => {
  it('creates a sub-account via wallet_addSubAccount', async () => {
    const sub = mockSubAccount()
    const provider = mockProvider({
      wallet_addSubAccount: sub,
    })

    const result = await createSubAccount({
      provider,
      embeddedWalletAddress: EMBEDDED_ADDRESS,
    })

    expect(result).toEqual(sub)
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addSubAccount' }),
    )
  })
})

describe('configureSubAccountSigner', () => {
  it('registers setToOwnerAccount callback with embedded wallet account', async () => {
    const mockViemAccount = { address: EMBEDDED_ADDRESS, type: 'local' }
    const setToOwnerAccount = vi.fn()
    const toViemAccountFn = vi.fn().mockResolvedValue(mockViemAccount)
    const embeddedWallet = { address: EMBEDDED_ADDRESS }

    await configureSubAccountSigner({
      baseAccountSdk: { subAccount: { setToOwnerAccount } },
      toViemAccountFn,
      embeddedWallet,
    })

    expect(setToOwnerAccount).toHaveBeenCalledTimes(1)

    const registeredFn = setToOwnerAccount.mock.calls[0]![0]
    const result = await registeredFn()
    expect(toViemAccountFn).toHaveBeenCalledWith({ wallet: embeddedWallet })
    expect(result).toEqual({ account: mockViemAccount })
  })
})
