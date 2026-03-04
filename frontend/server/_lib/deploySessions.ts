import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

import { getDb, isDbConfigured } from './postgres.js'

declare const process: { env: Record<string, string | undefined> }

export type DeploySessionStep =
  | 'created'
  | 'phase1_sent'
  | 'phase1_confirmed'
  | 'phase1_finalize_sent'
  | 'phase1_finalize_confirmed'
  | 'phase2_core_sent'
  | 'phase2_core_confirmed'
  | 'phase2_sent'
  | 'phase2_confirmed'
  | 'ovault_mesh_sent'
  | 'ovault_mesh_confirmed'
  | 'phase3_sent'
  | 'phase3_confirmed'
  | 'phase4_sent'
  | 'phase4_confirmed'
  | 'cleanup_sent'
  | 'cancelled'
  | 'completed'
  | 'failed'

export type DeploySessionRecord = {
  id: string
  tokenHash: string
  sessionAddress: `0x${string}`
  smartWallet: `0x${string}`
  sessionSigner: `0x${string}`
  deployToken: string
  sessionSignerKeyEnc: string | null
  payload: any
  step: DeploySessionStep
  expiresAt: string
  createdAt: string
  updatedAt: string
  lastError: string | null
  lastUserOpHash: string | null
  lastTxHash: string | null
}

let deploySessionsSchemaEnsured = false

