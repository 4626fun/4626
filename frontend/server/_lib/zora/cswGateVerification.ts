import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createPublicClient, hashMessage, http, recoverMessageAddress, verifyMessage } from 'viem'
import { base } from 'viem/chains'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

declare const process: { env: Record<string, string | undefined> }

let schemaEnsured = false
let schemaEnsuring: Promise<void> | null = null
let challengeSchemaEnsured = false
let challengeSchemaEnsuring: Promise<void> | null = null

// FIX: M-01 — EIP-1271 magic value for smart-wallet signature validation.
const EIP1271_MAGICVALUE = '0x1626ba7e'

const EIP1271_ABI = [
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
  },
] as const

const DEFAULT_BASE_RPCS = [
  'https://base-mainnet.public.blastapi.io',
  'https://base.llamarpc.com',
  'https://mainnet.base.org',
] as const

function normalizeRpcUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (!text.startsWith('http://') && !text.startsWith('https://')) return `https://${text}`
  return text
}

function getBaseRpcUrls(): string[] {
  const raw = (process.env.BASE_RPC_URL ?? '').trim()
  const parts = raw
    ? raw
        .split(/[\s,]+/g)
        .map(normalizeRpcUrl)
        .filter((value): value is string => Boolean(value))
    : []
  const urls = parts.length > 0 ? [...parts, ...DEFAULT_BASE_RPCS] : [...DEFAULT_BASE_RPCS]
  return Array.from(new Set(urls))
}

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

// ---------------------------------------------------------------------------
// FIX: M-01 — Wallet-ownership challenge for /api/zora/csw-entry
//
// Problem: /api/zora/csw-entry previously issued a Telegram verification token
// based only on the presence of a CSW in the imported registry. An attacker
// could submit any registered CSW address (they are public), receive a token,
// and complete Telegram verification with their own Telegram session — binding
// someone else's CSW to the attacker's account.
//
// Fix: gate token issuance behind a challenge-response protocol. A client must:
//   1. POST /api/zora/csw-entry/challenge to receive a one-time nonce scoped
//      to (cswAddress, ttl).
//   2. Sign the canonical challenge message with the CSW (EOA via personal_sign
//      or smart wallet via EIP-1271 isValidSignature).
//   3. POST /api/zora/csw-entry with the signature + nonce. Server verifies the
//      signature against the CSW address (direct + EIP-1271 fallback), then
//      atomically consumes the challenge and issues the Telegram verification
//      token as before.
//
// The challenge table is separate from the verification-token table so the two
// lifecycles don't entangle. Challenges are single-use (unique index on
// challenge_hash PK, atomic DELETE on consume).
// ---------------------------------------------------------------------------

export type CswEntryChallengeRow = {
  challengeHash: string
  cswAddress: `0x${string}`
  expiresAt: string
  createdAt: string
}

const CSW_ENTRY_CHALLENGE_MIN_TTL_SECONDS = 60
const CSW_ENTRY_CHALLENGE_DEFAULT_TTL_SECONDS = 10 * 60
const CSW_ENTRY_CHALLENGE_MAX_TTL_SECONDS = 30 * 60

function mapChallengeRow(row: any): CswEntryChallengeRow {
  return {
    challengeHash: asTrimmed(row?.challenge_hash),
    cswAddress: asTrimmed(row?.csw_address).toLowerCase() as `0x${string}`,
    expiresAt: toIso(row?.expires_at) ?? new Date(0).toISOString(),
    createdAt: toIso(row?.created_at) ?? new Date(0).toISOString(),
  }
}

