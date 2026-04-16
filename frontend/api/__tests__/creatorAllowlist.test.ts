import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/_creator-allowlist.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  isDbConfiguredMock,
  getDbMock,
  ensureCreatorAccessSchemaMock,
  ensureCreatorWalletsSchemaMock,
  isSupabaseAdminConfiguredMock,
  getSupabaseAdminMock,
  resolveCoinPartiesMock,
} = vi.hoisted(() => ({
  isDbConfiguredMock: vi.fn(() => false),
  getDbMock: vi.fn(),
  ensureCreatorAccessSchemaMock: vi.fn(async () => {}),
  ensureCreatorWalletsSchemaMock: vi.fn(async () => {}),
  isSupabaseAdminConfiguredMock: vi.fn(() => false),
  getSupabaseAdminMock: vi.fn(),
  resolveCoinPartiesMock: vi.fn(async () => ({ creator: null, payoutRecipient: null })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  ensureCreatorAccessSchema: ensureCreatorAccessSchemaMock,
  getDb: getDbMock,
  getDbInitError: vi.fn(() => null),
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/wallet/creatorWallets.js', () => ({
  ensureCreatorWalletsSchema: ensureCreatorWalletsSchemaMock,
}))

vi.mock('../../server/_lib/onchain/coinParties.js', () => ({
  isAddressLike: vi.fn((value: string) => /^0x[a-fA-F0-9]{40}$/.test(String(value || ''))),
  resolveCoinParties: resolveCoinPartiesMock,
}))

vi.mock('../../server/_lib/db/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: isSupabaseAdminConfiguredMock,
  getSupabaseAdmin: getSupabaseAdminMock,
}))

type QueryState = {
  table: string
  filters: Record<string, unknown>
}

function createSupabaseMock(resolve: (state: QueryState) => Promise<{ data: any[]; error: { message: string } | null }>) {
  return {
    from(table: string) {
      const state: QueryState = { table, filters: {} }
      const chain: any = {
        select(value: string) {
          state.filters.select = value
          return chain
        },
        or(value: string) {
          state.filters.or = value
          return chain
        },
        is(column: string, value: unknown) {
          state.filters[`is:${column}`] = value
          return chain
        },
        ilike(column: string, value: unknown) {
          state.filters[`ilike:${column}`] = value
          return chain
        },
        in(column: string, value: unknown) {
          state.filters[`in:${column}`] = value
          return chain
        },
        eq(column: string, value: unknown) {
          state.filters[`eq:${column}`] = value
          return chain
        },
        limit(value: number) {
          state.filters.limit = value
          return resolve(state)
        },
      }
      return chain
    },
  }
}

describe('/api/creator-allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(false)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    resolveCoinPartiesMock.mockResolvedValue({ creator: null, payoutRecipient: null })
  })

  it('does not treat approved app access as deploy allowlist approval in DB mode', async () => {
    isDbConfiguredMock.mockReturnValue(true)
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from allowlist')) return { rows: [] }
        if (text.includes('from creator_wallets')) return { rows: [] }
        if (text.includes('from profiles') && text.includes('lower(primary_wallet)')) return { rows: [] }
        if (text.includes('join profile_wallets')) return { rows: [{ id: 7 }] }
        return { rows: [] }
      }),
    }
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({
      method: 'GET',
      query: { address: '0x2182f4e72fcc5d9cdd789457aab798aa79587b46' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.mode).toBe('enforced')
    expect(res.body?.data?.allowed).toBe(false)
  })

  it('does not treat approved app access as deploy allowlist approval in Supabase mode', async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true)
    isDbConfiguredMock.mockReturnValue(false)

    getSupabaseAdminMock.mockReturnValue(
      createSupabaseMock(async (state) => {
        if (state.table === 'allowlist') return { data: [], error: null }
        if (state.table === 'creator_wallets') return { data: [], error: null }
        if (state.table === 'profiles' && typeof state.filters.or === 'string') return { data: [], error: null }
        if (state.table === 'profile_wallets') return { data: [{ profile_id: 1 }], error: null }
        if (state.table === 'profiles' && Array.isArray(state.filters['in:id'])) return { data: [{ id: 1 }], error: null }
        return { data: [], error: null }
      }),
    )

    const req = createMockReq({
      method: 'GET',
      query: { address: '0x2182f4e72fcc5d9cdd789457aab798aa79587b46' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.mode).toBe('enforced')
    expect(res.body?.data?.allowed).toBe(false)
  })

  it('does not fail the endpoint when Supabase allowlist query errors', async () => {
    isSupabaseAdminConfiguredMock.mockReturnValue(true)
    isDbConfiguredMock.mockReturnValue(false)

    getSupabaseAdminMock.mockReturnValue(
      createSupabaseMock(async (state) => {
        if (state.table === 'allowlist') return { data: [], error: { message: 'temporary_error' } }
        if (state.table === 'creator_wallets') return { data: [], error: null }
        if (state.table === 'profiles') return { data: [], error: null }
        if (state.table === 'profile_wallets') return { data: [], error: null }
        return { data: [], error: null }
      }),
    )

    const req = createMockReq({
      method: 'GET',
      query: { address: '0x2182f4e72fcc5d9cdd789457aab798aa79587b46' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.mode).toBe('enforced')
    expect(res.body?.data?.allowed).toBe(false)
  })
})
