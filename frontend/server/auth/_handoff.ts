import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { ensureAuthNonceHandoffSchema } from '../_lib/db/schemaBootstrap.js'

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

// M-21 (4626-330): encrypt privy_token at rest so a Supabase admin,
// leaked backup, or compromised read-only DB credential cannot
// replay Privy tokens during their (short) validity window.
//
// Encryption: AES-256-GCM. The key is derived once per process from
// AUTH_HANDOFF_PRIVY_TOKEN_KEY (preferred) or, as a fallback for
// environments that haven't provisioned the new key yet, from
// getHandoffHashSecret() via sha256. The fallback ensures we never
// silently write plaintext — if no key material is available the
// throw from getHandoffHashSecret surfaces to the caller.
//
// Ciphertext format (single string stored in privy_token column):
//   "v1:<base64(iv)>:<base64(tag)>:<base64(ciphertext)>"
// The "v1:" prefix lets us migrate to a stronger scheme later while
// keeping backward-compatibility with rows already in flight (the
// consume path treats any row without a recognised prefix as
// plaintext for backward compatibility during the rollout).
const PRIVY_TOKEN_CIPHER = 'aes-256-gcm'
const PRIVY_TOKEN_PREFIX = 'v1:'

function getPrivyTokenKey(): Buffer {
  const explicit = (process.env.AUTH_HANDOFF_PRIVY_TOKEN_KEY ?? '').trim()
  if (explicit.length >= 32) {
    // Derive a fixed-length 32-byte key from the provided material.
    return createHash('sha256').update(explicit).digest()
  }
  // Fallback: derive from the existing handoff-hash secret. This
  // throws if no secret is configured — correct behaviour, since we
  // must never write plaintext Privy tokens.
  return createHash('sha256').update(`privy-token:${getHandoffHashSecret()}`).digest()
}

export function encryptPrivyToken(token: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(PRIVY_TOKEN_CIPHER, getPrivyTokenKey(), iv)
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PRIVY_TOKEN_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptPrivyToken(stored: string): string | null {
  const trimmed = stored.trim()
  if (!trimmed) return null
  // Backward compatibility: rows written before this migration are
  // plaintext. Surface them unchanged until the next pg_cron purge.
  if (!trimmed.startsWith(PRIVY_TOKEN_PREFIX)) return trimmed
  const parts = trimmed.slice(PRIVY_TOKEN_PREFIX.length).split(':')
  if (parts.length !== 3) return null
  try {
    const iv = Buffer.from(parts[0]!, 'base64')
    const tag = Buffer.from(parts[1]!, 'base64')
    const enc = Buffer.from(parts[2]!, 'base64')
    const decipher = createDecipheriv(PRIVY_TOKEN_CIPHER, getPrivyTokenKey(), iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return null
  }
}

export async function ensureHandoffSchema(db: DbWithSql): Promise<void> {
  if (handoffSchemaEnsured) return
  await ensureAuthNonceHandoffSchema(db as any)
  handoffSchemaEnsured = true
}

export async function createHandoffCode(db: DbWithSql, params: { address: string; privyToken?: string | null; now?: number }): Promise<{ code: string; expiresAt: string }> {
  const nowMs = typeof params.now === 'number' ? params.now : Date.now()
  const code = makeHandoffCode()
  const codeHash = hashHandoffCode(code)
  const expiresAt = new Date(nowMs + HANDOFF_TTL_SECONDS * 1000)
  const rawPrivyToken = typeof params.privyToken === 'string' && params.privyToken.trim() ? params.privyToken.trim() : null
  // M-21: encrypt before writing. Null is passed through as null.
  const storedPrivyToken = rawPrivyToken === null ? null : encryptPrivyToken(rawPrivyToken)

  await db.sql`
    INSERT INTO auth_handoffs (code_hash, address, privy_token, expires_at)
    VALUES (${codeHash}, ${params.address.toLowerCase()}, ${storedPrivyToken}, ${expiresAt.toISOString()})
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
  // M-21: decrypt on read. Rows written before this change are
  // plaintext and decryptPrivyToken returns them unchanged; the
  // two-minute TTL on handoffs means the plaintext window closes
  // very quickly after rollout.
  const storedPrivyToken = row && typeof row.privy_token === 'string' && row.privy_token.trim() ? row.privy_token.trim() : null
  const privyToken = storedPrivyToken ? decryptPrivyToken(storedPrivyToken) : null
  return { address, privyToken }
}
