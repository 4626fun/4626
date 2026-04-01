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
    '024_move_vector_extension_to_extensions_schema.sql',
  )
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration file missing: ${migrationPath}`)
  }

  const sqlText = readFileSync(migrationPath, 'utf8')
  const isLocal = /localhost|127\.0\.0\.1/i.test(databaseUrl)
  const rejectUnauthorized = parseEnvBool(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED)
  const client = new Client({
    connectionString: databaseUrl,
    ssl: isLocal ? undefined : { rejectUnauthorized: rejectUnauthorized ?? false },
  })

  try {
    await client.connect()
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '5s'`)
    await client.query(`SET LOCAL statement_timeout = '60s'`)
    await client.query(sqlText)

    const check = await client.query(
      `
      SELECT n.nspname AS schema_name
      FROM pg_extension e
      INNER JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname = 'vector'
      LIMIT 1
      `,
    )

    if (check.rowCount === 0) {
      throw new Error('Migration verification failed: extension "vector" does not exist.')
    }

    const schemaName = String(check.rows[0].schema_name || '')
    if (schemaName !== 'extensions') {
      throw new Error(
        `Migration verification failed: extension "vector" is in schema "${schemaName}", expected "extensions".`,
      )
    }

    await client.query('COMMIT')
    console.log('migration=024_move_vector_extension_to_extensions_schema')
    console.log(`vector_schema=${schemaName}`)
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
  console.error('[db:migrate:024] failed:', error?.message || String(error))
  process.exit(1)
})
