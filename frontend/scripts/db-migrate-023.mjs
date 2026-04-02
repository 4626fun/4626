import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg

function parseEnvFile(filepath) {
  if (!existsSync(filepath)) return {}
  const out = {}
  const raw = readFileSync(filepath, 'utf8')
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function resolveDatabaseUrl() {
  const localEnv = parseEnvFile(path.join(process.cwd(), '.env'))
  const rootEnv = parseEnvFile(path.join(process.cwd(), '..', '.env'))
  return String(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      localEnv.DATABASE_URL ||
      localEnv.POSTGRES_URL ||
      rootEnv.DATABASE_URL ||
      rootEnv.POSTGRES_URL ||
      '',
  ).trim()
}

function isPostgresUrl(value) {
  return /^postgres(ql)?:\/\//i.test(String(value || '').trim())
}

function parseEnvBool(value) {
  const v = String(value || '').trim().toLowerCase()
  if (!v) return undefined
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return undefined
}

async function main() {
  const databaseUrl = resolveDatabaseUrl()
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL/POSTGRES_URL (env or .env files).')
  }
  if (!isPostgresUrl(databaseUrl)) {
    throw new Error('Configured database URL is not a postgres:// URL.')
  }

  const migrationPath = path.join(
    process.cwd(),
    'db',
    'migrations',
    '023_enable_rls_on_internal_public_tables.sql',
  )
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration file missing: ${migrationPath}`)
  }

  const sqlText = readFileSync(migrationPath, 'utf8')
  const targetTables = [
    'image_generation_assets',
    'image_generation_projects',
    'lottery_amoe_nonces',
    'lottery_amoe_entries',
    'image_generation_attempts',
    'lottery_amoe_daily_twitter_checkins',
    'image_generation_jobs',
    'miniapp_notifications',
    'telegram_holder_room_policies',
    'keepr_vault_automation',
    'telegram_action_tokens',
    'telegram_user_links',
    'telegram_action_audit',
    'telegram_chat_vault_scope',
    'telegram_holder_room_members',
    'telegram_trade_percent_prompts',
    'telegram_funnel_events',
    'telegram_miniapp_replay_nonces',
    'telegram_miniapp_sessions',
    'creator_metrics_daily_snapshots',
    'telegram_onboarding_sessions',
    'telegram_private_dm_welcome_sent',
    'telegram_link_start_token_claims',
    'telegram_inline_signal_feeds',
    'telegram_active_messages',
  ]

  const isLocal = /localhost|127\.0\.0\.1/i.test(databaseUrl)
  const rejectUnauthorized = parseEnvBool(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED)
  const client = new Client({
    connectionString: databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: rejectUnauthorized ?? true },
  })

  try {
    await client.connect()
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '5s'`)
    await client.query(`SET LOCAL statement_timeout = '120s'`)
    await client.query(sqlText)

    const check = await client.query(
      `
      SELECT
        t.tablename AS table_name,
        c.relrowsecurity AS rls_enabled,
        EXISTS (
          SELECT 1
          FROM pg_policies p
          WHERE p.schemaname = 'public'
            AND p.tablename = t.tablename
            AND p.policyname = t.tablename || '_deny_all'
        ) AS has_deny_policy
      FROM pg_tables t
      INNER JOIN pg_class c ON c.relname = t.tablename
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.schemaname = 'public'
        AND n.nspname = 'public'
        AND t.tablename = ANY($1::text[])
      ORDER BY t.tablename
      `,
      [targetTables],
    )

    const invalid = check.rows.filter(
      row => !row.rls_enabled || !row.has_deny_policy,
    )
    if (invalid.length > 0) {
      const details = invalid
        .map(
          row =>
            `${row.table_name}(rls=${String(row.rls_enabled)},denyPolicy=${String(row.has_deny_policy)})`,
        )
        .join(', ')
      throw new Error(`Migration verification failed: ${details}`)
    }

    await client.query('COMMIT')
    console.log('migration=023_enable_rls_on_internal_public_tables')
    console.log(`verified_tables=${check.rows.length}`)
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback errors
    }
    throw error
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch(error => {
  console.error('[db:migrate:023] failed:', error?.message || String(error))
  process.exit(1)
})
