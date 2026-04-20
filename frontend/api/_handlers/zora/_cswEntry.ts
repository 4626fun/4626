import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress } from 'viem'
import {
  buildTelegramMiniAppUrl,
  resolveTelegramMiniAppUrl,
  TELEGRAM_MINI_APP_LINK_PATH,
} from '../telegram/webhook/miniApp.js'

import {
  type ApiEnvelope,
  checkRateLimit,
  getDb,
  getClientIp,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../server/_lib/db/supabaseAdmin.js'
import { issueZoraCswGateVerificationToken } from '../../../server/_lib/zora/cswGateVerification.js'

declare const process: { env: Record<string, string | undefined> }

type EntryRequestBody = {
  cswAddress?: string
  telegramUsername?: string | null
  connectedAddress?: string | null
  tokenAddress?: string | null
  symbol?: string | null
  minTokens?: string | null
  source?: string | null
}

type RegistryMatch = {
  table: string
  column: string
}

type EntryResponse = {
  accepted: boolean
  saved: boolean
  verificationRequired: boolean
  cswAddress: `0x${string}`
  registryMatch: RegistryMatch
  telegramVerification: {
    verifyEndpoint: string
    expiresAt: string
    botStartUrl: string | null
    miniAppUrl: string
  }
  message: string
}

const CSW_ENTRY_BODY_MAX_BYTES = 16_384

const REGISTRY_TABLE = (process.env.ZORA_CSW_REGISTRY_TABLE || '').trim()
const REGISTRY_COLUMN = (process.env.ZORA_CSW_REGISTRY_COLUMN || 'csw_address').trim() || 'csw_address'
const ENTRY_TABLE = (process.env.ZORA_CSW_ENTRY_TABLE || 'zora_csw_gate_entries').trim()
const ENTRY_ADDRESS_COLUMN =
  (process.env.ZORA_CSW_ENTRY_ADDRESS_COLUMN || 'csw_address').trim() || 'csw_address'
const ENTRY_HOLDER_COLUMN = (process.env.ZORA_CSW_ENTRY_HOLDER_COLUMN || 'holder_address').trim()
const ENTRY_TELEGRAM_COLUMN = (process.env.ZORA_CSW_ENTRY_TELEGRAM_COLUMN || '').trim()
const ENTRY_META_COLUMN = (process.env.ZORA_CSW_ENTRY_META_COLUMN || 'meta').trim()
const TELEGRAM_BOT_USERNAME = (process.env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '')

function setEntryCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') return false
  setEntryCors(res)
  res.status(200).end()
  return true
}

function asObjectBody(input: unknown): EntryRequestBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as EntryRequestBody
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed).toLowerCase() as `0x${string}`
}

function normalizeTelegramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('@')) trimmed = trimmed.slice(1)
  if (!/^[A-Za-z0-9_]{5,32}$/.test(trimmed)) return null
  return trimmed.toLowerCase()
}

function buildRegistryCandidates(): Array<{ table: string; column: string; filters?: Record<string, string | number> }> {
  const candidates: Array<{ table: string; column: string; filters?: Record<string, string | number> }> = []

  if (REGISTRY_TABLE) {
    candidates.push({ table: REGISTRY_TABLE, column: REGISTRY_COLUMN })
    return candidates
  }

  // Fallback candidates if env is not configured. Prefer explicit env in production.
  candidates.push({ table: 'account_zora_signals', column: 'canonical_csw_address' })
  candidates.push({ table: 'profile_wallets', column: 'canonical_csw_address', filters: { chain_id: 8453 } })
  candidates.push({ table: 'profile_wallets', column: 'address', filters: { chain_id: 8453, wallet_type: 'smart_wallet' } })

  return candidates
}

