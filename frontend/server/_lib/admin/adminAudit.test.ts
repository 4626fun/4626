import { describe, expect, it, vi } from 'vitest'

const { ensureWalletOnchainOpsAuditSchemaMock } = vi.hoisted(() => ({
  ensureWalletOnchainOpsAuditSchemaMock: vi.fn(async () => {}),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureWalletOnchainOpsAuditSchema: ensureWalletOnchainOpsAuditSchemaMock,
}))

describe('ensureAdminAuditSchema', () => {
  it('backfills the ip_hash column for existing tables', async () => {
    vi.resetModules()

    const executed: string[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        executed.push(strings.join(''))
        return { rows: [] }
      }),
    }

    const { ensureAdminAuditSchema } = await import('./adminAudit')
    await ensureAdminAuditSchema(db as any)

    expect(ensureWalletOnchainOpsAuditSchemaMock).toHaveBeenCalledTimes(1)
    expect(ensureWalletOnchainOpsAuditSchemaMock).toHaveBeenCalledWith(db)
    expect(executed).toHaveLength(0)
  })
})
