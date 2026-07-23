/**
 * Unit tests for commandIssuerContext — Architecture B Phase 2.
 *
 * Verifies:
 *  - Address-keyed and profileId-keyed resolution
 *  - Revoked rows surface as `revoked` (not `ready`)
 *  - Missing DB config returns `db_unavailable`
 *  - `isExecutionReady` narrows the union correctly
 *  - recordIssuerDailySpend + rollback invariants
 *
 * NOTE: The real implementation has been promoted to @4626/server-core.
 * This test file (and its sibling thin re-export) exist only for the transition period.
 * Mocks and assertions here continue to target the public surface.
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

vi.mock('@4626/server-core/commandIssuerContext', async () => {
  return await import('../../../packages/server-core/src/commandIssuerContext.ts')
})

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
  profile_csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
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
    let query = ''
    getDbMock.mockResolvedValue(makeDb(async (strings) => {
      query = (strings as TemplateStringsArray).join('?').replace(/\s+/g, ' ')
      return { rows: [BASE_ROW] }
    }))
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
      expect(result.context.subAccount).toBeNull()
    }
    expect(query).toContain('SELECT ctx.*, p.csw_address AS profile_csw_address')
  })

  it.each([
    ['sub-account address', { sub_account_address: '0x1111111111111111111111111111111111111111' }],
    ['spend payload', { spend_permission_payload: { account: BASE_ROW.smart_wallet_address } }],
    ['spend signature', { spend_permission_signature: '0xabcd' }],
    ['spend hash', { spend_permission_hash: '0xdeadbeef' }],
    ['spend allowance', { spend_allowance_wei: '1' }],
    ['spend period', { spend_period_seconds: 86_400 }],
  ])('fails closed when legacy %s remains', async (_label, artifact) => {
    getDbMock.mockResolvedValue(makeDb(async () => ({ rows: [{ ...BASE_ROW, ...artifact }] })))
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result).toEqual({ status: 'not_provisioned', profileId: 42 })
  })

  it('accepts a parent-CSW row based on profiles.csw_address despite stale legacy parent metadata', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({
        rows: [{
          ...BASE_ROW,
          parent_csw_address: '0x1111111111111111111111111111111111111111',
        }],
      })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(BASE_ROW.smart_wallet_address)
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.context.smartWallet).toBe(BASE_ROW.profile_csw_address)
      expect(result.context.subAccount).toBeNull()
    }
  })

  it('fails closed when a spend permission is expired', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({
        rows: [{ ...BASE_ROW, spend_permission_end_at: '2020-01-01T00:00:00.000Z' }],
      })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(BASE_ROW.smart_wallet_address)
    expect(result).toEqual({ status: 'not_provisioned', profileId: 42 })
  })

  it('surfaces a revoked spend permission as revoked', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({
        rows: [{ ...BASE_ROW, spend_permission_revoked_at: '2026-04-18T00:00:00.000Z' }],
      })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(BASE_ROW.smart_wallet_address)
    expect(result).toMatchObject({
      status: 'revoked',
      profileId: 42,
      reason: 'legacy_spend_permission_revoked',
    })
  })

  it('fails closed for an unparseable non-null spend revocation timestamp', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({
        rows: [{ ...BASE_ROW, spend_permission_revoked_at: 'not-a-date' }],
      })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(BASE_ROW.smart_wallet_address)
    expect(result).toEqual({ status: 'not_provisioned', profileId: 42 })
  })

  it('fails closed when the execution wallet differs from the profile canonical CSW', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({
        rows: [{ ...BASE_ROW, profile_csw_address: '0x1111111111111111111111111111111111111111' }],
      })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(BASE_ROW.smart_wallet_address)
    expect(result).toEqual({ status: 'not_provisioned', profileId: 42 })
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
    let query = ''
    getDbMock.mockResolvedValue(makeDb(async (strings) => {
      query = (strings as TemplateStringsArray).join('?').replace(/\s+/g, ' ')
      return { rows: [BASE_ROW] }
    }))
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByProfileId(42)
    expect(result.status).toBe('ready')
    expect(query).toContain('SELECT ctx.*, p.csw_address AS profile_csw_address')
  })

  it('applies the same legacy-artifact fail-closed policy for profile resolution', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({ rows: [{ ...BASE_ROW, spend_permission_signature: '0xabcd' }] })),
    )
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByProfileId(42)
    expect(result).toEqual({ status: 'not_provisioned', profileId: 42 })
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
        subAccount: null,
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

describe('provisionCommandIssuerContext UPSERT — clears legacy sub-account columns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
  })

  function buildSimulator() {
    let current: Record<string, unknown> | null = null

    function sqlImpl(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join('?')
      const lower = sql.toLowerCase()

      if (lower.includes('insert into command_issuer_execution_context')) {
        const [
          profileId,
          smartWallet,
          privyOwnerWalletId,
          ownerEoa,
          ownerIndex,
          paymasterPolicy,
          perTxStr,
          dailyStr,
          provisionedBy,
        ] = values

        const incoming: Record<string, unknown> = {
          profile_id: profileId,
          smart_wallet_address: smartWallet,
          profile_csw_address: smartWallet,
          privy_owner_wallet_id: privyOwnerWalletId,
          owner_eoa_address: ownerEoa,
          owner_index: ownerIndex,
          paymaster_policy: paymasterPolicy,
          caps_version: 1,
          per_tx_cap_wei: perTxStr,
          daily_cap_wei: dailyStr,
          provisioned_by: provisionedBy,
          provisioned_at:
            current?.provisioned_at ?? new Date('2026-04-19T00:00:00.000Z').toISOString(),
          revoked_at: null,
          revoked_reason: null,
          sub_account_address: null,
          parent_csw_address: null,
          spend_permission_payload: null,
          spend_permission_signature: null,
          spend_permission_hash: null,
          spend_allowance_wei: null,
          spend_period_seconds: null,
          spend_permission_end_at: null,
          spend_permission_revoked_at: null,
        }

        if (!current) {
          current = incoming
          return Promise.resolve({ rows: [] })
        }

        current = {
          ...current,
          smart_wallet_address: incoming.smart_wallet_address,
          privy_owner_wallet_id: incoming.privy_owner_wallet_id,
          owner_eoa_address: incoming.owner_eoa_address,
          owner_index: incoming.owner_index,
          paymaster_policy: incoming.paymaster_policy,
          per_tx_cap_wei: incoming.per_tx_cap_wei,
          daily_cap_wei: incoming.daily_cap_wei,
          provisioned_by: incoming.provisioned_by,
          revoked_at: null,
          revoked_reason: null,
          sub_account_address: null,
          parent_csw_address: null,
          spend_permission_payload: null,
          spend_permission_signature: null,
          spend_permission_hash: null,
          spend_allowance_wei: null,
          spend_period_seconds: null,
          spend_permission_end_at: null,
          spend_permission_revoked_at: null,
        }
        return Promise.resolve({ rows: [] })
      }

      if (
        lower.includes('select * from command_issuer_execution_context') ||
        lower.includes('from command_issuer_execution_context ctx')
      ) {
        return Promise.resolve({ rows: current ? [current] : [] })
      }

      return Promise.resolve({ rows: [] })
    }

    return {
      db: { sql: sqlImpl },
      getRow: () => current,
      seedLegacySubAccount: () => {
        if (!current) return
        current = {
          ...current,
          sub_account_address: '0x1111111111111111111111111111111111111111',
          parent_csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
          spend_permission_signature: '0xabcd',
          spend_permission_hash: '0xdeadbeef',
          spend_allowance_wei: '500000000000000000',
          spend_period_seconds: 86_400,
          spend_permission_end_at: '2099-01-01T00:00:00.000Z',
          spend_permission_revoked_at: '2026-04-18T00:00:00.000Z',
        }
      },
    }
  }

  it('clears legacy sub-account columns when re-provisioned via enroll', async () => {
    const sim = buildSimulator()
    getDbMock.mockResolvedValue(sim.db)
    const mod = await importModule()

    const first = await mod.provisionCommandIssuerContext({
      profileId: 42,
      smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      privyOwnerWalletId: 'privy-wallet-1',
      ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 1,
      perTxCapWei: 10_000_000_000_000_000n,
      dailyCapWei: 50_000_000_000_000_000n,
      paymasterPolicy: 'cdp_default',
      provisionedBy: 'user:test',
    })
    expect(first.ok).toBe(true)
    sim.seedLegacySubAccount()

    const second = await mod.provisionCommandIssuerContext({
      profileId: 42,
      smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      privyOwnerWalletId: 'privy-wallet-2',
      ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 0,
      perTxCapWei: 20_000_000_000_000_000n,
      dailyCapWei: 100_000_000_000_000_000n,
      paymasterPolicy: 'cdp_default',
      provisionedBy: 'admin:legacy',
    })
    expect(second.ok).toBe(true)
    const afterSecond = sim.getRow()!

    expect(afterSecond.privy_owner_wallet_id).toBe('privy-wallet-2')
    expect(afterSecond.sub_account_address).toBeNull()
    expect(afterSecond.parent_csw_address).toBeNull()
    expect(afterSecond.spend_permission_signature).toBeNull()
    expect(afterSecond.spend_permission_revoked_at).toBeNull()
  })
})

describe('recordIssuerDailySpend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
  })

  it('rejects negative amounts before any DB call', async () => {
    const mod = await importModule()
    const result = await mod.recordIssuerDailySpend({ profileId: 1, amountWei: -1n, dailyCapWei: 100n })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('negative_amount')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('returns the new total from RETURNING spent_wei', async () => {
    getDbMock.mockResolvedValue(
      makeDb(async () => ({ rows: [{ spent_wei: '12345' }] })),
    )
    const mod = await importModule()
    const result = await mod.recordIssuerDailySpend({ profileId: 1, amountWei: 100n, dailyCapWei: 1_000n })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.newTotalWei).toBe(12_345n)
  })

  it('fails atomically when the conditional upsert returns no row', async () => {
    getDbMock.mockResolvedValue(makeDb(async () => ({ rows: [] })))
    const mod = await importModule()
    const result = await mod.recordIssuerDailySpend({
      profileId: 1,
      amountWei: 100n,
      dailyCapWei: 100n,
    })
    expect(result).toEqual({ ok: false, error: 'cap_exceeded' })
  })
})
