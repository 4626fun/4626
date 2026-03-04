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

function getHandoffHashSecret(): string {
  const env = process.env.AUTH_SESSION_SECRET
  if (typeof env === 'string' && env.trim().length >= 16) return env.trim()

  const g: any = globalThis as any
  if (!g.__4626_handoff_secret) g.__4626_handoff_secret = randomBytes(32).toString('hex')
  return String(g.__4626_handoff_secret)
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      );
    `
    await db.sql`CREATE INDEX IF NOT EXISTS auth_handoffs_expires_idx ON auth_handoffs (expires_at);`
    handoffSchemaEnsured = true
  } catch (err) {
    handoffSchemaEnsured = false
    throw err
  }
}

export async function createHandoffCode(db: DbWithSql, params: { address: string; now?: number }): Promise<{ code: string; expiresAt: string }> {
  const nowMs = typeof params.now === 'number' ? params.now : Date.now()
  const code = makeHandoffCode()
  const codeHash = hashHandoffCode(code)
  const expiresAt = new Date(nowMs + HANDOFF_TTL_SECONDS * 1000)

  await db.sql`
    INSERT INTO auth_handoffs (code_hash, address, expires_at)
    VALUES (${codeHash}, ${params.address.toLowerCase()}, ${expiresAt.toISOString()})
    ON CONFLICT (code_hash) DO NOTHING;
  `

  return { code, expiresAt: expiresAt.toISOString() }
}

export async function consumeHandoffCode(db: DbWithSql, code: string): Promise<{ address: string } | null> {
  const codeHash = hashHandoffCode(code)
  const result = await db.sql`
    UPDATE auth_handoffs
    SET consumed_at = NOW()
    WHERE code_hash = ${codeHash}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING address;
  `

  const row = Array.isArray(result.rows) ? result.rows[0] : null
  const address = row && typeof row.address === 'string' ? row.address.trim().toLowerCase() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return null
  return { address }
}
