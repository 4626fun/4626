import { createHash, randomBytes } from 'node:crypto'

type DbWithSql = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

const HANDOFF_TTL_SECONDS = 60 * 2 // 2m

let handoffSchemaEnsured = false

export function makeHandoffCode(): string {
  // 32 bytes => 64-char hex code; high entropy and URL-safe.
  return randomBytes(32).toString('hex')
}

// FIX: FINDING-01 — fail hard when secrets are absent or too short;
// the previous globalThis fallback produced ephemeral per-isolate keys on serverless,
// causing handoff codes to fail validation across cold starts and regions.
// FIX: FINDING-15 — prefer a dedicated AUTH_HANDOFF_SECRET for key separation;
// falls back to AUTH_SESSION_SECRET for backward compatibility during migration.
function getHandoffHashSecret(): string {
  const handoffEnv = process.env.AUTH_HANDOFF_SECRET
  if (typeof handoffEnv === 'string' && handoffEnv.trim().length >= 32) return handoffEnv.trim()

  const sessionEnv = process.env.AUTH_SESSION_SECRET
  if (typeof sessionEnv === 'string' && sessionEnv.trim().length >= 32) return sessionEnv.trim()

  throw new Error(
    'AUTH_HANDOFF_SECRET (or AUTH_SESSION_SECRET) is missing or shorter than 32 characters. ' +
    'Set a stable, high-entropy secret in the environment before accepting requests.',
  )
}

function hashHandoffCode(code: string): string {
  return createHash('sha256')
    .update(`${getHandoffHashSecret()}:${code}`)
    .digest('hex')
}

export async function ensureHandoffSchema(db: DbWithSql): Promise<void> {
  if (handoffSchemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS auth_handoffs (
        code_hash TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        privy_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      );
    `
    // Index on expires_at omitted: table is tiny (ephemeral rows, purged by pg_cron nightly)
    // and seq scan is faster than index maintenance overhead at this scale.
    // Backfill column for existing tables.
    await db.sql`
      ALTER TABLE auth_handoffs ADD COLUMN IF NOT EXISTS privy_token TEXT;
    `
    handoffSchemaEnsured = true
  } catch (err) {
    handoffSchemaEnsured = false
    throw err
  }
}

export async function createHandoffCode(db: DbWithSql, params: { address: string; privyToken?: string | null; now?: number }): Promise<{ code: string; expiresAt: string }> {
  const nowMs = typeof params.now === 'number' ? params.now : Date.now()
  const code = makeHandoffCode()
  const codeHash = hashHandoffCode(code)
  const expiresAt = new Date(nowMs + HANDOFF_TTL_SECONDS * 1000)
  const privyToken = typeof params.privyToken === 'string' && params.privyToken.trim() ? params.privyToken.trim() : null

  await db.sql`
    INSERT INTO auth_handoffs (code_hash, address, privy_token, expires_at)
    VALUES (${codeHash}, ${params.address.toLowerCase()}, ${privyToken}, ${expiresAt.toISOString()})
    ON CONFLICT (code_hash) DO NOTHING;
  `

  return { code, expiresAt: expiresAt.toISOString() }
}

export async function consumeHandoffCode(db: DbWithSql, code: string): Promise<{ address: string; privyToken: string | null } | null> {
  const codeHash = hashHandoffCode(code)

  // Mark consumed and read privy_token in one atomic step using a CTE.
  // The CTE captures the token before the UPDATE clears it, preventing
  // the RETURNING clause from always yielding NULL.
  const result = await db.sql`
    WITH target AS (
      SELECT code_hash, address, privy_token
      FROM auth_handoffs
      WHERE code_hash = ${codeHash}
        AND consumed_at IS NULL
        AND expires_at > NOW()
      FOR UPDATE
    )
    UPDATE auth_handoffs h
    SET consumed_at = NOW(), privy_token = NULL
    FROM target t
    WHERE h.code_hash = t.code_hash
    RETURNING t.address, t.privy_token;
  `

  const row = Array.isArray(result.rows) ? result.rows[0] : null
  const address = row && typeof row.address === 'string' ? row.address.trim().toLowerCase() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null
  const privyToken = row && typeof row.privy_token === 'string' && row.privy_token.trim() ? row.privy_token.trim() : null
  return { address, privyToken }
}
