import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveCanonicalZoraCSW } from './canonicalCswDelegation'

const { ensureWaitlistSchemaMock, syncUserWalletsMock } = vi.hoisted(() => ({
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  syncUserWalletsMock: vi.fn(),
}))

vi.mock('./waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('./walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
}))

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createMockDb() {
  let canonicalRow: any = null
  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const text = normalizeSql(strings)

      if (text.startsWith('alter table profile_wallets')) return { rows: [] }
      if (text.includes('select id from profiles where privy_user_id =')) return { rows: [{ id: 11 }] }
      if (text.includes('select pw.profile_id')) return { rows: canonicalRow ? [canonicalRow] : [] }
      if (text.includes('insert into wallets')) return { rows: [] }
      if (text.includes('update profile_wallets set is_canonical_smart_wallet = false')) return { rows: [] }
      if (text.includes('insert into profile_wallets')) {
        const canonicalAddress =
          values.find((value) => typeof value === 'string' && /^0x[a-f0-9]{40}$/i.test(value)) ?? null
        canonicalRow = {
          profile_id: 11,
          chain_id: 8453,
          canonical_zora_csw_address: String(canonicalAddress).toLowerCase(),
          canonical_source: 'zora_readonly',
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
        return { rows: [{ primary_smart_wallet: null, csw_address: null, base_sub_account: null }] }
      }

      throw new Error(`Unhandled SQL in test: ${text}`)
    }),
  }
}

describe('resolveCanonicalZoraCSW', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists canonical CSW and does not flip on subsequent calls', async () => {
    syncUserWalletsMock
      .mockResolvedValueOnce({
        profileId: 11,
        canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000AA' },
      })
      .mockResolvedValueOnce({
        profileId: 11,
        canonicalSmartWallet: { address: '0x00000000000000000000000000000000000000BB' },
      })

    const db = createMockDb()
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    const first = await resolveCanonicalZoraCSW({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })
    const second = await resolveCanonicalZoraCSW({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser,
    })

    expect(first.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(second.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000aa')
    expect(syncUserWalletsMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces Base setup when no canonical CSW can be resolved', async () => {
    syncUserWalletsMock.mockResolvedValueOnce({
      profileId: 11,
      canonicalSmartWallet: null,
    })

    const db = createMockDb()
    const privyUser = { id: 'did:privy:test-user', linkedAccounts: [] } as any

    await expect(
      resolveCanonicalZoraCSW({
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
})
