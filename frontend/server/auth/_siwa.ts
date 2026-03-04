import type { VercelRequest } from '@vercel/node'

import { createReceipt, parseSIWAMessage, type ReceiptPayload, resolveReceiptSecret, verifyReceipt } from '@buildersgarden/siwa'

declare const process: { env: Record<string, string | undefined> }

type DbWithSql = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

let siwaNonceSchemaEnsured = false
let cachedReceiptSecret: string | null | undefined

export function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function parseAgentRegistryRef(value: string): { chainId: number; registryAddress: string } | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^eip155:(\d+):(0x[a-fA-F0-9]{40})$/)
  if (!match) return null
  const chainId = Number(match[1])
  if (!Number.isFinite(chainId) || chainId <= 0) return null
  return { chainId: Math.floor(chainId), registryAddress: match[2].toLowerCase() }
}

export function parseSiwaMessageSafe(message: string) {
  try {
    return parseSIWAMessage(message)
  } catch {
    return null
  }
}

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

export function readSiwaReceiptFromRequest(req: VercelRequest): string | null {
  const receiptHeader = firstHeaderValue(req.headers?.['x-siwa-receipt'])
  if (receiptHeader) return receiptHeader

  const authHeader = firstHeaderValue(req.headers?.authorization)
  if (!authHeader) return null
  const lower = authHeader.toLowerCase()
  if (lower.startsWith('siwa ')) {
    const token = authHeader.slice('siwa '.length).trim()
    return token || null
  }
  if (lower.startsWith('siwa-receipt ')) {
    const token = authHeader.slice('siwa-receipt '.length).trim()
    return token || null
  }
  return null
}

export function getSiwaReceiptSecret(): string | null {
  if (cachedReceiptSecret !== undefined) return cachedReceiptSecret
  try {
    cachedReceiptSecret = resolveReceiptSecret()
    return cachedReceiptSecret
  } catch {
    const fallback = (process.env.AUTH_SESSION_SECRET ?? '').trim()
    cachedReceiptSecret = fallback.length >= 16 ? fallback : null
    return cachedReceiptSecret
  }
}

export function readSiwaAgentFromRequest(req: VercelRequest): ReceiptPayload | null {
  const receipt = readSiwaReceiptFromRequest(req)
  if (!receipt) return null
  const secret = getSiwaReceiptSecret()
  if (!secret) return null
  return verifyReceipt(receipt, secret)
}

export function createSiwaReceiptToken(payload: Omit<ReceiptPayload, 'iat' | 'exp'>, opts: { ttlMs?: number } = {}) {
  const secret = getSiwaReceiptSecret()
  if (!secret) return null
  const ttlMs = typeof opts.ttlMs === 'number' && Number.isFinite(opts.ttlMs)
    ? Math.max(30_000, Math.floor(opts.ttlMs))
    : undefined
  return createReceipt(payload, { secret, ...(ttlMs ? { ttl: ttlMs } : null) })
}

export async function ensureSiwaNonceSchema(db: DbWithSql): Promise<void> {
  if (siwaNonceSchemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS auth_agent_nonces (
        nonce TEXT PRIMARY KEY,
        agent_id BIGINT NOT NULL,
        agent_registry TEXT NOT NULL,
        owner_address TEXT NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_by_address TEXT
      );
    `
    try {
      await db.sql`ALTER TABLE auth_agent_nonces ENABLE ROW LEVEL SECURITY;`
    } catch {
      // Ignore if RLS cannot be enabled in this runtime.
    }
    try {
      await db.sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'auth_agent_nonces'
              AND policyname = 'auth_agent_nonces_deny_all'
          ) THEN
            CREATE POLICY auth_agent_nonces_deny_all
              ON auth_agent_nonces
              FOR ALL
              TO public
              USING (false)
              WITH CHECK (false);
          END IF;
        END
        $$;
      `
    } catch {
      // Ignore if policy creation is unavailable in this runtime.
    }
    await db.sql`CREATE INDEX IF NOT EXISTS auth_agent_nonces_expires_idx ON auth_agent_nonces (expires_at);`
    await db.sql`
      CREATE INDEX IF NOT EXISTS auth_agent_nonces_lookup_idx
      ON auth_agent_nonces (nonce, agent_id, agent_registry, consumed_at, expires_at);
    `
    siwaNonceSchemaEnsured = true
  } catch (err) {
    siwaNonceSchemaEnsured = false
    throw err
  }
}

export async function storeSiwaNonce(
  db: DbWithSql,
  params: {
    nonce: string
    agentId: number
    agentRegistry: string
    ownerAddress: string
    expiresAt: Date
    createdByAddress?: string | null
  },
): Promise<void> {
  await db.sql`
    INSERT INTO auth_agent_nonces (
      nonce,
      agent_id,
      agent_registry,
      owner_address,
      expires_at,
      created_by_address
    )
    VALUES (
      ${params.nonce},
      ${params.agentId},
      ${params.agentRegistry.toLowerCase()},
      ${params.ownerAddress.toLowerCase()},
      ${params.expiresAt.toISOString()},
      ${params.createdByAddress ? params.createdByAddress.toLowerCase() : null}
    )
    ON CONFLICT (nonce)
    DO UPDATE SET
      agent_id = EXCLUDED.agent_id,
      agent_registry = EXCLUDED.agent_registry,
      owner_address = EXCLUDED.owner_address,
      expires_at = EXCLUDED.expires_at,
      created_by_address = EXCLUDED.created_by_address,
      consumed_at = NULL;
  `
}

export async function consumeSiwaNonce(
  db: DbWithSql,
  params: { nonce: string; agentId: number; agentRegistry: string },
): Promise<{ ownerAddress: string } | null> {
  const result = await db.sql`
    UPDATE auth_agent_nonces
    SET consumed_at = NOW()
    WHERE nonce = ${params.nonce}
      AND agent_id = ${params.agentId}
      AND LOWER(agent_registry) = ${params.agentRegistry.toLowerCase()}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING owner_address;
  `
  const ownerAddress = typeof result.rows?.[0]?.owner_address === 'string'
    ? String(result.rows[0].owner_address).toLowerCase()
    : ''
  return ownerAddress ? { ownerAddress } : null
}
