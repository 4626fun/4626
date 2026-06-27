import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_me.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbMock,
  ensureWaitlistSchemaMock,
  resolveAuthorizedRequestPrincipalMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  resolveAuthorizedRequestPrincipalMock: vi.fn(),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>(
    '@4626/server-core',
  )
  return {
    ...actual,
    checkDurableRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000, source: 'memory' })),
    getDb: getDbMock,
    handleOptions: () => false,
    resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
    setCors: () => {},
    setNoStore: () => {},
  }
})

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

describe('GET /api/waitlist/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureWaitlistSchemaMock.mockResolvedValue(undefined)
    resolveAuthorizedRequestPrincipalMock.mockResolvedValue({ profileId: 42 })
  })

  it('fails soft when DB is unavailable', async () => {
    getDbMock.mockResolvedValue(null)

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ success: true, data: null })
  })

  it('marks distinct base_sub_account as execution-only, not canonical identity', async () => {
    const cswAddress = '0x1111111111111111111111111111111111111111'
    const subAccount = '0x2222222222222222222222222222222222222222'
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ').toLowerCase()
      if (query.includes('from profiles') && query.includes('where id =')) {
        return {
          rows: [
            {
              id: 42,
              email: 'user@example.com',
              contact_preference: null,
              primary_wallet: null,
              embedded_wallet: null,
              embedded_wallet_chain: null,
              embedded_wallet_client_type: null,
              csw_address: cswAddress,
              primary_smart_wallet: cswAddress,
              primary_embedded_eoa: null,
              base_sub_account: subAccount,
              solana_wallet: null,
              canonical_solana_wallet: null,
              operational_solana_wallet: null,
              preprov_coin_address: null,
              preprov_coin_symbol: null,
              erc8128_agent_id: null,
              preprov_zora_handle: null,
              lens_handle: null,
              lens_account_address: null,
              lens_owner_address: null,
              privy_user_id: 'did:privy:user',
              app_access_status: 'approved',
              updated_at: '2026-04-01T00:00:00.000Z',
              created_at: '2026-04-01T00:00:00.000Z',
            },
          ],
        }
      }
      if (query.includes('from profile_wallets')) {
        return {
          rows: [
            {
              address: subAccount,
              is_primary: false,
              is_canonical_smart_wallet: true,
              is_canonical_solana_wallet: false,
              is_operational_solana_wallet: false,
              is_embedded_eoa: false,
              verified_at: '2026-04-01T00:00:00.000Z',
              chain: 'evm',
              wallet_type: 'smart_wallet',
              provider: 'base_account',
            },
          ],
        }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql })

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.baseSubAccount).toBe(subAccount)
    const accounts = res.body?.data?.connectedAccounts ?? []
    const parent = accounts.find((account: any) => account.address === cswAddress)
    const child = accounts.find((account: any) => account.address === subAccount)
    expect(parent).toMatchObject({
      isCanonicalSmartWallet: true,
      isExecutionSubAccount: false,
    })
    expect(child).toMatchObject({
      isCanonicalSmartWallet: false,
      isExecutionSubAccount: true,
      source: 'profile_wallets',
    })
  })

  it('does not list mirrored base_sub_account as an execution child', async () => {
    const cswAddress = '0x1111111111111111111111111111111111111111'
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ').toLowerCase()
      if (query.includes('from profiles') && query.includes('where id =')) {
        return {
          rows: [
            {
              id: 42,
              email: 'user@example.com',
              contact_preference: null,
              primary_wallet: null,
              embedded_wallet: null,
              embedded_wallet_chain: null,
              embedded_wallet_client_type: null,
              csw_address: cswAddress,
              primary_smart_wallet: cswAddress,
              primary_embedded_eoa: null,
              base_sub_account: cswAddress,
              solana_wallet: null,
              canonical_solana_wallet: null,
              operational_solana_wallet: null,
              preprov_coin_address: null,
              preprov_coin_symbol: null,
              erc8128_agent_id: null,
              preprov_zora_handle: null,
              lens_handle: null,
              lens_account_address: null,
              lens_owner_address: null,
              privy_user_id: 'did:privy:user',
              app_access_status: 'approved',
              updated_at: '2026-04-01T00:00:00.000Z',
              created_at: '2026-04-01T00:00:00.000Z',
            },
          ],
        }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql })

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const accounts = res.body?.data?.connectedAccounts ?? []
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({
      address: cswAddress,
      isCanonicalSmartWallet: true,
      isExecutionSubAccount: false,
    })
  })
})
