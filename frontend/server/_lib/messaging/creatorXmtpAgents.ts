import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { getAddress } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { getDb, isDbConfigured } from '../db/postgres.js'

declare const process: { env: Record<string, string | undefined> }

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let schemaEnsured = false

function parseAesKeyFromEnv(): Buffer {
  const raw = (process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
  const hex = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
    throw new Error('XMTP_AGENT_KEY_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars, optionally 0x-prefixed)')
  }
  return Buffer.from(hex, 'hex')
}

function encryptPrivateKey(privKeyHex: `0x${string}`, aad: string): { ciphertextB64: string; ivB64: string; tagB64: string } {
  const key = parseAesKeyFromEnv()
  const iv = randomBytes(12) // GCM standard IV length
  const gcmOpts = { authTagLength: 16 } as const
  const cipher = createCipheriv('aes-256-gcm', key, iv, gcmOpts)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const plaintext = Buffer.from(privKeyHex, 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return { ciphertextB64: ciphertext.toString('base64'), ivB64: iv.toString('base64'), tagB64: tag.toString('base64') }
}

export function decryptPrivateKey(params: { ciphertextB64: string; ivB64: string; tagB64: string; aad: string }): `0x${string}` {
  const key = parseAesKeyFromEnv()
  const iv = Buffer.from(params.ivB64, 'base64')
  const tag = Buffer.from(params.tagB64, 'base64')
  const ciphertext = Buffer.from(params.ciphertextB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 })
  decipher.setAAD(Buffer.from(params.aad, 'utf8'))
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  if (!plaintext.startsWith('0x') || plaintext.length < 10) throw new Error('decryption_failed')
  return plaintext as `0x${string}`
}

export async function ensureCreatorXmtpAgentsSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  schemaEnsured = true
  await db.sql`
    CREATE TABLE IF NOT EXISTS creator_xmtp_agents (
      creator_address TEXT PRIMARY KEY,
      xmtp_agent_address TEXT NOT NULL,
      encrypted_private_key_b64 TEXT NOT NULL,
      encrypted_private_key_iv_b64 TEXT NOT NULL,
      encrypted_private_key_tag_b64 TEXT NOT NULL,
      listed_publicly BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `
  await db.sql`CREATE INDEX IF NOT EXISTS creator_xmtp_agents_listed_idx ON creator_xmtp_agents (listed_publicly, created_at DESC);`
  await db.sql`CREATE INDEX IF NOT EXISTS creator_xmtp_agents_updated_idx ON creator_xmtp_agents (updated_at DESC);`

  // Migration: add CSW support columns
  try {
    await db.sql`ALTER TABLE creator_xmtp_agents ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'eoa';`
    await db.sql`ALTER TABLE creator_xmtp_agents ADD COLUMN IF NOT EXISTS privy_wallet_id TEXT;`
    await db.sql`ALTER TABLE creator_xmtp_agents ADD COLUMN IF NOT EXISTS csw_address TEXT;`
    await db.sql`ALTER TABLE creator_xmtp_agents ADD COLUMN IF NOT EXISTS last_processed_message_at TIMESTAMPTZ;`
  } catch {
    // Columns may already exist
  }
}

export type AgentType = 'eoa' | 'csw'

export type CreatorXmtpAgentRow = {
  creatorAddress: `0x${string}`
  xmtpAgentAddress: `0x${string}`
  agentType: AgentType
  privyWalletId: string | null
  cswAddress: `0x${string}` | null
  listedPublicly: boolean
  createdAt: string
  updatedAt: string
}

function normalizeRow(row: any): CreatorXmtpAgentRow | null {
  const creatorRaw = String(row?.creator_address ?? '').trim()
  const agentRaw = String(row?.xmtp_agent_address ?? '').trim()
  if (!creatorRaw || !agentRaw) return null
  const creatorAddress = getAddress(creatorRaw).toLowerCase() as `0x${string}`
  const xmtpAgentAddress = getAddress(agentRaw).toLowerCase() as `0x${string}`
  const agentType = (String(row?.agent_type ?? 'eoa').toLowerCase()) as AgentType
  const privyWalletId = row?.privy_wallet_id ? String(row.privy_wallet_id).trim() : null
  const cswRaw = row?.csw_address ? String(row.csw_address).trim() : null
  const cswAddress = cswRaw && /^0x[a-fA-F0-9]{40}$/.test(cswRaw)
    ? getAddress(cswRaw).toLowerCase() as `0x${string}`
    : null
  const listedPublicly = Boolean(row?.listed_publicly)
  const createdAt = row?.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  return { creatorAddress, xmtpAgentAddress, agentType, privyWalletId, cswAddress, listedPublicly, createdAt, updatedAt }
}

