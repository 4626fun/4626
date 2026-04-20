import { createHash, randomBytes } from 'node:crypto'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

declare const process: { env: Record<string, string | undefined> }

let schemaEnsured = false
let schemaEnsuring: Promise<void> | null = null

export type ZoraCswGateVerifyTokenRow = {
  tokenHash: string
  cswAddress: `0x${string}`
  requestedTelegramUsername: string | null
  sourceUrl: string | null
  expiresAt: string
  consumedAt: string | null
  consumedTelegramUserId: string | null
  consumedTelegramUsername: string | null
  createdAt: string
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toIso(value: unknown): string | null {
  if (!value) return null
  const d = new Date(String(value))
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

function mapRow(row: any): ZoraCswGateVerifyTokenRow {
  return {
    tokenHash: asTrimmed(row?.token_hash),
    cswAddress: asTrimmed(row?.csw_address).toLowerCase() as `0x${string}`,
    requestedTelegramUsername: asTrimmed(row?.requested_telegram_username).toLowerCase() || null,
    sourceUrl: asTrimmed(row?.source_url) || null,
    expiresAt: toIso(row?.expires_at) ?? new Date(0).toISOString(),
    consumedAt: toIso(row?.consumed_at),
    consumedTelegramUserId: asTrimmed(row?.consumed_telegram_user_id) || null,
    consumedTelegramUsername: asTrimmed(row?.consumed_telegram_username).toLowerCase() || null,
    createdAt: toIso(row?.created_at) ?? new Date(0).toISOString(),
  }
}

export async function ensureZoraCswGateVerificationSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  if (schemaEnsuring) {
    await schemaEnsuring
    return
  }
  schemaEnsuring = (async () => {
    await db.sql`
      CREATE TABLE IF NOT EXISTS zora_csw_gate_telegram_tokens (
        token_hash TEXT PRIMARY KEY,
        csw_address TEXT NOT NULL,
        requested_telegram_username TEXT NULL,
        source_url TEXT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ NULL,
        consumed_telegram_user_id TEXT NULL,
        consumed_telegram_username TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS zora_csw_gate_telegram_tokens_csw_idx
      ON zora_csw_gate_telegram_tokens (csw_address, expires_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS zora_csw_gate_telegram_tokens_expires_idx
      ON zora_csw_gate_telegram_tokens (expires_at);
    `
    await db.sql`ALTER TABLE zora_csw_gate_telegram_tokens ENABLE ROW LEVEL SECURITY;`
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'zora_csw_gate_telegram_tokens'
            AND policyname = 'zora_csw_gate_telegram_tokens_deny_all'
        ) THEN
          CREATE POLICY zora_csw_gate_telegram_tokens_deny_all
            ON zora_csw_gate_telegram_tokens
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `
    schemaEnsured = true
  })()
  try {
    await schemaEnsuring
  } finally {
    schemaEnsuring = null
  }
}

export async function issueZoraCswGateVerificationToken(params: {
  db: Db
  cswAddress: `0x${string}`
  requestedTelegramUsername?: string | null
  sourceUrl?: string | null
  ttlSeconds?: number
}): Promise<{ token: string; tokenHash: string; expiresAt: string }> {
  const ttlRaw = Number(params.ttlSeconds ?? process.env.ZORA_CSW_TELEGRAM_VERIFY_TTL_SECONDS ?? 60 * 15)
  const ttlSeconds = Math.max(60, Math.min(60 * 60, Math.floor(Number.isFinite(ttlRaw) ? ttlRaw : 60 * 15)))

  await ensureZoraCswGateVerificationSchema(params.db)

  const token = randomBytes(24).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()

  await params.db.sql`
    DELETE FROM zora_csw_gate_telegram_tokens
    WHERE csw_address = ${params.cswAddress}
      AND consumed_at IS NULL;
  `

  await params.db.sql`
    INSERT INTO zora_csw_gate_telegram_tokens (
      token_hash,
      csw_address,
      requested_telegram_username,
      source_url,
      expires_at
    )
    VALUES (
      ${tokenHash},
      ${params.cswAddress},
      ${params.requestedTelegramUsername ?? null},
      ${params.sourceUrl ?? null},
      ${expiresAt}
    );
  `

  return { token, tokenHash, expiresAt }
}

export async function readZoraCswGateVerificationToken(params: {
  db: Db
  token: string
}): Promise<ZoraCswGateVerifyTokenRow | null> {
  const token = asTrimmed(params.token)
  if (!token) return null
  await ensureZoraCswGateVerificationSchema(params.db)
  const tokenHash = hashToken(token)
  const result = await params.db.sql`
    SELECT token_hash, csw_address, requested_telegram_username, source_url, expires_at,
           consumed_at, consumed_telegram_user_id, consumed_telegram_username, created_at
    FROM zora_csw_gate_telegram_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const row = result.rows?.[0]
  return row ? mapRow(row) : null
}

export async function consumeZoraCswGateVerificationToken(params: {
  db: Db
  token: string
  telegramUserId: string
  telegramUsername: string | null
}): Promise<
  | { ok: true; row: ZoraCswGateVerifyTokenRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'consumed'; row?: ZoraCswGateVerifyTokenRow }
> {
  const token = asTrimmed(params.token)
  const telegramUserId = asTrimmed(params.telegramUserId)
  if (!token || !telegramUserId) return { ok: false, reason: 'invalid' }

  await ensureZoraCswGateVerificationSchema(params.db)
  const tokenHash = hashToken(token)

  const consumed = await params.db.sql`
    UPDATE zora_csw_gate_telegram_tokens
    SET consumed_at = NOW(),
        consumed_telegram_user_id = ${telegramUserId},
        consumed_telegram_username = ${params.telegramUsername ?? null}
    WHERE token_hash = ${tokenHash}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    RETURNING token_hash, csw_address, requested_telegram_username, source_url, expires_at,
              consumed_at, consumed_telegram_user_id, consumed_telegram_username, created_at;
  `
  const row = consumed.rows?.[0]
  if (row) {
    return { ok: true, row: mapRow(row) }
  }

  const existing = await params.db.sql`
    SELECT token_hash, csw_address, requested_telegram_username, source_url, expires_at,
           consumed_at, consumed_telegram_user_id, consumed_telegram_username, created_at
    FROM zora_csw_gate_telegram_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1;
  `
  const existingRow = existing.rows?.[0]
  if (!existingRow) return { ok: false, reason: 'invalid' }

  const mapped = mapRow(existingRow)
  if (mapped.consumedAt) return { ok: false, reason: 'consumed', row: mapped }
  const expiresAtMs = Date.parse(mapped.expiresAt)
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    return { ok: false, reason: 'expired', row: mapped }
  }
  return { ok: false, reason: 'invalid', row: mapped }
}
