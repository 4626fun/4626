import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveCanonicalCsw, resolveConfirmOwnerCanonicalCsw } from './canonicalCswDelegation'

const { ensureWaitlistSchemaMock, syncUserWalletsMock } = vi.hoisted(() => ({
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  syncUserWalletsMock: vi.fn(),
}))

vi.mock('../onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('./walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
}))

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createMockDb(options: {
  profileSeedRow?: {
    primary_smart_wallet?: string | null
    csw_address?: string | null
    base_sub_account?: string | null
  }
  persistedCanonicalAddress?: string | null
} = {}) {
  let canonicalRow: any =
    options.persistedCanonicalAddress && /^0x[a-f0-9]{40}$/i.test(options.persistedCanonicalAddress)
      ? {
          profile_id: 11,
          chain_id: 8453,
          canonical_csw_address: String(options.persistedCanonicalAddress).toLowerCase(),
          canonical_source: 'wallet_sync',
          privy_embedded_eoa_address: null,
          privy_is_owner: false,
          last_checked_at: null,
          address: String(options.persistedCanonicalAddress).toLowerCase(),
          is_canonical_smart_wallet: true,
        }
      : null
  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = normalizeSql(strings)

      if (text.includes("to_regclass('public.profile_wallets') is not null as has_profile_wallets")) {
        return {
          rows: [
            {
              has_profile_wallets: true,
              has_chain_id: true,
              has_canonical_csw_address: true,
              has_canonical_source: true,
              has_privy_embedded_eoa_address: true,
              has_privy_is_owner: true,
              has_last_checked_at: true,
            },
          ],
        }
      }
      if (text.startsWith('do $$')) return { rows: [] }
      if (text.startsWith('alter table profile_wallets')) return { rows: [] }
      if (text.includes('select id from profiles where privy_user_id =')) return { rows: [{ id: 11 }] }
      if (text.includes('with direct as') && text.includes('privy_user_aliases')) {
        return { rows: [{ id: 11, updated_at: null, created_at: null }] }
      }
      if (text.includes('select pw.profile_id')) return { rows: canonicalRow ? [canonicalRow] : [] }
      if (text.includes('insert into wallets')) return { rows: [] }
      if (text.includes('update profile_wallets set is_canonical_smart_wallet = false')) return { rows: [] }
      if (text.includes('insert into profile_wallets')) {
        const canonicalAddress =
          values.find((value) => typeof value === 'string' && /^0x[a-f0-9]{40}$/i.test(value)) ?? null
        canonicalRow = {
          profile_id: 11,
          chain_id: 8453,
          canonical_csw_address: String(canonicalAddress).toLowerCase(),
          canonical_source: 'wallet_sync',
          privy_embedded_eoa_address: null,
          privy_is_owner: false,
          last_checked_at: null,
          address: String(canonicalAddress).toLowerCase(),
          is_canonical_smart_wallet: true,
        }
        return { rows: [] }
      }
      if (text.includes('update profiles')) return { rows: [] }
      if (text.includes('select primary_smart_wallet')) {
        return {
          rows: [
            options.profileSeedRow ?? {
              primary_smart_wallet: null,
              csw_address: null,
              base_sub_account: null,
            },
          ],
        }
      }

      throw new Error(`Unhandled SQL in test: ${text}`)
    }),
  }
}

