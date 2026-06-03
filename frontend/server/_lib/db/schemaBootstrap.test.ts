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