export async function ensureCswEntryChallengeSchema(db: Db): Promise<void> {
  if (challengeSchemaEnsured) return
  if (challengeSchemaEnsuring) {
    await challengeSchemaEnsuring
    return
  }
  challengeSchemaEnsuring = (async () => {
    await db.sql`
      CREATE TABLE IF NOT EXISTS zora_csw_gate_entry_challenges (
        challenge_hash TEXT PRIMARY KEY,
        csw_address TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS zora_csw_gate_entry_challenges_csw_idx
      ON zora_csw_gate_entry_challenges (csw_address, expires_at DESC);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS zora_csw_gate_entry_challenges_expires_idx
      ON zora_csw_gate_entry_challenges (expires_at);
    `
    await db.sql`ALTER TABLE zora_csw_gate_entry_challenges ENABLE ROW LEVEL SECURITY;`
    await db.sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'zora_csw_gate_entry_challenges'
            AND policyname = 'zora_csw_gate_entry_challenges_deny_all'
        ) THEN
          CREATE POLICY zora_csw_gate_entry_challenges_deny_all
            ON zora_csw_gate_entry_challenges
            FOR ALL
            TO public
            USING (false)
            WITH CHECK (false);
        END IF;
      END
      $$;
    `
    challengeSchemaEnsured = true
  })()
  try {
    await challengeSchemaEnsuring
  } finally {
    challengeSchemaEnsuring = null
  }
}

export function buildCswEntryChallengeMessage(params: {
  cswAddress: `0x${string}`
  nonce: string
  expiresAt: string
}): string {
  // Human-readable, domain-separated challenge text. Exact bytes are part of
  // the security contract — changing them invalidates in-flight challenges.
  return [
    '4626.fun: Zora CSW Telegram linkage proof',
    '',
    `CSW Address: ${params.cswAddress}`,
    `Nonce: ${params.nonce}`,
    `Expires: ${params.expiresAt}`,
    '',
    'Sign this message to prove ownership of the CSW and link it to a Telegram account.',
    'Do NOT sign this message on any site other than 4626.fun.',
  ].join('\n')
}

export async function issueCswEntryChallenge(params: {
  db: Db
  cswAddress: `0x${string}`
  ttlSeconds?: number
}): Promise<{ nonce: string; message: string; expiresAt: string }> {
  const ttlRaw = Number(
    params.ttlSeconds ?? process.env.ZORA_CSW_ENTRY_CHALLENGE_TTL_SECONDS ?? CSW_ENTRY_CHALLENGE_DEFAULT_TTL_SECONDS,
  )
  const ttlSeconds = Math.max(
    CSW_ENTRY_CHALLENGE_MIN_TTL_SECONDS,
    Math.min(
      CSW_ENTRY_CHALLENGE_MAX_TTL_SECONDS,
      Math.floor(Number.isFinite(ttlRaw) ? ttlRaw : CSW_ENTRY_CHALLENGE_DEFAULT_TTL_SECONDS),
    ),
  )

  await ensureCswEntryChallengeSchema(params.db)

  // Remove any outstanding challenges for this CSW so a fresh issue always
  // supersedes prior attempts. Prevents accumulation across retries.
  await params.db.sql`
    DELETE FROM zora_csw_gate_entry_challenges
    WHERE csw_address = ${params.cswAddress};
  `

  const nonce = typeof randomUUID === 'function' ? randomUUID() : randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  const message = buildCswEntryChallengeMessage({ cswAddress: params.cswAddress, nonce, expiresAt })
  const challengeHash = hashToken(`${params.cswAddress}:${nonce}`)

  await params.db.sql`
    INSERT INTO zora_csw_gate_entry_challenges (challenge_hash, csw_address, expires_at)
    VALUES (${challengeHash}, ${params.cswAddress}, ${expiresAt});
  `

  return { nonce, message, expiresAt }
}

/**
 * FIX: M-01 — Atomically consume a CSW entry challenge.
 * Returns ok:true with the mapped row if the challenge was live and is now
 * deleted; ok:false with a typed reason otherwise. The DELETE RETURNING
 * pattern is atomic against concurrent requests.
 */
export async function consumeCswEntryChallenge(params: {
  db: Db
  cswAddress: `0x${string}`
  nonce: string
}): Promise<
  | { ok: true; row: CswEntryChallengeRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'mismatch' }
> {
  const nonce = asTrimmed(params.nonce)
  if (!nonce) return { ok: false, reason: 'invalid' }

  await ensureCswEntryChallengeSchema(params.db)
  const challengeHash = hashToken(`${params.cswAddress}:${nonce}`)

  const consumed = await params.db.sql`
    DELETE FROM zora_csw_gate_entry_challenges
    WHERE challenge_hash = ${challengeHash}
      AND expires_at > NOW()
    RETURNING challenge_hash, csw_address, expires_at, created_at;
  `
  const row = consumed.rows?.[0]
  if (row) {
    const mapped = mapChallengeRow(row)
    if (mapped.cswAddress !== params.cswAddress) {
      // Defense-in-depth: challenge_hash already couples (csw, nonce) but
      // re-check the returned row to catch any hash-collision or rename drift.
      return { ok: false, reason: 'mismatch' }
    }
    return { ok: true, row: mapped }
  }

  // Not found OR expired. Distinguish for better client errors.
  const existing = await params.db.sql`
    SELECT challenge_hash, csw_address, expires_at, created_at
    FROM zora_csw_gate_entry_challenges
    WHERE challenge_hash = ${challengeHash}
    LIMIT 1;
  `
  const existingRow = existing.rows?.[0]
  if (!existingRow) return { ok: false, reason: 'invalid' }
  return { ok: false, reason: 'expired' }
}

export type CswSignatureVerificationResult = {
  ok: boolean
  contractValidated: boolean
  recoveredSigner: `0x${string}` | null
}

/**
 * FIX: M-01 — Verify a signature from a CSW (EOA or ERC-4337 / smart wallet).
 *
 * Strategy:
 *   1. viem.verifyMessage — handles EOA signatures (ecrecover) and, for some
 *      smart-wallet implementations, ERC-1271 as a fallback.
 *   2. If that returns false or throws, explicitly query the contract's
 *      isValidSignature(digest, signature) against multiple Base RPC endpoints
 *      and accept if any returns the EIP-1271 magic value.
 *   3. Separately recover the signer address for telemetry (not for auth).
 *
 * Note: this helper is scoped to Base chain ID 8453. CSWs are Zora canonical
 * smart wallets deployed on Base; cross-chain proofs are out of scope and
 * would require an explicit chainId parameter.
 */
export async function verifyCswWalletSignature(params: {
  cswAddress: `0x${string}`
  message: string
  signature: `0x${string}`
}): Promise<CswSignatureVerificationResult> {
  let recoveredSigner: `0x${string}` | null = null
  try {
    const recovered = await recoverMessageAddress({
      message: params.message,
      signature: params.signature,
    })
    recoveredSigner = recovered.toLowerCase() as `0x${string}`
  } catch {
    recoveredSigner = null
  }

  try {
    const direct = await verifyMessage({
      address: params.cswAddress,
      message: params.message,
      signature: params.signature,
    })
    if (direct) {
      return {
        ok: true,
        contractValidated: false,
        recoveredSigner: recoveredSigner ?? params.cswAddress,
      }
    }
  } catch {
    // Fall through to explicit EIP-1271 validation below.
  }

  const digest = hashMessage(params.message)
  let contractValidated = false
  for (const rpcUrl of getBaseRpcUrls()) {
    try {
      const client = createPublicClient({
        chain: base,
        transport: http(rpcUrl, { timeout: 12_000 }),
      })
      const code = await client.getBytecode({ address: params.cswAddress })
      if (!code || code === '0x') {
        // Not a contract at all — the direct verifyMessage already failed, so
        // this is a genuine signature failure, not an EOA-vs-contract mix-up.
        return { ok: false, contractValidated: false, recoveredSigner }
      }
      const magic = await client.readContract({
        address: params.cswAddress,
        abi: EIP1271_ABI,
        functionName: 'isValidSignature',
        args: [digest, params.signature],
      })
      contractValidated = String(magic).toLowerCase() === EIP1271_MAGICVALUE
      if (contractValidated) {
        return { ok: true, contractValidated: true, recoveredSigner }
      }
      // Contract returned non-magic — signature is invalid per EIP-1271.
      return { ok: false, contractValidated: false, recoveredSigner }
    } catch {
      continue
    }
  }

  return { ok: false, contractValidated, recoveredSigner }
}
