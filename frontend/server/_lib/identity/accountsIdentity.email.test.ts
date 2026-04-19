import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./identity/identityRecovery.js', () => ({
  assertNoEmailPrivyCollision: vi.fn(async () => {}),
}))

import { deriveLinkedMethodsFromPrivyUser, recordProviderLink, syncEmailIdentity } from './accountsIdentity'

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

type RecordingQueryResult = { rows: any[] }

function createRecordingDb() {
  const calls: Array<{ text: string; values: any[] }> = []
  return {
    calls,
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]): Promise<RecordingQueryResult> => {
      calls.push({ text: normalizeSql(strings), values })
      const text = normalizeSql(strings)
      if (text.includes("to_regclass('public.profiles') is not null as has_profiles")) {
        return {
          rows: [
            {
              has_profiles: true,
              has_referral_clicks: true,
              has_referral_conversions: true,
              has_points: true,
              has_wallets: true,
              has_profile_wallets: true,
              has_app_access_status: true,
              has_verifications: true,
              has_profile_completed_at: true,
              has_primary_smart_wallet: true,
              has_primary_embedded_eoa: true,
            },
          ],
        }
      }
      if (
        text.includes("to_regclass('public.points') is not null as has_points") &&
        text.includes('has_referral_status')
      ) {
        return {
          rows: [
            {
              has_points: true,
              has_profile_completed_at: true,
              has_referral_status: true,
              has_referral_qualified_at: true,
            },
          ],
        }
      }
      if (text.includes("to_regclass('public.referral_clicks') is not null as has_referral_clicks")) {
        return {
          rows: [
            {
              has_referral_clicks: true,
              has_referral_conversions: true,
              has_profiles_referral_code: true,
              has_profiles_referred_by_signup_id: true,
            },
          ],
        }
      }
      if (text.includes("to_regclass('public.wallets') is not null as has_wallets")) {
        return {
          rows: [
            {
              has_wallets: true,
              has_profile_wallets: true,
              has_primary_smart_wallet: true,
              has_primary_embedded_eoa: true,
              has_canonical_solana_wallet: true,
              has_profile_wallets_canonical_solana: true,
              has_profile_wallets_operational_solana: true,
            },
          ],
        }
      }
      return { rows: [] }
    }),
  }
}

describe('accountsIdentity verified email handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('only derives email linked methods from verified Privy email accounts', () => {
    expect(
      deriveLinkedMethodsFromPrivyUser({
        id: 'did:privy:test-user',
        email: { address: 'verified@example.com', verified: true },
        linkedAccounts: [
          { type: 'email', address: 'verified@example.com', verified: true },
          { type: 'email', address: 'pending@example.com', verified: false },
        ],
      } as any),
    ).toEqual(
      expect.objectContaining({
        email: ['verified@example.com'],
      }),
    )

    expect(
      deriveLinkedMethodsFromPrivyUser({
        id: 'did:privy:test-user',
        email: { address: 'pending@example.com', verified: false },
        linkedAccounts: [{ type: 'email', address: 'pending@example.com', verified: false }],
      } as any),
    ).not.toHaveProperty('email')
  })

  it('does not promote an unverified Privy email during syncEmailIdentity', async () => {
    const db = createRecordingDb()

    await syncEmailIdentity({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: {
        id: 'did:privy:test-user',
        email: { address: 'pending@example.com', verified: false },
        linkedAccounts: [{ type: 'email', address: 'pending@example.com', verified: false }],
      } as any,
    })

    const accountUpsert = db.calls.find((call) => call.text.includes('insert into accounts'))
    expect(accountUpsert?.values[1] ?? null).toBeNull()
    expect(accountUpsert?.values[2]).toBe(false)
    expect(db.calls.some((call) => call.text.includes('insert into account_linked_methods'))).toBe(false)
  })

  it('promotes server-auth email accounts that use snake_case numeric verification timestamps', async () => {
    const db = createRecordingDb()

    await syncEmailIdentity({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: {
        id: 'did:privy:test-user',
        linked_accounts: [{ type: 'email', address: 'verified@example.com', verified_at: 1674788927 }],
      } as any,
    })

    const accountUpsert = db.calls.find((call) => call.text.includes('insert into accounts'))
    expect(accountUpsert?.values[1]).toBe('verified@example.com')
    expect(accountUpsert?.values[2]).toBe(true)
    expect(db.calls.some((call) => call.text.includes('insert into account_linked_methods'))).toBe(true)
  })

  it('rejects explicit email linking until Privy marks the email verified', async () => {
    const db = createRecordingDb()

    await expect(
      recordProviderLink({
        db: db as any,
        privyUserId: 'did:privy:test-user',
        provider: 'email',
        value: 'pending@example.com',
        privyUser: {
          id: 'did:privy:test-user',
          email: { address: 'pending@example.com', verified: false },
          linkedAccounts: [{ type: 'email', address: 'pending@example.com', verified: false }],
        } as any,
      }),
    ).rejects.toThrow('Email is not verified in Privy yet.')

    expect(db.calls).toHaveLength(0)
  })

  it('re-reads the canonical profile after losing a privy_user_id insert race', async () => {
    const db = createRecordingDb()
    const originalSql = db.sql.getMockImplementation() as
      | ((strings: TemplateStringsArray, ...values: any[]) => Promise<RecordingQueryResult>)
      | undefined
    let profileLookupCount = 0
    let profileInsertCount = 0

    db.sql.mockImplementation(async (strings: TemplateStringsArray, ...values: any[]): Promise<RecordingQueryResult> => {
      const text = normalizeSql(strings)
      // Resolver's privy-user lookup now routes through privy_user_aliases
      // with a tombstone-chasing CTE. Any SELECT that touches
      // `privy_user_aliases` in the WHERE is treated as the Privy-user
      // resolution path. The seed INSERT into privy_user_aliases is
      // ignored here so it doesn't count as a lookup.
      if (
        text.includes('select') &&
        text.includes('from profiles') &&
        text.includes('privy_user_aliases') &&
        !text.includes('insert into privy_user_aliases')
      ) {
        profileLookupCount += 1
        if (profileLookupCount === 1) return { rows: [] }
        return { rows: [{ id: 42 }] }
      }
      if (text.includes('insert into profiles (privy_user_id, created_at, updated_at)')) {
        profileInsertCount += 1
        throw new Error('duplicate key value violates unique constraint "profiles_privy_user_id_unique"')
      }
      // Tolerate the seed insert into privy_user_aliases that the resolver
      // now fires after a successful profile insert — treat as a no-op.
      if (text.includes('insert into privy_user_aliases')) return { rows: [] }
      if (originalSql) return await originalSql(strings, ...values)
      return { rows: [] }
    })

    await expect(
      syncEmailIdentity({
        db: db as any,
        privyUserId: 'did:privy:test-user',
        privyUser: {
          id: 'did:privy:test-user',
          email: { address: 'verified@example.com', verified: true },
          linkedAccounts: [{ type: 'email', address: 'verified@example.com', verified: true }],
        } as any,
      }),
    ).resolves.toBeUndefined()

    expect(profileInsertCount).toBe(1)
    expect(profileLookupCount).toBeGreaterThanOrEqual(2)
  })
})
