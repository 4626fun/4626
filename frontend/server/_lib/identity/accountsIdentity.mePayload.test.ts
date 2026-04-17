import { describe, expect, it, vi } from 'vitest'

import { buildAccountsMePayload } from './accountsIdentity'

describe('buildAccountsMePayload', () => {
  it('includes approved app access status from the linked profile', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const query = strings
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()

        if (query.includes("to_regclass('public.accounts') is not null as has_accounts")) {
          return {
            rows: [
              {
                has_accounts: true,
                has_account_linked_methods: true,
                has_account_zora_signals: true,
                has_canonical_csw_address: true,
              },
            ],
          }
        }

        if (query.includes("to_regclass('public.profiles') is not null as has_profiles")) {
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
          query.includes("to_regclass('public.points') is not null as has_points") &&
          query.includes('has_referral_status')
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

        if (query.includes("to_regclass('public.referral_clicks') is not null as has_referral_clicks")) {
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

        if (query.includes("to_regclass('public.wallets') is not null as has_wallets")) {
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

        if (query.includes('select email') && query.includes('from accounts')) {
          return { rows: [{ email: 'test@example.com' }] }
        }

        if (query.includes('from account_linked_methods')) {
          return { rows: [] }
        }

        if (query.includes('from account_zora_signals')) {
          return {
            rows: [
              {
                zora_linked: false,
                canonical_csw_address: null,
                creator_coin_address: null,
                zora_handle: null,
                last_resolved_at: null,
              },
            ],
          }
        }

        if (query.includes('select id') && query.includes('from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 42 }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          return { rows: [{ points: 0 }] }
        }

        if (query.includes('select app_access_status') && query.includes('from profiles')) {
          expect(String(values[0] ?? '')).toBe('did:privy:test-user')
          return { rows: [{ app_access_status: 'approved', base_sub_account: null }] }
        }

        return { rows: [] }
      }),
    }

    const payload = await buildAccountsMePayload({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: null,
    })

    expect(payload.appAccessStatus).toBe('approved')
    expect(payload.score.tier).toBe(0)
  })
})
