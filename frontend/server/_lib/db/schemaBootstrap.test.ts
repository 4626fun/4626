import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

  it('recognizes inverse-trade migrations only after required tables, triggers, indexes, and RLS exist', async () => {
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
        if (text.includes('inverse_opinion_fill_claims')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_opinion_trade_analyses')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_opinion_trade_journal_dispatch')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_opinion_trade_decisions_submitted_recovery_idx')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_journal_revision_recovery_idx')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_opinion_reply_deliveries')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_opinion_reply_delivery_resolution_audit')) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('inverse_opinion_trade_journal_deliveries')) {
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
    expect(probe).toContain('inverse_opinion_decision_transition_guard')
    expect(probe).toContain('inverse_position_lifecycle_transition_guard')
    expect(probe).toContain('inverse_position_lifecycles_one_open_idx')
    expect(probe).toContain('relrowsecurity')
    expect(queries.filter((query) => query.includes('inverse_opinion_source_messages'))).toHaveLength(1)
    const analysisProbe = queries.find((query) => query.includes('inverse_opinion_trade_analyses'))
    expect(analysisProbe).toContain('inverse_opinion_trade_analyses_lifecycle_time_idx')
    expect(analysisProbe).toContain('inverse_opinion_trade_analyses_window_idx')
    expect(analysisProbe).toContain('inverse_opinion_trade_analysis_only_check')
    expect(analysisProbe).toContain('relrowsecurity')
    expect(queries.filter((query) => query.includes('inverse_opinion_trade_analyses'))).toHaveLength(1)
    expect(queries.filter((query) => query.includes('inverse_opinion_fill_claims'))).toHaveLength(1)
    const dispatchProbe = queries.find((query) => query.includes('inverse_opinion_trade_journal_dispatch'))
    expect(dispatchProbe).toContain('inverse_opinion_trade_journal_revision_audit')
    expect(dispatchProbe).toContain('inverse_journal_dispatch_state_lease_idx')
    expect(dispatchProbe).toContain('inverse_journal_dispatch_state_check')
    expect(dispatchProbe).toContain('inverse_journal_revision_state_check')
    expect(dispatchProbe).toContain('relrowsecurity')
    expect(queries.filter((query) => query.includes('inverse_opinion_trade_journal_dispatch'))).toHaveLength(1)
    const reliabilityProbe = queries.find((query) => query.includes('inverse_opinion_trade_journal_deliveries'))
    expect(reliabilityProbe).toContain('inverse_opinion_trade_journal_resolution_audit')
    expect(reliabilityProbe).toContain('relrowsecurity')
    expect(queries.filter((query) => query.includes('inverse_opinion_trade_journal_deliveries'))).toHaveLength(2)
    const completionProbe = queries.find(
      (query) => query.includes('inverse_opinion_trade_decisions_submitted_recovery_idx'),
    )
    expect(completionProbe).toContain("column_name = 'public_text'")
    expect(completionProbe).toContain('character_maximum_length = 2000')
    expect(completionProbe).toContain("column_name = 'last_error_code'")
    const revisionRecoveryProbe = queries.find(
      (query) => query.includes('inverse_journal_revision_recovery_idx'),
    )
    expect(revisionRecoveryProbe).toContain("column_name = 'public_text'")
    expect(revisionRecoveryProbe).toContain('inverse_journal_revision_immutable_payload_guard')
    const replyDeliveryProbe = queries.find(
      (query) => query.includes('inverse_opinion_reply_deliveries'),
    )
    expect(replyDeliveryProbe).toContain('inverse_opinion_reply_delivery_recovery_idx')
    expect(replyDeliveryProbe).toContain('inverse_opinion_reply_delivery_payload_guard')
    expect(replyDeliveryProbe).toContain('relrowsecurity')
    const replyResolutionProbe = queries.find(
      (query) => query.includes('inverse_opinion_reply_delivery_resolution_audit'),
    )
    expect(replyResolutionProbe).toContain(
      'inverse_opinion_reply_delivery_resolution_audit_pkey',
    )
    expect(replyResolutionProbe).toContain('inverse_opinion_reply_resolution_delivery_fk')
    expect(replyResolutionProbe).toContain('inverse_opinion_reply_resolution_note_check')
    expect(replyResolutionProbe).toContain('relrowsecurity')
    expect(replyResolutionProbe).toContain("'service_role'")
    expect(replyResolutionProbe).toContain("'anon'")
    expect(replyResolutionProbe).toContain("'authenticated'")
  })

  it('wires terminal reply resolution immediately after delivery with strict recorded verification', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'server/_lib/db/schemaBootstrap.ts'),
      'utf8',
    )
    const delivery = source.indexOf(
      "'20260717070000_alfaclub_inverse_opinion_reply_delivery.sql'",
    )
    const resolution = source.indexOf(
      "'20260717080000_alfaclub_inverse_opinion_reply_resolution.sql'",
    )

    expect(delivery).toBeGreaterThan(-1)
    expect(resolution).toBeGreaterThan(delivery)
    expect(source.slice(delivery, resolution)).not.toContain(
      "ensureMigrationApplied(\n      db,\n      '",
    )
    expect(source.slice(resolution, resolution + 3_500)).toContain(
      '{ strict: true, verifyRecorded: true }',
    )
  })

  it('propagates non-benign inverse-trade bootstrap failures instead of ledgering partial schema', async () => {
    const migrationError = Object.assign(new Error('permission denied for schema alfaclub'), {
      code: '42501',
    })
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ')
        if (text.includes('schema_bootstrap_ledger')) return { rows: [{ ok: false }] }
        if (text.includes('to_regclass')) return { rows: [{ ok: false }] }
        throw migrationError
      }),
    }
    const { ensureAlfaclubInverseOpinionTradeSchema } = await import('./schemaBootstrap.js')

    await expect(ensureAlfaclubInverseOpinionTradeSchema(db)).rejects.toThrow(
      'permission denied for schema alfaclub',
    )
  })

  it('re-verifies ledgered inverse schema instead of trusting a partial bootstrap entry', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ')
        if (text.includes("to_regclass('public.schema_bootstrap_ledger')")) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('FROM public.schema_bootstrap_ledger')) {
          return { rows: [{ '?column?': 1 }] }
        }
        if (text.includes('inverse_opinion_source_messages')) {
          return { rows: [{ ok: false }] }
        }
        throw new Error('partial_schema_reapply_attempted')
      }),
    }
    const { ensureAlfaclubInverseOpinionTradeSchema } = await import('./schemaBootstrap.js')

    await expect(ensureAlfaclubInverseOpinionTradeSchema(db)).rejects.toThrow(
      'partial_schema_reapply_attempted',
    )
  })

  it.each([
    {
      filename: '20260717010000_alfaclub_inverse_opinion_trade_analysis.sql',
      probe: 'inverse_opinion_trade_analyses',
    },
    {
      filename: '20260717020000_alfaclub_inverse_opinion_trade_journal_dispatch.sql',
      probe: 'inverse_journal_dispatch_state_lease_idx',
    },
  ])('does not trust a ledgered partial $filename schema', async ({ filename, probe }) => {
    let applyingTarget = false
    let ledgerWrites = 0
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.join(' ')
        if (text.includes("to_regclass('public.schema_bootstrap_ledger')")) {
          return { rows: [{ ok: true }] }
        }
        if (text.includes('FROM public.schema_bootstrap_ledger')) {
          return { rows: [{ recorded: values[0] }] }
        }
        if (text.includes('INSERT INTO public.schema_bootstrap_ledger')) {
          ledgerWrites += 1
          return { rows: [] }
        }
        if (!Object.prototype.hasOwnProperty.call(strings, 'raw')) {
          throw new Error(`strict_reapply:${filename}`)
        }
        if (text.includes(probe)) {
          applyingTarget = true
          return { rows: [{ ok: false }] }
        }
        if (text.includes('to_regclass') || text.includes('relrowsecurity')) {
          return { rows: [{ ok: true }] }
        }
        if (applyingTarget) throw new Error(`strict_reapply:${filename}`)
        return { rows: [] }
      }),
    }
    const { ensureAlfaclubInverseOpinionTradeSchema } = await import('./schemaBootstrap.js')

    await expect(ensureAlfaclubInverseOpinionTradeSchema(db)).rejects.toThrow(
      `strict_reapply:${filename}`,
    )
    expect(ledgerWrites).toBe(0)
  })
})
