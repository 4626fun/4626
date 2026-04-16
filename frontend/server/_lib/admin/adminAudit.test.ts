import { describe, expect, it, vi } from 'vitest'

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

    expect(executed.join('\n')).toMatch(/ALTER TABLE\s+admin_logs\s+ADD COLUMN IF NOT EXISTS\s+ip_hash\b/i)
  })
})
