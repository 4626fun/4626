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

function createDb(options: { alreadyLinked: boolean }) {
  const calls: Array<{ text: string; values: unknown[] }> = []
  return {
    calls,
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = normalizeSql(strings)
      calls.push({ text, values })

      if (text.includes('from account_linked_methods') && text.includes('limit 1')) {
        return options.alreadyLinked ? { rows: [{ n: 1 }] } : { rows: [] }
      }
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
})
