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
      expect(result.context.subAccount).toBeNull()
    }
  })

  it('returns ready context with subAccount populated when sub-account columns are set', async () => {
    const subRow = {
      ...BASE_ROW,
      sub_account_address: '0x1111111111111111111111111111111111111111',
      parent_csw_address: '0xAB6D5C10B03300326CD7FAB7267AE192842967B5',
      spend_permission_payload: {
        account: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        spender: '0x1111111111111111111111111111111111111111',
        token: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
        allowance: '500000000000000000',
        period: 86400,
        start: 1_700_000_000,
        end: 4_700_000_000,
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
        extraData: '0x',
      },
      spend_permission_signature: '0xabcd',
      spend_permission_hash: '0xdeadbeef',
      spend_allowance_wei: '500000000000000000',
      spend_period_seconds: 86400,
      spend_permission_end_at: '2099-01-01T00:00:00.000Z',
      spend_permission_revoked_at: null,
    }
    getDbMock.mockResolvedValue(makeDb(async () => ({ rows: [subRow] })))
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.context.subAccount).not.toBeNull()
      if (result.context.subAccount) {
        expect(result.context.subAccount.subAccountAddress).toBe(
          '0x1111111111111111111111111111111111111111',
        )
        expect(result.context.subAccount.parentCswAddress).toBe(
          '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        )
        expect(result.context.subAccount.spendPermission.allowanceWei).toBe(
          500_000_000_000_000_000n,
        )
        expect(result.context.subAccount.spendPermission.periodSeconds).toBe(86400)
        expect(result.context.subAccount.spendPermission.revokedAt).toBeNull()
        expect(result.context.subAccount.spendPermission.signature).toBe('0xabcd')
        expect(result.context.subAccount.spendPermission.hash).toBe('0xdeadbeef')
      }
    }
  })

  it('falls back to subAccount=null when sub-account columns are partially populated', async () => {
    const badRow = {
      ...BASE_ROW,
      sub_account_address: '0x1111111111111111111111111111111111111111',
      parent_csw_address: null,
      spend_permission_payload: null,
      spend_permission_signature: null,
      spend_permission_hash: null,
      spend_allowance_wei: null,
      spend_period_seconds: null,
      spend_permission_end_at: null,
      spend_permission_revoked_at: null,
    }
    getDbMock.mockResolvedValue(makeDb(async () => ({ rows: [badRow] })))
    const mod = await importModule()
    const result = await mod.resolveCommandIssuerContextByAddress(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(result.status).toBe('ready')
    if (result.status === 'ready') {
      expect(result.context.subAccount).toBeNull()
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

describe('provisionCommandIssuerContext UPSERT — legacy reprovision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
  })

  // Minimal in-memory simulator of the command_issuer_execution_context row
  // plus the subset of SQL shapes produced by commandIssuerContext.ts:
  //  - INSERT ... ON CONFLICT DO UPDATE (the upsert under test)
  //  - SELECT * ... WHERE profile_id = ... LIMIT 1 (used by the reread)
  function buildSimulator() {
    let current: Record<string, unknown> | null = null

    function sqlImpl(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join('?')

      if (sql.includes('INSERT INTO command_issuer_execution_context')) {
        // Positional bind order must match the INSERT in commandIssuerContext.ts:
        //   profile_id, smart_wallet_address, privy_owner_wallet_id, owner_eoa_address,
        //   owner_index, paymaster_policy, per_tx_cap_wei, daily_cap_wei,
        //   provisioned_by,
        //   sub_account_address, parent_csw_address,
        //   spend_permission_payload, spend_permission_signature, spend_permission_hash,
        //   spend_allowance_wei, spend_period_seconds, spend_permission_end_at
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
          subAccountAddress,
          parentCswAddress,
          spendPayloadJson,
          spendSignature,
          spendHash,
          spendAllowanceStr,
          spendPeriodSeconds,
          spendEndAtIso,
        ] = values

        const incoming: Record<string, unknown> = {
          profile_id: profileId,
          smart_wallet_address: smartWallet,
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
          sub_account_address: subAccountAddress,
          parent_csw_address: parentCswAddress,
          spend_permission_payload:
            typeof spendPayloadJson === 'string' ? JSON.parse(spendPayloadJson) : null,
          spend_permission_signature: spendSignature,
          spend_permission_hash: spendHash,
          spend_allowance_wei: spendAllowanceStr,
          spend_period_seconds: spendPeriodSeconds,
          spend_permission_end_at: spendEndAtIso,
          spend_permission_revoked_at: null,
        }

        if (!current) {
          current = incoming
          return Promise.resolve({ rows: [] })
        }

        // Apply the ON CONFLICT DO UPDATE clause semantics.
        const coalesce = <T>(excluded: T, existing: T): T =>
          excluded === null || excluded === undefined ? existing : excluded

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
          sub_account_address: coalesce(
            incoming.sub_account_address,
            current.sub_account_address,
          ),
          parent_csw_address: coalesce(
            incoming.parent_csw_address,
            current.parent_csw_address,
          ),
          spend_permission_payload: coalesce(
            incoming.spend_permission_payload,
            current.spend_permission_payload,
          ),
          spend_permission_signature: coalesce(
            incoming.spend_permission_signature,
            current.spend_permission_signature,
          ),
          spend_permission_hash: coalesce(
            incoming.spend_permission_hash,
            current.spend_permission_hash,
          ),
          spend_allowance_wei: coalesce(
            incoming.spend_allowance_wei,
            current.spend_allowance_wei,
          ),
          spend_period_seconds: coalesce(
            incoming.spend_period_seconds,
            current.spend_period_seconds,
          ),
          spend_permission_end_at: coalesce(
            incoming.spend_permission_end_at,
            current.spend_permission_end_at,
          ),
          spend_permission_revoked_at:
            incoming.sub_account_address !== null
              ? null
              : current.spend_permission_revoked_at,
        }
        return Promise.resolve({ rows: [] })
      }

      if (sql.includes('SELECT * FROM command_issuer_execution_context')) {
        return Promise.resolve({ rows: current ? [current] : [] })
      }

      return Promise.resolve({ rows: [] })
    }

    return {
      db: { sql: sqlImpl },
      getRow: () => current,
    }
  }

  const SUB_ACCOUNT_INPUT = {
    subAccountAddress: '0x1111111111111111111111111111111111111111',
    parentCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    spendPermission: {
      payload: {
        account: '0xab6d5c10b03300326cd7fab7267ae192842967b5' as `0x${string}`,
        spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
        token: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`,
        allowance: '500000000000000000',
        period: 86_400,
        start: 1_700_000_000,
        end: 4_700_000_000,
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
        extraData: '0x',
      },
      signature: '0xabcd' as `0x${string}`,
      hash: '0xdeadbeef' as `0x${string}`,
      allowanceWei: 500_000_000_000_000_000n,
      periodSeconds: 86_400,
      endAt: new Date('2099-01-01T00:00:00.000Z'),
    },
  }

  it('preserves sub-account columns when re-provisioned with subAccount=undefined (legacy)', async () => {
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
      subAccount: SUB_ACCOUNT_INPUT,
    })
    expect(first.ok).toBe(true)
    const afterFirst = sim.getRow()!
    expect(afterFirst.sub_account_address).toBe(
      '0x1111111111111111111111111111111111111111',
    )
    expect(afterFirst.spend_permission_signature).toBe('0xabcd')

    // Legacy reprovision path: no subAccount passed. Changes caps + owner so
    // we can verify those DID get written while sub-account fields did NOT
    // get wiped.
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

    // Caps + owner-side fields DID get rewritten.
    expect(afterSecond.privy_owner_wallet_id).toBe('privy-wallet-2')
    expect(afterSecond.per_tx_cap_wei).toBe('20000000000000000')
    expect(afterSecond.daily_cap_wei).toBe('100000000000000000')

    // The 8 COALESCE'd sub-account columns are unchanged.
    expect(afterSecond.sub_account_address).toBe(
      '0x1111111111111111111111111111111111111111',
    )
    expect(afterSecond.parent_csw_address).toBe(
      '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    )
    expect(afterSecond.spend_permission_signature).toBe('0xabcd')
    expect(afterSecond.spend_permission_hash).toBe('0xdeadbeef')
    expect(afterSecond.spend_allowance_wei).toBe('500000000000000000')
    expect(afterSecond.spend_period_seconds).toBe(86_400)
    expect(afterSecond.spend_permission_end_at).toBe('2099-01-01T00:00:00.000Z')
    expect(afterSecond.spend_permission_payload).toMatchObject({
      account: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      spender: '0x1111111111111111111111111111111111111111',
    })
    // revoked_at preserved (was null, stays null — not reset).
    expect(afterSecond.spend_permission_revoked_at).toBeNull()
  })

  it('preserves a previously-set spend_permission_revoked_at when legacy reprovision runs', async () => {
    const sim = buildSimulator()
    getDbMock.mockResolvedValue(sim.db)
    const mod = await importModule()

    await mod.provisionCommandIssuerContext({
      profileId: 42,
      smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      privyOwnerWalletId: 'privy-wallet-1',
      ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 1,
      perTxCapWei: 10_000_000_000_000_000n,
      dailyCapWei: 50_000_000_000_000_000n,
      subAccount: SUB_ACCOUNT_INPUT,
    })
    // Simulate an external revoke between the two provisions.
    const row = sim.getRow()!
    row.spend_permission_revoked_at = '2026-04-18T00:00:00.000Z'

    const second = await mod.provisionCommandIssuerContext({
      profileId: 42,
      smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      privyOwnerWalletId: 'privy-wallet-1',
      ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 0,
      perTxCapWei: 20_000_000_000_000_000n,
      dailyCapWei: 100_000_000_000_000_000n,
    })
    expect(second.ok).toBe(true)
    const afterSecond = sim.getRow()!
    // Legacy reprovision MUST NOT silently clear a prior revocation.
    expect(afterSecond.spend_permission_revoked_at).toBe('2026-04-18T00:00:00.000Z')
  })

  it('clears spend_permission_revoked_at when a fresh sub-account IS written', async () => {
    const sim = buildSimulator()
    getDbMock.mockResolvedValue(sim.db)
    const mod = await importModule()

    await mod.provisionCommandIssuerContext({
      profileId: 42,
      smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      privyOwnerWalletId: 'privy-wallet-1',
      ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 1,
      perTxCapWei: 10_000_000_000_000_000n,
      dailyCapWei: 50_000_000_000_000_000n,
      subAccount: SUB_ACCOUNT_INPUT,
    })
    const row = sim.getRow()!
    row.spend_permission_revoked_at = '2026-04-18T00:00:00.000Z'

    const second = await mod.provisionCommandIssuerContext({
      profileId: 42,
      smartWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      privyOwnerWalletId: 'privy-wallet-1',
      ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 1,
      perTxCapWei: 10_000_000_000_000_000n,
      dailyCapWei: 50_000_000_000_000_000n,
      subAccount: SUB_ACCOUNT_INPUT,
    })
    expect(second.ok).toBe(true)
    expect(sim.getRow()!.spend_permission_revoked_at).toBeNull()
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