async function findRegistryMatch(
  cswAddress: `0x${string}`,
): Promise<{ match: RegistryMatch | null; hadQueryableSource: boolean; lastError: string | null }> {
  const supabase = getSupabaseAdmin()
  const candidates = buildRegistryCandidates()

  let hadQueryableSource = false
  let lastError: string | null = null

  for (const candidate of candidates) {
    try {
      let query = supabase
        .from(candidate.table)
        .select(candidate.column)
        .ilike(candidate.column, cswAddress)
        .limit(1)

      for (const [key, value] of Object.entries(candidate.filters || {})) {
        query = query.eq(key, value)
      }

      const result = await query
      if (result.error) {
        lastError = result.error.message
        continue
      }

      hadQueryableSource = true
      if (Array.isArray(result.data) && result.data.length > 0) {
        return {
          match: { table: candidate.table, column: candidate.column },
          hadQueryableSource,
          lastError,
        }
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : 'registry_query_failed'
    }
  }

  return { match: null, hadQueryableSource, lastError }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setEntryCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('zora-csw-entry', getClientIp(req)), RATE_LIMITS.cswLink)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!isSupabaseAdminConfigured()) {
    return res.status(503).json({ success: false, error: 'Supabase admin not configured' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: CSW_ENTRY_BODY_MAX_BYTES }))
  const cswAddress = normalizeAddress(body.cswAddress)
  if (!cswAddress) {
    return res.status(400).json({ success: false, error: 'Invalid cswAddress' } satisfies ApiEnvelope<never>)
  }
  const telegramUsername = normalizeTelegramUsername(body.telegramUsername)
  if (!telegramUsername) {
    return res
      .status(400)
      .json({ success: false, error: 'Invalid telegramUsername (expected @name or name)' } satisfies ApiEnvelope<never>)
  }

  const connectedAddress = normalizeAddress(body.connectedAddress)
  const tokenAddress = normalizeAddress(body.tokenAddress)
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().slice(0, 32) : null
  const minTokens = typeof body.minTokens === 'string' ? body.minTokens.trim().slice(0, 64) : null
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 512) : null

  const registryLookup = await findRegistryMatch(cswAddress)
  if (!registryLookup.match) {
    if (!registryLookup.hadQueryableSource) {
      return res.status(503).json({
        success: false,
        error:
          registryLookup.lastError ||
          'Zora CSW registry source is unavailable. Set ZORA_CSW_REGISTRY_TABLE/ZORA_CSW_REGISTRY_COLUMN.',
      } satisfies ApiEnvelope<never>)
    }
    return res.status(403).json({
      success: false,
      error: 'Address is not in the imported Zora CSW registry',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable for telegram verification token issuance',
    } satisfies ApiEnvelope<never>)
  }

  if (!ENTRY_TABLE) {
    return res.status(500).json({
      success: false,
      error: 'ZORA_CSW_ENTRY_TABLE is required for writes',
    } satisfies ApiEnvelope<never>)
  }

  const payload: Record<string, unknown> = {
    [ENTRY_ADDRESS_COLUMN]: cswAddress,
  }
  if (ENTRY_HOLDER_COLUMN && connectedAddress) payload[ENTRY_HOLDER_COLUMN] = connectedAddress
  if (ENTRY_TELEGRAM_COLUMN) payload[ENTRY_TELEGRAM_COLUMN] = telegramUsername
  if (ENTRY_META_COLUMN) {
    payload[ENTRY_META_COLUMN] = {
      telegramUsername,
      tokenAddress,
      symbol,
      minTokens,
      source,
      registry: registryLookup.match,
      submittedAt: new Date().toISOString(),
    }
  }

  const supabase = getSupabaseAdmin()
  const upsert = await supabase
    .from(ENTRY_TABLE)
    .upsert(payload, { onConflict: ENTRY_ADDRESS_COLUMN })
    .select(ENTRY_ADDRESS_COLUMN)
    .limit(1)

  if (upsert.error) {
    // Fallback for tables that don't yet enforce a unique constraint
    // on ENTRY_ADDRESS_COLUMN for ON CONFLICT.
    const inserted = await supabase
      .from(ENTRY_TABLE)
      .insert(payload)
      .select(ENTRY_ADDRESS_COLUMN)
      .limit(1)
    if (inserted.error) {
      return res.status(500).json({
        success: false,
        error: `Failed to save entry (${inserted.error.message})`,
      } satisfies ApiEnvelope<never>)
    }
  }

  const issued = await issueZoraCswGateVerificationToken({
    db: db as any,
    cswAddress,
    requestedTelegramUsername: telegramUsername,
    sourceUrl: source,
  })

  const verifyEndpoint = '/api/zora/csw-entry/telegram-verify'
  const miniAppUrl = buildTelegramMiniAppUrl({
    baseUrl: resolveTelegramMiniAppUrl(),
    pathname: TELEGRAM_MINI_APP_LINK_PATH,
    query: {
      zoraGateToken: issued.token,
      zoraGateCsw: cswAddress,
    },
  })
  const botStartUrl = TELEGRAM_BOT_USERNAME
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${issued.token}`
    : null

  const data: EntryResponse = {
    accepted: true,
    saved: true,
    verificationRequired: true,
    cswAddress,
    registryMatch: registryLookup.match,
    telegramVerification: {
      verifyEndpoint,
      expiresAt: issued.expiresAt,
      botStartUrl,
      miniAppUrl,
    },
    message: `Entry recorded for verified Zora CSW. Complete Telegram verification to finish (@${telegramUsername}).`,
  }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<EntryResponse>)
}
