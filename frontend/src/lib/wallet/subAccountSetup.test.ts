import { describe, it, expect, vi } from 'vitest'
import {
  getExistingSubAccount,
  createSubAccount,
  configureSubAccountSigner,
  setupSubAccount,
  type SubAccount,
  type SubAccountSetupStageEvent,
} from './subAccountSetup'

// ── Helpers ────────────────────────────────────────────────────────

const PARENT_ADDRESS = '0xab6d5c10b03300326cd7fab7267ae192842967b5' as const
const EMBEDDED_ADDRESS = '0xb2aad65a5402714bf428a66731ae62ba5c45cac0' as const
const SUB_ACCOUNT_ADDRESS = '0x1111111111111111111111111111111111111111' as const

function mockProvider(overrides?: Record<string, any>) {
  return {
    request: vi.fn(async (args: { method: string; params?: any[] }) => {
      if (overrides?.[args.method] !== undefined) {
        const handler = overrides[args.method]
        return typeof handler === 'function' ? handler(args) : handler
      }
      throw new Error(`Unexpected RPC: ${args.method}`)
    }),
  }
}

function mockSubAccount(): SubAccount {
  return {
    address: SUB_ACCOUNT_ADDRESS,
    factory: '0xfactory0000000000000000000000000000000000' as `0x${string}`,
    factoryData: '0xfactorydata' as `0x${string}`,
  }
}

// ── getExistingSubAccount ──────────────────────────────────────────

describe('getExistingSubAccount', () => {
  it('returns a sub-account when one exists', async () => {
    const sub = mockSubAccount()
    const provider = mockProvider({
      wallet_getSubAccounts: { subAccounts: [sub] },
    })

    const result = await getExistingSubAccount({ provider, parentAddress: PARENT_ADDRESS })
    expect(result).toEqual(sub)
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_getSubAccounts',
      params: [
        {
          account: PARENT_ADDRESS,
          domain: expect.any(String),
        },
      ],
    })
  })

  it('returns null when no sub-accounts exist', async () => {
    const provider = mockProvider({
      wallet_getSubAccounts: { subAccounts: [] },
    })

    const result = await getExistingSubAccount({ provider, parentAddress: PARENT_ADDRESS })
    expect(result).toBeNull()
  })

  it('handles array response format', async () => {
    const sub = mockSubAccount()
    const provider = mockProvider({
      wallet_getSubAccounts: [sub],
    })

    const result = await getExistingSubAccount({ provider, parentAddress: PARENT_ADDRESS })
    expect(result).toEqual(sub)
  })

  it('returns null for empty array response', async () => {
    const provider = mockProvider({
      wallet_getSubAccounts: [],
    })

    const result = await getExistingSubAccount({ provider, parentAddress: PARENT_ADDRESS })
    expect(result).toBeNull()
  })
})

// ── createSubAccount ───────────────────────────────────────────────

describe('createSubAccount', () => {
  it('creates a sub-account with the embedded wallet address', async () => {
    const sub = mockSubAccount()
    const provider = mockProvider({
      wallet_addSubAccount: sub,
    })

    const result = await createSubAccount({
      provider,
      embeddedWalletAddress: EMBEDDED_ADDRESS,
    })

    expect(result.address).toBe(SUB_ACCOUNT_ADDRESS)
    expect(provider.request).toHaveBeenCalledWith({
      method: 'wallet_addSubAccount',
      params: [
        {
          version: '1',
          account: {
            type: 'create',
            keys: [
              {
                type: 'address',
                publicKey: EMBEDDED_ADDRESS,
              },
            ],
          },
        },
      ],
    })
  })

  it('throws when the RPC returns null', async () => {
    const provider = mockProvider({
      wallet_addSubAccount: null,
    })

    await expect(
      createSubAccount({ provider, embeddedWalletAddress: EMBEDDED_ADDRESS }),
    ).rejects.toThrow('wallet_addSubAccount did not return a valid sub-account')
  })

  it('throws when the returned address is invalid', async () => {
    const provider = mockProvider({
      wallet_addSubAccount: { address: 'not-an-address' },
    })

    await expect(
      createSubAccount({ provider, embeddedWalletAddress: EMBEDDED_ADDRESS }),
    ).rejects.toThrow('not a valid address')
  })
})

// ── configureSubAccountSigner ──────────────────────────────────────

