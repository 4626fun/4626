import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./identity/identityRecovery.js', () => ({
  assertNoEmailPrivyCollision: vi.fn(async () => {}),
}))

vi.mock('../onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: vi.fn(async () => {}),
}))

vi.mock('../onboarding/waitlistPoints.js', () => ({
  recordReferralPassthrough: vi.fn(async () => {}),
  ensureWaitlistPointsSchema: vi.fn(async () => {}),
}))

vi.mock('../onboarding/referrals.js', () => ({
  ensureReferralsSchema: vi.fn(async () => {}),
}))

vi.mock('../wallet/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: vi.fn(async () => {}),
}))

vi.mock('./profileIdForPrivyUser.js', () => ({
  listProfileIdsForPrivyUser: vi.fn(async () => [42]),
  resolvePrimaryProfileIdForPrivyUser: vi.fn(async () => 42),
}))

import { recordProviderLink } from './accountsIdentity'

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createDb(options: { alreadyLinked: boolean; previouslyRewarded?: boolean }) {
  const calls: Array<{ text: string; values: unknown[] }> = []
  return {
    calls,
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = normalizeSql(strings)
      calls.push({ text, values })

      if (text.includes('provider_link_history') && text.includes('limit 1')) {
        return options.alreadyLinked || options.previouslyRewarded
          ? { rows: [{ n: 1 }] }
          : { rows: [] }
      }
      if (text.includes("to_regclass('public.profiles') is not null as has_profiles")) {
        return {
          rows: [
            {
              has_profiles: true,
              has_referral_conversions: true,
              has_points: true,
              has_profile_wallets: true,
              has_app_access_status: true,
              has_verifications: true,
              has_profile_completed_at: true,
              has_csw_address: true,
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
      if (text.includes("to_regclass('public.referral_conversions') is not null as has_referral_conversions")) {
        return {
          rows: [
            {
              has_referral_conversions: true,
              has_profiles_referral_code: true,
              has_profiles_referred_by_signup_id: true,
            },
          ],
        }
      }
      if (text.includes("column_name = 'chain'") && text.includes("table_name = 'profile_wallets'")) {
        return {
          rows: [
            {
              has_profile_wallets: true,
              has_profile_wallets_chain: true,
              has_csw_address: true,
              has_primary_embedded_eoa: true,
              has_profile_wallets_canonical_solana: true,
              has_profile_wallets_operational_solana: true,
            },
          ],
        }
      }
      if (text.includes('insert into points')) {
        return { rows: [{ id: 1 }] }
      }
      if (text.includes('select id from profiles where privy_user_id')) {
        return { rows: [{ id: 42 }] }
      }
      if (text.includes('insert into profiles')) {
        return { rows: [{ id: 42 }] }
      }
      return { rows: [] }
    }),
  }
}

const twitterPrivyUser = {
  linkedAccounts: [{ type: 'twitter_oauth', subject: '12345', username: 'creator' }],
}

const externalWalletPrivyUser = {
  linkedAccounts: [
    {
      type: 'wallet',
      chainType: 'ethereum',
      walletClientType: 'metamask',
      address: '0x1111111111111111111111111111111111111111',
    },
  ],
}

describe('recordProviderLink link points', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('awards twitter link points on first link', async () => {
    const db = createDb({ alreadyLinked: false })
    await recordProviderLink({
      db,
      privyUserId: 'did:privy:abc',
      provider: 'twitter',
      privyUser: twitterPrivyUser,
    })

    const pointInserts = db.calls.filter((call) => call.text.includes('insert into points'))
    expect(pointInserts).toHaveLength(1)
    expect(pointInserts[0]?.values).toEqual(
      expect.arrayContaining([42, 'link_twitter', 'link_twitter', 16]),
    )
  })

  it('does not re-award twitter link points when already linked', async () => {
    const db = createDb({ alreadyLinked: true })
    await recordProviderLink({
      db,
      privyUserId: 'did:privy:abc',
      provider: 'twitter',
      privyUser: twitterPrivyUser,
    })

    const pointInserts = db.calls.filter((call) => call.text.includes('insert into points'))
    expect(pointInserts).toHaveLength(0)
  })

  it('does not award another external-wallet link after unlinking and rotating addresses', async () => {
    const db = createDb({ alreadyLinked: false, previouslyRewarded: true })
    await recordProviderLink({
      db,
      privyUserId: 'did:privy:abc',
      provider: 'external_eoa',
      privyUser: externalWalletPrivyUser,
    })

    const pointInserts = db.calls.filter((call) => call.text.includes('insert into points'))
    expect(pointInserts).toHaveLength(0)
    const historyLookup = db.calls.find((call) => call.text.includes('provider_link_history'))
    expect(historyLookup?.values).toEqual(
      expect.arrayContaining(['did:privy:abc', 'external_eoa', 'link_external_eoa']),
    )
  })

  it('uses a provider-scoped event key for a first external-wallet reward', async () => {
    const db = createDb({ alreadyLinked: false })
    await recordProviderLink({
      db,
      privyUserId: 'did:privy:abc',
      provider: 'external_eoa',
      privyUser: externalWalletPrivyUser,
    })

    const pointInserts = db.calls.filter((call) => call.text.includes('insert into points'))
    expect(pointInserts).toHaveLength(1)
    expect(pointInserts[0]?.values).toEqual(
      expect.arrayContaining([42, 'link_external_eoa', 'link_external_eoa', 10]),
    )
  })
})
