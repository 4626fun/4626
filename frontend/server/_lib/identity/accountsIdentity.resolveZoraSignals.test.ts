import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureWaitlistSchemaMock,
  resolveCanonicalCswMock,
  fetchZoraProfileMock,
} = vi.hoisted(() => ({
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
  resolveCanonicalCswMock: vi.fn(),
  fetchZoraProfileMock: vi.fn(async () => null),
}))

vi.mock('../onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../wallet/canonicalCswDelegation.js', async () => {
  const actual = await vi.importActual<typeof import('../wallet/canonicalCswDelegation')>('../wallet/canonicalCswDelegation')
  return {
    ...actual,
    resolveCanonicalCsw: resolveCanonicalCswMock,
  }
})

vi.mock('../zora/zoraProfile.js', () => ({
  fetchZoraProfile: fetchZoraProfileMock,
}))

import { resolveAndPersistZoraSignals } from './accountsIdentity'

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function createDbWithZoraSignals(seed: {
  privyUserId: string
  canonicalCswAddress: string | null
  zoraHandle?: string | null
}) {
  let zoraRow = {
    privy_user_id: seed.privyUserId,
    zora_linked: false,
    canonical_csw_address: seed.canonicalCswAddress,
    creator_coin_address: null,
    zora_handle: seed.zoraHandle ?? null,
    last_resolved_at: '2026-04-01T00:00:00.000Z',
  }

  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const query = normalizeSql(strings)

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

      if (query.startsWith('insert into account_zora_signals') && query.includes('on conflict (privy_user_id) do nothing')) {
        return { rows: [] }
      }

      if (query.includes('from account_zora_signals') && query.includes('where privy_user_id =')) {
        return { rows: [zoraRow] }
      }

      if (query.startsWith('insert into account_zora_signals') && query.includes('on conflict (privy_user_id) do update')) {
        zoraRow = {
          ...zoraRow,
          zora_linked: Boolean(values[1]),
          zora_handle: values[2] ?? zoraRow.zora_handle,
          canonical_csw_address: values[3] ?? zoraRow.canonical_csw_address,
          creator_coin_address: values[4] ?? zoraRow.creator_coin_address,
          last_resolved_at: values[5] ?? zoraRow.last_resolved_at,
        }
        return { rows: [] }
      }

      if (query.includes('select id') && query.includes('from profiles') && query.includes('where privy_user_id =')) {
        return { rows: [{ id: 42 }] }
      }

      if (query.startsWith('insert into points')) {
        return { rows: [] }
      }

      if (query.includes('from points p') && query.includes('where p.signup_id in')) {
        return { rows: [{ points: 0 }] }
      }

      return { rows: [] }
    }),
    readZoraRow: () => zoraRow,
  }
}

describe('resolveAndPersistZoraSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes a stale persisted canonical CSW when the live canonical resolver disagrees', async () => {
    resolveCanonicalCswMock.mockResolvedValue({
      profileId: 42,
      canonicalCswAddress: '0x00000000000000000000000000000000000000bb',
      canonicalSource: 'wallet_sync',
    })

    const db = createDbWithZoraSignals({
      privyUserId: 'did:privy:test-user',
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      zoraHandle: '$4626',
    })

    const result = await resolveAndPersistZoraSignals({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      privyUser: { id: 'did:privy:test-user', linkedAccounts: [] } as any,
      forceRefresh: true,
    })

    expect(resolveCanonicalCswMock).toHaveBeenCalledTimes(1)
    expect(result.canonicalCswAddress).toBe('0x00000000000000000000000000000000000000bb')
    expect(db.readZoraRow().canonical_csw_address).toBe('0x00000000000000000000000000000000000000bb')
  })
})
