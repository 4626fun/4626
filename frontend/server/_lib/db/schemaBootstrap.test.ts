import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('resolveSupabaseMigrationsRoot', () => {
  const originalEnv = process.env.SUPABASE_MIGRATIONS_DIR

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.SUPABASE_MIGRATIONS_DIR
    else process.env.SUPABASE_MIGRATIONS_DIR = originalEnv
    vi.resetModules()
  })

  it('prefers SUPABASE_MIGRATIONS_DIR when set', async () => {
    const tmp = mkdtempSync(join(tmpdir(), '4626-migrations-'))
    const migrations = join(tmp, 'supabase', 'migrations')
    mkdirSync(migrations, { recursive: true })
    writeFileSync(join(migrations, 'probe.sql'), '-- probe')

    process.env.SUPABASE_MIGRATIONS_DIR = migrations
    const { resolveSupabaseMigrationsRoot } = await import('./schemaBootstrap.js')
    expect(resolveSupabaseMigrationsRoot()).toBe(resolve(migrations))
  })

  it('walks up from cwd to find supabase/migrations', async () => {
    delete process.env.SUPABASE_MIGRATIONS_DIR
    const { resolveSupabaseMigrationsRoot } = await import('./schemaBootstrap.js')
    const root = resolveSupabaseMigrationsRoot()
    expect(root.endsWith('supabase/migrations')).toBe(true)
    expect(resolve(join(root, '20260606000000_auth_nonce_handoff_schema.sql'))).toBe(
      resolve(root, '20260606000000_auth_nonce_handoff_schema.sql'),
    )
  })
})

describe('ensureAlfaclubInverseOpinionTradeSchema', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('recognizes an already-applied multi-table migration through table probes', async () => {
    const queries: string[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ')
        queries.push(text)
        if (text.includes('schema_bootstrap_ledger')) {
          return { rows: [{ ok: false }] }
        }
        if (text.includes('inverse_opinion_source_messages')) {
          return { rows: [{ ok: true }] }
        }
        return { rows: [] }
      }),
    }
    const { ensureAlfaclubInverseOpinionTradeSchema } = await import('./schemaBootstrap.js')

    await ensureAlfaclubInverseOpinionTradeSchema(db)
    await ensureAlfaclubInverseOpinionTradeSchema(db)

    const probe = queries.find((query) => query.includes('inverse_opinion_source_messages'))
    expect(probe).toContain('inverse_opinion_trade_decisions')
    expect(probe).toContain('inverse_position_lifecycles')
    expect(probe).toContain('inverse_position_lifecycle_events')
    expect(queries.filter((query) => query.includes('inverse_opinion_source_messages'))).toHaveLength(1)
  })
})
