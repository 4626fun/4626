import { createDecipheriv } from 'node:crypto'
import { getAddress } from 'viem'

import { getDb, isDbConfigured } from '../db/postgres.js'
import { ensureTelemetryCreativeLogsSchema } from '../db/schemaBootstrap.js'
import { resolveCanonicalSmartWalletAddress } from '../wallet/canonicalWalletResolver.js'

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

function encryptPrivateKey(_privKeyHex: `0x${string}`, _aad: string): never {
  throw new Error('legacy_eoa_xmtp_retired: use enableCswAgent with the creator CSW + delegated Privy signer')
}

export function decryptPrivateKey(params: { ciphertextB64: string; ivB64: string; tagB64: string; aad: string }): `0x${string}` {
  if (
    params.ciphertextB64 === 'csw-managed' ||
    params.ivB64 === 'csw-managed' ||
    params.tagB64 === 'csw-managed'
  ) {
    throw new Error(
      'legacy_eoa_xmtp_retired: CSW agents sign via Privy delegated owner, not encrypted EOA keys',
    )
  }
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
  await ensureTelemetryCreativeLogsSchema(db as any)
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
  const cswRaw = String(row?.csw_address ?? '').trim()
  if (!creatorRaw || !cswRaw) return null
  const creatorAddress = getAddress(creatorRaw).toLowerCase() as `0x${string}`
  const cswAddress = getAddress(cswRaw).toLowerCase() as `0x${string}`
  const agentType = (String(row?.agent_type ?? 'csw').toLowerCase()) as AgentType
  const privyWalletId = row?.privy_wallet_id ? String(row.privy_wallet_id).trim() : null
  if (agentType === 'csw' && !privyWalletId) return null
  const listedPublicly = Boolean(row?.listed_publicly)
  const createdAt = row?.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  const updatedAt = row?.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  return {
    creatorAddress,
    xmtpAgentAddress: cswAddress,
    agentType,
    privyWalletId,
    cswAddress,
    listedPublicly,
    createdAt,
    updatedAt,
  }
}

export async function getOrCreateCreatorXmtpAgent(params: {
  creatorAddress: `0x${string}`
  listedPublicly?: boolean
}): Promise<CreatorXmtpAgentRow> {
  void params
  throw new Error(
    'legacy_eoa_xmtp_retired: provision CSW agent via enableCswAgent (creator CSW + delegated Privy server signer)',
  )
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
  const privyWalletId = String(params.privyWalletId ?? '').trim()
  if (!privyWalletId) {
    throw new Error('privyWalletId required for CSW agent')
  }

  const canonical =
    (await resolveCanonicalSmartWalletAddress(creator)) ??
    (await resolveCanonicalSmartWalletAddress(cswAddr))
  if (canonical && canonical.toLowerCase() !== cswAddr) {
    throw new Error('cswAddress must match profile canonical smart wallet')
  }

  const listed = typeof params.listedPublicly === 'boolean' ? params.listedPublicly : true

  // For CSW agents, the XMTP agent address IS the CSW address; signing is via Privy API.
  await db.sql`
    INSERT INTO creator_infrastructure (
      creator_address,
      agent_type,
      privy_wallet_id,
      csw_address,
      listed_publicly,
      created_at,
      updated_at
    )
    VALUES (
      ${creator},
      ${'csw'},
      ${privyWalletId},
      ${cswAddr},
      ${listed},
      NOW(),
      NOW()
    )
    ON CONFLICT (creator_address)
    DO UPDATE SET
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
    privyWalletId,
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
          SELECT creator_address, agent_type, privy_wallet_id, csw_address,
                 listed_publicly, created_at, updated_at
          FROM creator_infrastructure
          WHERE (${listedOnly} = FALSE OR listed_publicly = TRUE)
            AND agent_type = 'csw'
            AND csw_address IS NOT NULL
            AND LOWER(creator_address) = ${creatorFilter}
          ORDER BY created_at DESC, creator_address DESC
          LIMIT ${limit};
        `
      : cursorCreatedAt && cursorCreator
      ? await db.sql`
          SELECT creator_address, agent_type, privy_wallet_id, csw_address,
                 listed_publicly, created_at, updated_at
          FROM creator_infrastructure
          WHERE (${listedOnly} = FALSE OR listed_publicly = TRUE)
            AND agent_type = 'csw'
            AND csw_address IS NOT NULL
            AND (created_at, creator_address) < (${cursorCreatedAt}::timestamptz, ${cursorCreator})
          ORDER BY created_at DESC, creator_address DESC
          LIMIT ${limit};
        `
      : await db.sql`
          SELECT creator_address, agent_type, privy_wallet_id, csw_address,
                 listed_publicly, created_at, updated_at
          FROM creator_infrastructure
          WHERE (${listedOnly} = FALSE OR listed_publicly = TRUE)
            AND agent_type = 'csw'
            AND csw_address IS NOT NULL
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