export async function ensureDeploySessionsSchema(): Promise<void> {
  if (!isDbConfigured()) return
  const db = await getDb()
  if (!db) return
  if (deploySessionsSchemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS deploys (
        id TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        session_address TEXT NOT NULL,
        smart_wallet TEXT NOT NULL,
        session_owner TEXT NOT NULL,
        deploy_token TEXT NOT NULL,
        session_owner_key_enc TEXT NOT NULL,
        session_signer TEXT,
        session_signer_key_enc TEXT,
        payload JSONB NOT NULL,
        step TEXT NOT NULL DEFAULT 'created',
        last_error TEXT,
        last_userop_hash TEXT,
        last_tx_hash TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    await db.sql`CREATE INDEX IF NOT EXISTS deploys_sender_idx ON deploys (smart_wallet);`
    await db.sql`CREATE INDEX IF NOT EXISTS deploys_session_address_idx ON deploys (session_address);`
    await db.sql`CREATE INDEX IF NOT EXISTS deploys_step_idx ON deploys (step);`
    await db.sql`CREATE INDEX IF NOT EXISTS deploys_expires_idx ON deploys (expires_at);`
    try {
      // Remove historical duplicate index name.
      await db.sql`DROP INDEX IF EXISTS deploy_sessions_session_address_idx;`
    } catch {
      // ignore (already dropped or insufficient permissions)
    }

    // Schema evolution (non-breaking):
    // - New Privy agent-wallet sessions do not store raw private keys.
    // - Older deploy sessions may still have `session_owner_key_enc` set.
    try {
      await db.sql`ALTER TABLE deploys ALTER COLUMN session_owner_key_enc DROP NOT NULL;`
    } catch {
      // ignore (already altered or insufficient permissions)
    }
    try {
      await db.sql`ALTER TABLE deploys ADD COLUMN IF NOT EXISTS session_signer TEXT;`
    } catch {
      // ignore (already exists or insufficient permissions)
    }
    try {
      await db.sql`ALTER TABLE deploys ADD COLUMN IF NOT EXISTS session_signer_key_enc TEXT;`
    } catch {
      // ignore (already exists or insufficient permissions)
    }
    try {
      await db.sql`
        UPDATE deploys
        SET
          session_signer = COALESCE(NULLIF(session_signer, ''), session_owner),
          session_signer_key_enc = COALESCE(session_signer_key_enc, session_owner_key_enc)
        WHERE
          session_signer IS NULL
          OR session_signer = ''
          OR session_signer_key_enc IS NULL;
      `
    } catch {
      // ignore when migration columns are unavailable
    }
    deploySessionsSchemaEnsured = true
  } catch (err) {
    deploySessionsSchemaEnsured = false
    throw err
  }
}

let _deploySecretKey: Buffer | null = null
function requireDeploySecret(): Buffer {
  if (_deploySecretKey) return _deploySecretKey
  const raw = (process.env.DEPLOY_SESSION_SECRET ?? '').trim()
  if (!raw) throw new Error('DEPLOY_SESSION_SECRET missing')
  // Derive a fixed 32-byte key from the secret.
  _deploySecretKey = createHash('sha256').update(raw, 'utf8').digest()
  return _deploySecretKey
}

function encryptWithSecret(plaintext: string): string {
  const key = requireDeploySecret()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  // v1:<iv>:<tag>:<ct> (base64url)
  const b64u = (b: Buffer) => b.toString('base64url')
  return `v1:${b64u(iv)}:${b64u(tag)}:${b64u(ct)}`
}

export function decryptWithSecret(enc: string): string {
  const key = requireDeploySecret()
  const parts = String(enc).split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('invalid_encryption_format')
  const iv = Buffer.from(parts[1], 'base64url')
  const tag = Buffer.from(parts[2], 'base64url')
  const ct = Buffer.from(parts[3], 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

export function randomId(prefix = 'ds_'): string {
  return `${prefix}${randomBytes(16).toString('hex')}`
}

export function randomDeployToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashDeployToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function signDeployToken(token: string): string {
  const raw = (process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET ?? '').trim()
  if (!raw) throw new Error('DEPLOY_SESSION_TOKEN_HMAC_SECRET missing')
  return createHmac('sha256', raw).update(token, 'utf8').digest('hex')
}

export async function insertDeploySession(params: {
  id: string
  tokenHash: string
  sessionAddress: string
  smartWallet: string
  sessionSigner: string
  deployToken: string
  sessionSignerPrivateKey?: string | null
  payload: any
  expiresAt: Date
}): Promise<DeploySessionRecord> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()

  const sessionSignerKeyEnc =
    typeof params.sessionSignerPrivateKey === 'string' && params.sessionSignerPrivateKey.trim().length > 0
      ? encryptWithSecret(params.sessionSignerPrivateKey)
      : null
  const payloadJson = params.payload ?? {}

  await db.sql`
    INSERT INTO deploys (
      id,
      token_hash,
      session_address,
      smart_wallet,
      session_owner,
      deploy_token,
      session_owner_key_enc,
      payload,
      step,
      expires_at
    ) VALUES (
      ${params.id},
      ${params.tokenHash},
      ${String(params.sessionAddress).toLowerCase()},
      ${String(params.smartWallet).toLowerCase()},
      ${String(params.sessionSigner).toLowerCase()},
      ${params.deployToken},
      ${sessionSignerKeyEnc},
      ${payloadJson},
      ${'created'},
      ${params.expiresAt.toISOString()}
    );
  `
  // Best-effort dual-write for non-breaking migration to canonical `session_signer*` columns.
  try {
    await db.sql`
      UPDATE deploys
      SET
        session_signer = ${String(params.sessionSigner).toLowerCase()},
        session_signer_key_enc = ${sessionSignerKeyEnc}
      WHERE id = ${params.id};
    `
  } catch {
    // ignore when migration columns are unavailable
  }

  const rec = await getDeploySessionById(params.id)
  if (!rec) throw new Error('deploy_session_create_failed')
  return rec
}

export async function getDeploySessionById(id: string): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const res = await db.sql`SELECT * FROM deploys WHERE id = ${id} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function getDeploySessionByTokenHash(tokenHash: string): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const res = await db.sql`SELECT * FROM deploys WHERE token_hash = ${tokenHash} LIMIT 1;`
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function getActiveDeploySessionForSender(params: {
  sessionAddress: string
  smartWallet: string
  /**
   * Allow selecting a session even if it is expired.
   * Intended for cleanup-only flows (removing the temporary owner).
   */
  includeExpired?: boolean
  /**
   * Allow selecting a session even if it is in the `failed` step.
   * Intended for cleanup-only flows (removing the temporary owner).
   */
  includeFailed?: boolean
}): Promise<DeploySessionRecord | null> {
  const db = await getDb()
  if (!db) return null
  await ensureDeploySessionsSchema()
  const includeExpired = params.includeExpired === true
  const includeFailed = params.includeFailed === true
  // NOTE: Avoid nested `db.sql` fragments here.
  // - `@vercel/postgres` supports flexible interpolation, but our `pg` fallback implements a minimal
  //   template-to-parameter conversion and treats interpolated fragments as values (→ `step $3` syntax errors).
  const sessionAddress = String(params.sessionAddress).toLowerCase()
  const smartWallet = String(params.smartWallet).toLowerCase()
  const res = includeExpired
    ? includeFailed
      ? await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step != 'completed'
          ORDER BY created_at DESC
          LIMIT 1;
        `
      : await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step NOT IN ('completed', 'failed')
          ORDER BY created_at DESC
          LIMIT 1;
        `
    : includeFailed
      ? await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step != 'completed'
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `
      : await db.sql`
          SELECT * FROM deploys
          WHERE session_address = ${sessionAddress}
            AND smart_wallet = ${smartWallet}
            AND step NOT IN ('completed', 'failed')
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1;
        `
  const row = (res.rows?.[0] ?? null) as any
  return row ? mapRow(row) : null
}

export async function updateDeploySession(params: {
  id: string
  step?: DeploySessionStep
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  payloadPatch?: any
}): Promise<void> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()
  const hasStep = Object.prototype.hasOwnProperty.call(params, 'step')
  const hasLastError = Object.prototype.hasOwnProperty.call(params, 'lastError')
  const hasLastUserOpHash = Object.prototype.hasOwnProperty.call(params, 'lastUserOpHash')
  const hasLastTxHash = Object.prototype.hasOwnProperty.call(params, 'lastTxHash')

  const patch = params.payloadPatch
  if (patch && typeof patch === 'object') {
    // Merge JSONB (right-biased).
    await db.sql`
      UPDATE deploys
      SET
        payload = COALESCE(payload, '{}'::jsonb) || ${patch},
        step = CASE WHEN ${hasStep} THEN ${params.step ?? null} ELSE step END,
        last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
        last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
        last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
        updated_at = NOW()
      WHERE id = ${params.id};
    `
    return
  }

  await db.sql`
    UPDATE deploys
    SET
      step = CASE WHEN ${hasStep} THEN ${params.step ?? null} ELSE step END,
      last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
      last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
      last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
      updated_at = NOW()
    WHERE id = ${params.id};
  `
}

