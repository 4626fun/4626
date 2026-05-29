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
  const actual = await vi.importActual<Record<string, unknown>>('../../@4626/server-core')
  return {
    ...actual,
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
})
