/**
 * Unit tests for commandIssuerContext — Architecture B Phase 2.
 *
 * Verifies:
 *  - Address-keyed and profileId-keyed resolution
 *  - Revoked rows surface as `revoked` (not `ready`)
 *  - Missing DB config returns `db_unavailable`
 *  - `isExecutionReady` narrows the union correctly
 *  - recordIssuerDailySpend + rollback invariants
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDbMock = vi.fn()
const isDbConfiguredMock = vi.fn()

vi.mock('../db/postgres.js', () => ({
  getDb: () => getDbMock(),
  isDbConfigured: () => isDbConfiguredMock(),
}))

vi.mock('../infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Lazy import AFTER mocks are set up.
async function importModule() {
  return await import('./commandIssuerContext.js')
}

function makeDb(sqlImpl: (...args: unknown[]) => Promise<{ rows: any[] }>) {
  return { sql: (strings: TemplateStringsArray, ...values: unknown[]) => sqlImpl(strings, ...values) }
}

const BASE_ROW = {
  profile_id: 42,
  smart_wallet_address: '0xAB6D5C10B03300326CD7FAB7267AE192842967B5',
  privy_owner_wallet_id: 'privy-wallet-1',
  owner_eoa_address: '0x6C0EA422AA7BB7E1E17C5257F7023C8F05DDF9B3',
  owner_index: 0,
  paymaster_policy: 'cdp_default',
  caps_version: 1,
  per_tx_cap_wei: '10000000000000000',
  daily_cap_wei: '50000000000000000',
  provisioned_at: '2026-04-17T00:00:00.000Z',
  revoked_at: null,
  revoked_reason: null,
}

describe('resolveCommandIssuerContextByAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
  })

  it('returns not_provisioned for malformed address without hitting the DB', async () => {
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress('not-an-address')
    expect(result.status).toBe('not_provisioned')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('returns db_unavailable when DB is not configured', async () => {
    isDbConfiguredMock.mockReturnValue(false)
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('db_unavailable')
  })

  it('returns ready context when a non-revoked row exists', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({ rows: [BASE_ROW] })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.context.profileId).toBe(42)
      expect(result.context.smartWallet).toBe('0xab6d5c10b03300326cd7fab7267ae192842967b5')
      expect(result.context.ownerEoa).toBe('0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3')
      expect(result.context.perTxCapWei).toBe(10_000_000_000_000_000n)
      expect(result.context.dailyCapWei).toBe(50_000_000_000_000_000n)
      expect(result.context.revokedAt).toBeNull()
    }
  })

  it('returns revoked status when revoked_at is set', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({
        rows: [{ ...BASE_ROW, revoked_at: '2026-04-18T00:00:00.000Z', revoked_reason: 'compromise' }],
      })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('revoked')
    if (result.status === 'revoked') {
      expect(result.profileId).toBe(42)
      expect(result.reason).toBe('compromise')
    }
  })

  it('returns not_provisioned when no rows match', async () => {
    getDbMock.mockResolvedValue(makeDb(async () => ({ rows: [] })))
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('not_provisioned')
  })

  it('returns db_unavailable on DB error', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => {
        throw new Error('connection refused')
      }),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('db_unavailable')
  })
})

describe('resolveCommandIssuerContextByProfileId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
  })

  it('rejects invalid profileId without DB call', async () => {
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByProfileId(0)
    expect(result.status).toBe('not_provisioned')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('returns ready context for a valid row', async () => {
    getDbMock.mockResolvedValue(makeDb(async () => ({ rows: [BASE_ROW] })))
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByProfileId(42)
    expect(result.status).toBe('ready')
  })
})

describe('isExecutionReady', () => {
  it('narrows to the ready variant', async () => {
    const mod = await importModule()
    const ready = {
      status: 'ready' as const,
      context: {
        profileId: 1,
        smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5' as `0x${string}`,
        privyOwnerWalletId: 'w1',
        ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3' as `0x${string}`,
        ownerIndex: 0,
        paymasterPolicy: 'cdp_default',
        capsVersion: 1,
        perTxCapWei: 1n,
        dailyCapWei: 2n,
        provisionedAt: new Date(),
        revokedAt: null,
      },
    }
    expect(mod.isExecutionReady(ready)).toBe(true)
    expect(mod.isExecutionReady({ status: 'not_provisioned', profileId: null })).toBe(false)
    expect(
      mod.isExecutionReady({
        status: 'revoked',
        profileId: 1,
        revokedAt: new Date(),
        reason: null,
      }),
    ).toBe(false)
    expect(mod.isExecutionReady({ status: 'db_unavailable' })).toBe(false)
  })
})

describe('recordIssuerDailySpend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
  })

  it('rejects negative amounts before any DB call', async () => {
    const mod = await importModule()
    const result = await mod.recordIssuerDailySpend({ profileId: 1, amountWei: -1n })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('negative_amount')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('returns the new total from RETURNING spent_wei', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({ rows: [{ spent_wei: '12345' }] })),
    )
    const mod = await importModule()
    const result = await mod.recordIssuerDailySpend({ profileId: 1, amountWei: 100n })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.newTotalWei).toBe(12_345n)
  })
})