export async function getOrCreateCreatorXmtpAgent(params: {
  creatorAddress: `0x${string}`
  listedPublicly?: boolean
}): Promise<CreatorXmtpAgentRow> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = (await getDb()) as unknown as Db | null
  if (!db) throw new Error('db_not_configured')
  await ensureCreatorXmtpAgentsSchema(db)

  const creator = getAddress(params.creatorAddress).toLowerCase()
  const listed = typeof params.listedPublicly === 'boolean' ? params.listedPublicly : true

  const existing = await db.sql`
    SELECT creator_address, xmtp_agent_address, listed_publicly, created_at, updated_at
    FROM creator_xmtp_agents
    WHERE LOWER(creator_address) = ${creator}
    LIMIT 1;
  `
  if (existing.rows && existing.rows.length > 0) {
    const cur = normalizeRow(existing.rows[0])
    if (!cur) throw new Error('invalid_row')
    if (typeof params.listedPublicly === 'boolean' && cur.listedPublicly !== listed) {
      await db.sql`
        UPDATE creator_xmtp_agents
        SET listed_publicly = ${listed}, updated_at = NOW()
        WHERE LOWER(creator_address) = ${creator};
      `
      cur.listedPublicly = listed
      cur.updatedAt = new Date().toISOString()
    }
    return cur
  }

  // Generate a new EOA (XMTP identity wallet).
  const priv = generatePrivateKey()
  const account = privateKeyToAccount(priv)
  const xmtpAgentAddress = getAddress(account.address).toLowerCase() as `0x${string}`

  // Encrypt the private key for storage.
  const enc = encryptPrivateKey(priv, `creator:${creator}`)

  await db.sql`
    INSERT INTO creator_xmtp_agents (
      creator_address,
      xmtp_agent_address,
      encrypted_private_key_b64,
      encrypted_private_key_iv_b64,
      encrypted_private_key_tag_b64,
      listed_publicly,
      created_at,
      updated_at
    )
    VALUES (
      ${creator},
      ${xmtpAgentAddress},
      ${enc.ciphertextB64},
      ${enc.ivB64},
      ${enc.tagB64},
      ${listed},
      NOW(),
      NOW()
    )
    ON CONFLICT (creator_address)
    DO UPDATE SET
      xmtp_agent_address = EXCLUDED.xmtp_agent_address,
      encrypted_private_key_b64 = EXCLUDED.encrypted_private_key_b64,
      encrypted_private_key_iv_b64 = EXCLUDED.encrypted_private_key_iv_b64,
      encrypted_private_key_tag_b64 = EXCLUDED.encrypted_private_key_tag_b64,
      listed_publicly = EXCLUDED.listed_publicly,
      updated_at = NOW();
  `

  return {
    creatorAddress: creator as `0x${string}`,
    xmtpAgentAddress,
    agentType: 'eoa' as AgentType,
    privyWalletId: null,
    cswAddress: null,
    listedPublicly: listed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Enable a CSW-based XMTP agent for a creator.
 * Instead of generating a new EOA, this uses the creator's existing
 * Coinbase Smart Wallet as the XMTP identity.
 *
 * The Privy wallet ID is used server-side to sign XMTP messages
 * on behalf of the CSW.
 */
export async function enableCswAgent(params: {
  creatorAddress: `0x${string}`
  cswAddress: `0x${string}`
  privyWalletId: string
  listedPublicly?: boolean
}): Promise<CreatorXmtpAgentRow> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = (await getDb()) as unknown as Db | null
  if (!db) throw new Error('db_not_configured')
  await ensureCreatorXmtpAgentsSchema(db)

  const creator = getAddress(params.creatorAddress).toLowerCase()
  const cswAddr = getAddress(params.cswAddress).toLowerCase()
  const listed = typeof params.listedPublicly === 'boolean' ? params.listedPublicly : true

  // For CSW agents, the XMTP agent address IS the CSW address.
  // We store dummy encrypted key values since signing happens via Privy API.
  await db.sql`
    INSERT INTO creator_xmtp_agents (
      creator_address,
      xmtp_agent_address,
      encrypted_private_key_b64,
      encrypted_private_key_iv_b64,
      encrypted_private_key_tag_b64,
      agent_type,
      privy_wallet_id,
      csw_address,
      listed_publicly,
      created_at,
      updated_at
    )
    VALUES (
      ${creator},
      ${cswAddr},
      ${'csw-managed'},
      ${'csw-managed'},
      ${'csw-managed'},
      ${'csw'},
      ${params.privyWalletId},
      ${cswAddr},
      ${listed},
      NOW(),
      NOW()
    )
    ON CONFLICT (creator_address)
    DO UPDATE SET
      xmtp_agent_address = EXCLUDED.xmtp_agent_address,
      encrypted_private_key_b64 = EXCLUDED.encrypted_private_key_b64,
      encrypted_private_key_iv_b64 = EXCLUDED.encrypted_private_key_iv_b64,
      encrypted_private_key_tag_b64 = EXCLUDED.encrypted_private_key_tag_b64,
      agent_type = EXCLUDED.agent_type,
      privy_wallet_id = EXCLUDED.privy_wallet_id,
      csw_address = EXCLUDED.csw_address,
      listed_publicly = EXCLUDED.listed_publicly,
      updated_at = NOW();
  `

  return {
    creatorAddress: creator as `0x${string}`,
    xmtpAgentAddress: cswAddr as `0x${string}`,
    agentType: 'csw',
    privyWalletId: params.privyWalletId,
    cswAddress: cswAddr as `0x${string}`,
    listedPublicly: listed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function listCreatorXmtpAgents(params: {
  listedOnly?: boolean
  limit: number
  cursor?: { createdAt: string; creatorAddress: `0x${string}` }
  creatorAddress?: `0x${string}`
}): Promise<{ rows: CreatorXmtpAgentRow[]; nextCursor: { createdAt: string; creatorAddress: `0x${string}` } | null }> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  const db = (await getDb()) as unknown as Db | null
  if (!db) throw new Error('db_not_configured')
  await ensureCreatorXmtpAgentsSchema(db)

  const limit = Math.max(1, Math.min(200, Math.floor(params.limit)))
  const listedOnly = params.listedOnly ?? true
  const creatorFilter = params.creatorAddress ? getAddress(params.creatorAddress).toLowerCase() : null

  // Keyset pagination on (created_at DESC, creator_address DESC) for stability.
  // Cursor represents the last item from previous page.
  const cursorCreatedAt = params.cursor?.createdAt ? new Date(params.cursor.createdAt).toISOString() : null
  const cursorCreator = params.cursor?.creatorAddress ? getAddress(params.cursor.creatorAddress).toLowerCase() : null

  const q =
    creatorFilter
      ? await db.sql`
          SELECT creator_address, xmtp_agent_address, agent_type, privy_wallet_id, csw_address,
                 listed_publicly, created_at, updated_at
          FROM creator_xmtp_agents
          WHERE (${listedOnly} = FALSE OR listed_publicly = TRUE)
            AND LOWER(creator_address) = ${creatorFilter}
          ORDER BY created_at DESC, creator_address DESC
          LIMIT ${limit};
        `
      : cursorCreatedAt && cursorCreator
      ? await db.sql`
          SELECT creator_address, xmtp_agent_address, agent_type, privy_wallet_id, csw_address,
                 listed_publicly, created_at, updated_at
          FROM creator_xmtp_agents
          WHERE (${listedOnly} = FALSE OR listed_publicly = TRUE)
            AND (created_at, creator_address) < (${cursorCreatedAt}::timestamptz, ${cursorCreator})
          ORDER BY created_at DESC, creator_address DESC
          LIMIT ${limit};
        `
      : await db.sql`
          SELECT creator_address, xmtp_agent_address, agent_type, privy_wallet_id, csw_address,
                 listed_publicly, created_at, updated_at
          FROM creator_xmtp_agents
          WHERE (${listedOnly} = FALSE OR listed_publicly = TRUE)
          ORDER BY created_at DESC, creator_address DESC
          LIMIT ${limit};
        `

  const out: CreatorXmtpAgentRow[] = []
  for (const r of q.rows ?? []) {
    const n = normalizeRow(r)
    if (n) out.push(n)
  }

  const last = out.length > 0 ? out[out.length - 1] : null
  const nextCursor = last ? { createdAt: last.createdAt, creatorAddress: last.creatorAddress } : null
  return { rows: out, nextCursor }
}
