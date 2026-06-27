import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dbSqlMock, getDbMock, ensureKeeprSchemaMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn<(...args: any[]) => Promise<{ rows: any[]; rowCount?: number }>>(async () => ({
    rows: [] as any[],
    rowCount: 0,
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  ensureKeeprSchemaMock: vi.fn(async () => undefined),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@4626/server-core')
  return {
    ...actual,
    checkDurableRateLimit: vi.fn(async () => ({ allowed: true, remaining: 999, resetAt: Date.now() + 60_000, source: 'memory' })),
    getDb: getDbMock,
    isDbConfigured: () => true,
  }
})

vi.mock('../../server/_lib/keepr/keeperRegistryBootstrap.js', () => ({
  ensureKeeperRegistryForVault: vi.fn(async () => ({
    vaultAddress: '0x1111111111111111111111111111111111111111',
    keeprProvisioned: false,
    ajnaSeeded: false,
    warnings: [],
  })),
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

import {
  executeSettleVault,
  parseSettleVaultInput,
  SettleVaultExecutionError,
} from '../../server/_lib/controlPlane/executors/executeSettleVault.js'

describe('executeSettleVault', () => {
  const VAULT = '0x1111111111111111111111111111111111111111'

  beforeEach(() => {
    vi.clearAllMocks()
    dbSqlMock.mockImplementation(async () => ({
      rows: [],
      rowCount: 0,
    }))
  })

  it('rejects settledAt without settlementStage completed', () => {
    expect(() =>
      parseSettleVaultInput({
        vaultAddress: VAULT,
        settledAt: new Date().toISOString(),
      }),
    ).toThrow(SettleVaultExecutionError)
  })

  it('writes settlement fields to keepr_vaults', async () => {
    dbSqlMock.mockImplementation(async (...args: any[]) => {
      const first = args[0] as TemplateStringsArray | undefined
      const text = String(first?.[0] ?? '')
      if (text.includes('UPDATE keepr_vaults')) {
        return { rows: [{ ok: 1 }], rowCount: 1 }
      }
      return { rows: [], rowCount: 0 }
    })

    const settledAt = new Date().toISOString()
    const result = await executeSettleVault({
      vaultAddress: VAULT,
      settledAt,
      settlementStage: 'completed',
    })

    expect(result.updated).toBe(true)
    expect(result.stageUpdated).toBe(true)
    expect(ensureKeeprSchemaMock).toHaveBeenCalledTimes(1)
    const sqlTexts = dbSqlMock.mock.calls.map((call) => {
      const first = call[0] as TemplateStringsArray | undefined
      return String(first?.[0] ?? '')
    })
    expect(sqlTexts.some((text) => text.includes('UPDATE keepr_vaults'))).toBe(true)
  })

  it('fails closed when vault row is missing from keepr registry', async () => {
    await expect(
      executeSettleVault({
        vaultAddress: VAULT,
        settlementStage: 'completed',
        settledAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'vault_not_found_in_keepr_registry',
      statusCode: 404,
    })
  })
})