describe('resolveCanonicalCsw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the persisted canonical when the live session resolves a different smart wallet', async () => {
    syncUserWalletsMock
      .mockResolvedValueOnce({
        profileId: 11,
        canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000AA' },
      })
      .mockResolvedValueOnce({
        profileId: 11,
        canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000BB' },
      })

    const db = createMockDb({
      persistedCanonicalAddress: '0x00000000000000000000000000000000000000AA',
    })
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    const first = await resolveCanonicalCsw({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })
    const second = await resolveCanonicalCsw({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })

    expect(first.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(second.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the persisted canonical when the live session omits a canonical smart wallet', async () => {
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 11,
      canonicalSmartWallet: null,
    })

    const db = createMockDb({
      persistedCanonicalAddress: '0x00000000000000000000000000000000000000AA',
    })
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    const resolved = await resolveCanonicalCsw({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })

    expect(resolved.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
  })

  it('does not write the parent CSW into the app-scoped sub-account column', async () => {
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 11,
      canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000AA' },
    })

    const db = createMockDb()
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    const resolved = await resolveCanonicalCsw({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })

    expect(resolved.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    const updateProfilesCalls = vi.mocked(db.sql).mock.calls
      .map(([strings]) => normalizeSql(strings as TemplateStringsArray))
      .filter((text) => text.includes('update profiles set'))
    expect(updateProfilesCalls.length).toBeGreaterThan(0)
    expect(updateProfilesCalls.join('\n')).not.toContain('base_sub_account')
  })

  it('surfaces Base setup when no canonical CSW can be resolved', async () => {
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 11,
      canonicalSmartWallet: null,
    })

    const db = createMockDb()
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    await expect(
      resolveCanonicalCsw({
        db: db as any,
        privyUserId: 'did:privy:test-user',
        privyUser,
      }),
    ).rejects.toMatchObject({
      message: 'No canonical Coinbase Smart Wallet is linked to this account yet.',
      needsBaseAppSetup: true,
      baseAppUrl: 'https://base.app/invite/4626/T9Y9BZYK',
    })
  })

  it('ignores legacy profile seed wallet columns when no canonical CSW sync exists', async () => {
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 11,
      canonicalSmartWallet: null,
    })

    const db = createMockDb({
      profileSeedRow: {
        primary_smart_wallet: '0x00000000000000000000000000000000000000cc',
        csw_address: '0x00000000000000000000000000000000000000dd',
        base_sub_account: '0x00000000000000000000000000000000000000ee',
      },
    })
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    await expect(
      resolveCanonicalCsw({
        db: db as any,
        privyUserId: 'did:privy:test-user',
        privyUser,
      }),
    ).rejects.toMatchObject({
      message: 'No canonical Coinbase Smart Wallet is linked to this account yet.',
      needsBaseAppSetup: true,
    })
  })

  it('falls back to persisted canonical via wallet hints when sync throws and privy_user_id lookup is missing', async () => {
    syncUserWalletsMock.mockRejectedValueOnce(new Error('wallet_sync_profile_upsert_failed'))

    const walletAddress = '0x00000000000000000000000000000000000000aa'
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = normalizeSql(strings)
        if (text.includes("to_regclass('public.profile_wallets') is not null as has_profile_wallets")) {
          return {
            rows: [
              {
                has_profile_wallets: true,
                has_chain_id: true,
                has_canonical_csw_address: true,
                has_canonical_source: true,
                has_privy_embedded_eoa_address: true,
                has_privy_is_owner: true,
                has_last_checked_at: true,
              },
            ],
          }
        }
        if (text.startsWith('do $$')) return { rows: [] }
        if (text.startsWith('alter table profile_wallets')) return { rows: [] }
        if (text.includes('select id from profiles where privy_user_id =')) return { rows: [] }
        if (text.includes('with direct as') && text.includes('privy_user_aliases')) {
          return { rows: [] }
        }
        if (text.includes('select id from profiles where lower(email) =')) return { rows: [] }
        if (text.includes('select profile_id from profile_wallets where lower(address) =')) return { rows: [{ profile_id: 99 }] }
        if (text.includes('select pw.profile_id')) {
          return {
            rows: [
              {
                profile_id: 99,
                chain_id: 8453,
                canonical_csw_address: walletAddress.toLowerCase(),
                canonical_source: 'wallet_sync',
                privy_embedded_eoa_address: null,
                privy_is_owner: false,
                last_checked_at: null,
                address: walletAddress.toLowerCase(),
                is_canonical_smart_wallet: true,
              },
            ],
          }
        }
        throw new Error(`Unhandled SQL in test: ${text}`)
      }),
    }

    const privyUser = {
      id: 'did:privy:test-user',
      linkedAccounts: [{ type: 'wallet', chainType: 'ethereum', walletClientType: 'rabby_wallet', address: walletAddress }],
    } as any

    const resolved = await resolveCanonicalCsw({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })

    expect(resolved.profileId).toBe(99)
    expect(resolved.canonicalCswAddress).toBe(walletAddress.toLowerCase())
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
  })
})

describe('resolveConfirmOwnerCanonicalCsw', () => {
  it('uses the persisted canonical CSW when no override is provided', () => {
    expect(
      resolveConfirmOwnerCanonicalCsw({
        persistedCanonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      }),
    ).toBe('0x00000000000000000000000000000000000000aa')
  })

  it('rejects a caller-supplied CSW that does not match the account canonical wallet', () => {
    expect(() =>
      resolveConfirmOwnerCanonicalCsw({
        persistedCanonicalCswAddress: '0x00000000000000000000000000000000000000aa',
        requestedCswAddress: '0x00000000000000000000000000000000000000bb',
      }),
    ).toThrow('Requested Coinbase Smart Wallet does not match the canonical wallet for this account.')
  })
})