describe('configureSubAccountSigner', () => {
  it('calls setToOwnerAccount with a function that invokes toViemAccount', async () => {
    const setToOwnerAccount = vi.fn()
    const mockViemAccount = { address: EMBEDDED_ADDRESS, type: 'local' }
    const toViemAccountFn = vi.fn().mockResolvedValue(mockViemAccount)
    const embeddedWallet = { address: EMBEDDED_ADDRESS }

    configureSubAccountSigner({
      baseAccountSdk: { subAccount: { setToOwnerAccount } },
      toViemAccountFn,
      embeddedWallet,
    })

    expect(setToOwnerAccount).toHaveBeenCalledTimes(1)

    // Invoke the registered callback
    const registeredFn = setToOwnerAccount.mock.calls[0]![0]
    const result = await registeredFn()
    expect(toViemAccountFn).toHaveBeenCalledWith({ wallet: embeddedWallet })
    expect(result).toEqual({ account: mockViemAccount })
  })
})

// ── setupSubAccount (full orchestration) ───────────────────────────

describe('setupSubAccount', () => {
  const mockViemAccount = { address: EMBEDDED_ADDRESS, type: 'local' }

  function createSetupParams(overrides?: {
    existingSubAccount?: SubAccount | null
    provider?: any
  }) {
    const sub = overrides?.existingSubAccount ?? null
    const provider = overrides?.provider ?? mockProvider({
      wallet_getSubAccounts: { subAccounts: sub ? [sub] : [] },
      wallet_addSubAccount: mockSubAccount(),
    })

    return {
      baseAccountWallet: {
        address: PARENT_ADDRESS,
        getEthereumProvider: vi.fn().mockResolvedValue(provider),
        switchChain: vi.fn().mockResolvedValue(undefined),
      },
      embeddedWallet: {
        address: EMBEDDED_ADDRESS,
      },
      baseAccountSdk: {
        subAccount: {
          setToOwnerAccount: vi.fn(),
        },
      },
      toViemAccountFn: vi.fn().mockResolvedValue(mockViemAccount),
    }
  }

  it('creates a new sub-account when none exists', async () => {
    const params = createSetupParams()
    const stages: SubAccountSetupStageEvent[] = []

    const result = await setupSubAccount({
      ...params,
      onStageEvent: (e) => stages.push(e),
    })

    expect(result.subAccountAddress).toBe(SUB_ACCOUNT_ADDRESS)
    expect(result.parentAddress).toBe(PARENT_ADDRESS)
    expect(result.created).toBe(true)
    expect(params.baseAccountSdk.subAccount.setToOwnerAccount).toHaveBeenCalledTimes(1)
    expect(stages.some((s) => s.stage === 'create_sub_account' && s.status === 'success')).toBe(true)
    expect(stages.some((s) => s.stage === 'done' && s.status === 'success')).toBe(true)
  })

  it('reuses an existing sub-account', async () => {
    const existing = mockSubAccount()
    const params = createSetupParams({ existingSubAccount: existing })
    const stages: SubAccountSetupStageEvent[] = []

    const result = await setupSubAccount({
      ...params,
      onStageEvent: (e) => stages.push(e),
    })

    expect(result.subAccountAddress).toBe(SUB_ACCOUNT_ADDRESS)
    expect(result.created).toBe(false)
    // Should not call wallet_addSubAccount
    expect(stages.some((s) => s.stage === 'create_sub_account')).toBe(false)
  })

  it('calls switchChain to Base', async () => {
    const params = createSetupParams()
    await setupSubAccount(params)

    expect(params.baseAccountWallet.switchChain).toHaveBeenCalledWith(8453)
  })

  it('throws on invalid parent address', async () => {
    const params = createSetupParams()
    params.baseAccountWallet.address = 'invalid' as any

    await expect(setupSubAccount(params)).rejects.toThrow('not a valid address')
  })

  it('throws on invalid embedded wallet address', async () => {
    const params = createSetupParams()
    params.embeddedWallet.address = '' as any

    await expect(setupSubAccount(params)).rejects.toThrow('not a valid address')
  })

  it('emits error stage event when creation fails', async () => {
    const provider = mockProvider({
      wallet_getSubAccounts: { subAccounts: [] },
      wallet_addSubAccount: () => {
        throw new Error('User rejected')
      },
    })
    const params = createSetupParams({ provider })
    const stages: SubAccountSetupStageEvent[] = []

    await expect(
      setupSubAccount({
        ...params,
        onStageEvent: (e) => stages.push(e),
      }),
    ).rejects.toThrow('Failed to create sub-account')

    expect(stages.some((s) => s.stage === 'create_sub_account' && s.status === 'error')).toBe(true)
  })
})
