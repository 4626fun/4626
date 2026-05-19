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

        if (query.includes('select id from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 42 }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          return { rows: [{ points: 0 }] }
        }

        if (query.includes('app_access_status') && query.includes('base_sub_account') && query.includes('from profiles')) {
          expect(String(values[0] ?? '')).toBe('did:privy:test-user')
          return { rows: [{ id: 42, app_access_status: 'approved', base_sub_account: null }] }
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
    // With no canonical CSW / no sub-account / no owner signal, the account
    // is on the 'none-yet' execution track and all sub-account fields are empty.
    expect(payload.accountSignals.executionTrack).toBe('none-yet')
    expect(payload.accountSignals.baseSubAccount).toEqual({
      address: null,
      isDistinctFromCsw: false,
      registered: false,
    })
    expect(payload.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBeNull()
  })

  it("classifies an account as 'legacy-owner-install' when the embedded EOA is a cached CSW owner and no real sub-account exists", async () => {
    const CANONICAL_CSW = '0x00000000000000000000000000000000000000aa'
    const EMBEDDED_EOA = '0x00000000000000000000000000000000000000bb'

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase()

        // Schema probes — report everything as present so the real queries run.
        if (query.includes('to_regclass')) {
          return {
            rows: [
              {
                has_accounts: true,
                has_profiles: true,
                has_account_linked_methods: true,
                has_account_zora_signals: true,
                has_canonical_csw_address: true,
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
                has_privy_is_owner: true,
                has_referral_status: true,
                has_referral_qualified_at: true,
                has_canonical_solana_wallet: true,
                has_profile_wallets_canonical_solana: true,
                has_profile_wallets_operational_solana: true,
                has_profiles_referral_code: true,
                has_profiles_referred_by_signup_id: true,
              },
            ],
          }
        }

        if (query.includes('select email') && query.includes('from accounts')) {
          return { rows: [{ email: 'legacy@example.com', email_verified: true }] }
        }

        if (query.includes('from account_linked_methods')) return { rows: [] }

        if (query.includes('from account_zora_signals')) {
          return {
            rows: [
              {
                zora_linked: true,
                canonical_csw_address: CANONICAL_CSW,
                creator_coin_address: null,
                zora_handle: null,
                last_resolved_at: null,
              },
            ],
          }
        }

        if (query.includes('select id from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 77 }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          return { rows: [{ points: 0 }] }
        }

        if (query.includes('app_access_status') && query.includes('base_sub_account') && query.includes('from profiles')) {
          // Legacy account: base_sub_account is null (no sub-account was ever set up).
          return { rows: [{ id: 77, app_access_status: 'approved', base_sub_account: null }] }
        }

        // Delegation state lookup: the embedded EOA IS a direct CSW owner (legacy install).
        if (query.includes('from profile_wallets pw') && query.includes('left join wallets w')) {
          return {
            rows: [
              {
                canonical_source: 'wallet_sync',
                wallet_type: 'smart_wallet',
                provider: 'privy',
              },
            ],
          }
        }

        if (query.includes('from profile_wallets pw') && query.includes('privy_is_owner')) {
          return {
            rows: [
              {
                profile_id: 77,
                chain_id: 8453,
                canonical_csw_address: CANONICAL_CSW,
                canonical_source: 'base_account',
                privy_embedded_eoa_address: EMBEDDED_EOA,
                privy_is_owner: true,
                last_checked_at: new Date().toISOString(),
                address: CANONICAL_CSW,
                is_canonical_smart_wallet: true,
              },
            ],
          }
        }

        return { rows: [] }
      }),
    }

    const payload = await buildAccountsMePayload({
      db: db as any,
      privyUserId: 'did:privy:legacy-user',
      privyUser: null,
    })

    expect(payload.accountSignals.executionTrack).toBe('legacy-owner-install')
    expect(payload.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(true)
    expect(payload.accountSignals.baseSubAccount).toEqual({
      address: null,
      isDistinctFromCsw: false,
      registered: false,
    })
  })

  it("classifies an account as 'sub-account' when a distinct sub-account is persisted and the embedded EOA is not a CSW owner", async () => {
    const CANONICAL_CSW = '0x00000000000000000000000000000000000000aa'
    const EMBEDDED_EOA = '0x00000000000000000000000000000000000000bb'
    const SUB_ACCOUNT = '0x00000000000000000000000000000000000000cc'

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase()

        if (query.includes('to_regclass')) {
          return {
            rows: [
              {
                has_accounts: true,
                has_profiles: true,
                has_account_linked_methods: true,
                has_account_zora_signals: true,
                has_canonical_csw_address: true,
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
                has_privy_is_owner: true,
                has_referral_status: true,
                has_referral_qualified_at: true,
                has_canonical_solana_wallet: true,
                has_profile_wallets_canonical_solana: true,
                has_profile_wallets_operational_solana: true,
                has_profiles_referral_code: true,
                has_profiles_referred_by_signup_id: true,
              },
            ],
          }
        }

        if (query.includes('select email') && query.includes('from accounts')) {
          return { rows: [{ email: 'subaccount@example.com', email_verified: true }] }
        }

        if (query.includes('from account_linked_methods')) return { rows: [] }

        if (query.includes('from account_zora_signals')) {
          return {
            rows: [
              {
                zora_linked: true,
                canonical_csw_address: CANONICAL_CSW,
                creator_coin_address: null,
                zora_handle: null,
                last_resolved_at: null,
              },
            ],
          }
        }

        if (query.includes('select id from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 88 }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          return { rows: [{ points: 0 }] }
        }

        if (query.includes('app_access_status') && query.includes('base_sub_account') && query.includes('from profiles')) {
          return {
            rows: [{ id: 88, app_access_status: 'approved', base_sub_account: SUB_ACCOUNT }],
          }
        }

        if (query.includes('from profile_wallets pw') && query.includes('left join wallets w')) {
          return {
            rows: [
              {
                canonical_source: 'wallet_sync',
                wallet_type: 'smart_wallet',
                provider: 'privy',
              },
            ],
          }
        }

        if (query.includes('from profile_wallets pw') && query.includes('privy_is_owner')) {
          return {
            rows: [
              {
                profile_id: 88,
                chain_id: 8453,
                canonical_csw_address: CANONICAL_CSW,
                canonical_source: 'base_account',
                privy_embedded_eoa_address: EMBEDDED_EOA,
                privy_is_owner: false,
                last_checked_at: new Date().toISOString(),
                address: CANONICAL_CSW,
                is_canonical_smart_wallet: true,
              },
            ],
          }
        }

        return { rows: [] }
      }),
    }

    const payload = await buildAccountsMePayload({
      db: db as any,
      privyUserId: 'did:privy:sub-user',
      privyUser: null,
    })

    expect(payload.accountSignals.executionTrack).toBe('sub-account')
    expect(payload.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(false)
    expect(payload.accountSignals.baseSubAccount).toEqual({
      address: SUB_ACCOUNT,
      isDistinctFromCsw: true,
      registered: true,
    })
  })

  it("trusts counterfactual baseapp_waitlist CIEC rows for executionTrack even without bytecode", async () => {
    const CANONICAL_CSW = '0x00000000000000000000000000000000000000aa'
    const EMBEDDED_EOA = '0x00000000000000000000000000000000000000bb'
    const SUB_ACCOUNT = '0x00000000000000000000000000000000000000dd'

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase()

        if (query.includes('to_regclass')) {
          return {
            rows: [
              {
                has_accounts: true,
                has_profiles: true,
                has_account_linked_methods: true,
                has_account_zora_signals: true,
                has_canonical_csw_address: true,
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
                has_privy_is_owner: true,
                has_referral_status: true,
                has_referral_qualified_at: true,
                has_canonical_solana_wallet: true,
                has_profile_wallets_canonical_solana: true,
                has_profile_wallets_operational_solana: true,
                has_profiles_referral_code: true,
                has_profiles_referred_by_signup_id: true,
              },
            ],
          }
        }

        if (query.includes('select email') && query.includes('from accounts')) {
          return { rows: [{ email: 'baseapp@example.com', email_verified: true }] }
        }

        if (query.includes('from account_linked_methods')) return { rows: [] }

        if (query.includes('from account_zora_signals')) {
          return {
            rows: [
              {
                zora_linked: true,
                canonical_csw_address: CANONICAL_CSW,
                creator_coin_address: null,
                zora_handle: null,
                last_resolved_at: null,
              },
            ],
          }
        }

        if (query.includes('select id from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 99 }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          return { rows: [{ points: 0 }] }
        }

        if (query.includes('app_access_status') && query.includes('base_sub_account') && query.includes('from profiles')) {
          return {
            rows: [{ id: 99, app_access_status: 'approved', base_sub_account: SUB_ACCOUNT }],
          }
        }

        if (query.includes('from command_issuer_execution_context')) {
          return {
            rows: [
              {
                sub_account_address: SUB_ACCOUNT,
                parent_csw_address: CANONICAL_CSW,
              },
            ],
          }
        }

        if (query.includes('from profile_wallets pw') && query.includes('left join wallets w')) {
          return { rows: [] }
        }

        if (query.includes('from profile_wallets pw') && query.includes('privy_is_owner')) {
          return {
            rows: [
              {
                profile_id: 99,
                chain_id: 8453,
                canonical_csw_address: CANONICAL_CSW,
                canonical_source: 'base_account',
                privy_embedded_eoa_address: EMBEDDED_EOA,
                privy_is_owner: false,
                last_checked_at: new Date().toISOString(),
                address: CANONICAL_CSW,
                is_canonical_smart_wallet: true,
              },
            ],
          }
        }

        return { rows: [] }
      }),
    }

    const payload = await buildAccountsMePayload({
      db: db as any,
      privyUserId: 'did:privy:baseapp-waitlist',
      privyUser: null,
    })

    expect(payload.accountSignals.executionTrack).toBe('sub-account')
    expect(payload.accountSignals.baseSubAccount).toEqual({
      address: SUB_ACCOUNT,
      isDistinctFromCsw: true,
      registered: true,
    })
  })

  it('classifies the Base App probe CSW as none-yet before sub-account or owner install', async () => {
    const CANONICAL_CSW = '0x4beabd0afbcc2f0440cdef1c3c745d43fae704ef'
    const EMBEDDED_EOA = '0x00000000000000000000000000000000000000cc'

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').replace(/\s+/g, ' ').trim().toLowerCase()

        if (query.includes('to_regclass')) {
          return {
            rows: [
              {
                has_accounts: true,
                has_profiles: true,
                has_account_linked_methods: true,
                has_account_zora_signals: true,
                has_canonical_csw_address: true,
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
                has_privy_is_owner: true,
                has_referral_status: true,
                has_referral_qualified_at: true,
                has_canonical_solana_wallet: true,
                has_profile_wallets_canonical_solana: true,
                has_profile_wallets_operational_solana: true,
                has_profiles_referral_code: true,
                has_profiles_referred_by_signup_id: true,
              },
            ],
          }
        }

        if (query.includes('select email') && query.includes('from accounts')) {
          return { rows: [{ email: 'baseapp-probe@example.com', email_verified: true }] }
        }

        if (query.includes('from account_linked_methods')) return { rows: [] }

        if (query.includes('from account_zora_signals')) {
          return {
            rows: [
              {
                zora_linked: false,
                canonical_csw_address: CANONICAL_CSW,
                creator_coin_address: null,
                zora_handle: null,
                last_resolved_at: null,
              },
            ],
          }
        }

        if (query.includes('select id from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 4 }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          return { rows: [{ points: 0 }] }
        }

        if (query.includes('app_access_status') && query.includes('base_sub_account') && query.includes('from profiles')) {
          return {
            rows: [{ id: 4, app_access_status: 'approved', base_sub_account: null }],
          }
        }

        if (query.includes('from profile_wallets pw') && query.includes('privy_is_owner')) {
          return {
            rows: [
              {
                profile_id: 4,
                chain_id: 8453,
                canonical_csw_address: CANONICAL_CSW,
                canonical_source: 'base_account',
                privy_embedded_eoa_address: EMBEDDED_EOA,
                privy_is_owner: false,
                last_checked_at: new Date().toISOString(),
                address: CANONICAL_CSW,
                is_canonical_smart_wallet: true,
              },
            ],
          }
        }

        return { rows: [] }
      }),
    }

    const payload = await buildAccountsMePayload({
      db: db as any,
      privyUserId: 'did:privy:baseapp-probe',
      privyUser: null,
    })

    expect(payload.accountSignals.canonicalCswAddress).toBe(CANONICAL_CSW)
    expect(payload.accountSignals.executionTrack).toBe('none-yet')
    expect(payload.accountSignals.privyEmbeddedEoaIsOwnerOfCanonicalCsw).toBe(false)
    expect(payload.accountSignals.baseSubAccount.registered).toBe(false)
  })
})