export async function transitionDeploySession(params: {
  id: string
  fromStep: DeploySessionStep
  toStep: DeploySessionStep
  lastError?: string | null
  lastUserOpHash?: string | null
  lastTxHash?: string | null
  payloadPatch?: any
}): Promise<boolean> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureDeploySessionsSchema()
  const hasLastError = Object.prototype.hasOwnProperty.call(params, 'lastError')
  const hasLastUserOpHash = Object.prototype.hasOwnProperty.call(params, 'lastUserOpHash')
  const hasLastTxHash = Object.prototype.hasOwnProperty.call(params, 'lastTxHash')

  const patch = params.payloadPatch
  const result =
    patch && typeof patch === 'object'
      ? await db.sql`
          UPDATE deploys
          SET
            payload = COALESCE(payload, '{}'::jsonb) || ${patch},
            step = ${params.toStep},
            last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
            last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
            last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
            updated_at = NOW()
          WHERE id = ${params.id}
            AND step = ${params.fromStep}
          RETURNING id;
        `
      : await db.sql`
          UPDATE deploys
          SET
            step = ${params.toStep},
            last_error = CASE WHEN ${hasLastError} THEN ${params.lastError ?? null} ELSE last_error END,
            last_userop_hash = CASE WHEN ${hasLastUserOpHash} THEN ${params.lastUserOpHash ?? null} ELSE last_userop_hash END,
            last_tx_hash = CASE WHEN ${hasLastTxHash} THEN ${params.lastTxHash ?? null} ELSE last_tx_hash END,
            updated_at = NOW()
          WHERE id = ${params.id}
            AND step = ${params.fromStep}
          RETURNING id;
        `

  return Array.isArray(result.rows) && result.rows.length > 0
}

function mapRow(r: any): DeploySessionRecord {
  const sessionSigner =
    (typeof r.session_signer === 'string' && r.session_signer.trim() ? r.session_signer : r.session_owner) ??
    r.session_owner
  const sessionSignerKeyEnc =
    (typeof r.session_signer_key_enc === 'string' && r.session_signer_key_enc.trim()
      ? r.session_signer_key_enc
      : r.session_owner_key_enc) ?? null
  return {
    id: String(r.id),
    tokenHash: String(r.token_hash),
    sessionAddress: String(r.session_address).toLowerCase() as `0x${string}`,
    smartWallet: String(r.smart_wallet).toLowerCase() as `0x${string}`,
    sessionSigner: String(sessionSigner).toLowerCase() as `0x${string}`,
    deployToken: String(r.deploy_token),
    sessionSignerKeyEnc: sessionSignerKeyEnc ? String(sessionSignerKeyEnc) : null,
    payload: r.payload,
    step: String(r.step) as DeploySessionStep,
    expiresAt: new Date(r.expires_at).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
    lastError: r.last_error ? String(r.last_error) : null,
    lastUserOpHash: r.last_userop_hash ? String(r.last_userop_hash) : null,
    lastTxHash: r.last_tx_hash ? String(r.last_tx_hash) : null,
  }
}
