import { getAddress, isAddress, type Address } from 'viem'

import { getDb, isDbConfigured } from './postgres.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type MeteoraAccountMeta = {
  pubkey: string
  isSigner: boolean
  isWritable: boolean
}

export type MeteoraAlphaVaultConfig = {
  creatorToken: Address
  meteoraAlphaVault: string
  alphaVaultProgramId: string
  depositAccounts: MeteoraAccountMeta[]
  source: 'db' | 'env'
}

let schemaEnsured = false

function isSolanaPubkey(value: unknown): value is string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function parseAccountMeta(value: unknown): MeteoraAccountMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const pubkey = typeof row.pubkey === 'string' ? row.pubkey.trim() : ''
  if (!isSolanaPubkey(pubkey)) return null
  return {
    pubkey,
    isSigner: row.isSigner === true,
    isWritable: row.isWritable === true,
  }
}

function parseConfig(candidate: unknown, creatorToken: Address, source: 'db' | 'env'): MeteoraAlphaVaultConfig | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const raw = candidate as Record<string, unknown>
  const meteoraAlphaVault = typeof raw.meteoraAlphaVault === 'string' ? raw.meteoraAlphaVault.trim() : ''
  const alphaVaultProgramId = typeof raw.alphaVaultProgramId === 'string' ? raw.alphaVaultProgramId.trim() : ''
  const accountRows = Array.isArray(raw.depositAccounts) ? raw.depositAccounts : []
  if (!isSolanaPubkey(meteoraAlphaVault) || !isSolanaPubkey(alphaVaultProgramId)) return null

  const depositAccounts = accountRows
    .map((v) => parseAccountMeta(v))
    .filter((v): v is MeteoraAccountMeta => Boolean(v))
  if (depositAccounts.length === 0) return null
  return {
    creatorToken,
    meteoraAlphaVault,
    alphaVaultProgramId,
    depositAccounts,
    source,
  }
}

function normalizeCreatorToken(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!isAddress(v)) return null
  return getAddress(v).toLowerCase() as Address
}

async function ensureMeteoraConfigSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_meteora_alpha_vaults (
        creator_token TEXT PRIMARY KEY,
        meteora_alpha_vault TEXT NOT NULL,
        alpha_vault_program_id TEXT NOT NULL,
        deposit_accounts JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS creator_meteora_alpha_vaults_enabled_idx
      ON creator_meteora_alpha_vaults (enabled, updated_at DESC);
    `
    schemaEnsured = true
  } catch (err) {
    schemaEnsured = false
    throw err
  }
}

async function resolveFromDb(creatorToken: Address): Promise<MeteoraAlphaVaultConfig | null> {
  if (!isDbConfigured()) return null
  const db = (await getDb()) as Db | null
  if (!db) return null
  await ensureMeteoraConfigSchema(db)

  const result = await db.sql`
    SELECT
      creator_token,
      meteora_alpha_vault,
      alpha_vault_program_id,
      deposit_accounts
    FROM creator_meteora_alpha_vaults
    WHERE LOWER(creator_token) = ${creatorToken}
      AND enabled = true
    LIMIT 1;
  `
  const row = result?.rows?.[0]
  if (!row) return null
  return parseConfig(
    {
      meteoraAlphaVault: row.meteora_alpha_vault,
      alphaVaultProgramId: row.alpha_vault_program_id,
      depositAccounts: row.deposit_accounts,
    },
    creatorToken,
    'db',
  )
}

function resolveFromEnv(creatorToken: Address): MeteoraAlphaVaultConfig | null {
  const mapRaw = String(process.env.METEORA_CREATOR_ALPHA_VAULT_MAP_JSON ?? '').trim()
  if (!mapRaw) return null
  try {
    const parsed = JSON.parse(mapRaw) as Record<string, unknown>
    const direct = parsed[creatorToken]
    const byChecksum = parsed[getAddress(creatorToken)]
    const fallback = parsed.default
    return (
      parseConfig(direct, creatorToken, 'env') ??
      parseConfig(byChecksum, creatorToken, 'env') ??
      parseConfig(fallback, creatorToken, 'env')
    )
  } catch {
    return null
  }
}

export async function resolveMeteoraAlphaVaultConfig(params: {
  creatorToken: string
}): Promise<MeteoraAlphaVaultConfig | null> {
  const creatorToken = normalizeCreatorToken(params.creatorToken)
  if (!creatorToken) return null
  const dbConfig = await resolveFromDb(creatorToken)
  if (dbConfig) return dbConfig
  return resolveFromEnv(creatorToken)
}

