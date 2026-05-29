import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  checkRateLimit,
  ensureTelegramTradingSchema,
  getDb,
  getClientIp,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  readTelegramMiniAppSession,
  setNoStore,
} from '@4626/server-core'
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../server/_lib/db/supabaseAdmin.js'
import {
  consumeZoraCswGateVerificationToken,
  readZoraCswGateVerificationToken,
} from '../../../server/_lib/zora/cswGateVerification.js'

declare const process: { env: Record<string, string | undefined> }

type VerifyBody = {
  verificationToken?: string
  sessionToken?: string
}

type VerifyResponse = {
  verified: boolean
  cswAddress: `0x${string}`
  telegramUserId: string
  telegramUsername: string | null
  verifiedAt: string
}

const VERIFY_BODY_MAX_BYTES = 16_384

const ENTRY_TABLE = (process.env.ZORA_CSW_ENTRY_TABLE || 'zora_csw_gate_entries').trim()
const ENTRY_ADDRESS_COLUMN =
  (process.env.ZORA_CSW_ENTRY_ADDRESS_COLUMN || 'csw_address').trim() || 'csw_address'
const ENTRY_HOLDER_COLUMN = (process.env.ZORA_CSW_ENTRY_HOLDER_COLUMN || 'holder_address').trim()
const ENTRY_TELEGRAM_COLUMN = (process.env.ZORA_CSW_ENTRY_TELEGRAM_COLUMN || '').trim()
const ENTRY_META_COLUMN = (process.env.ZORA_CSW_ENTRY_META_COLUMN || 'meta').trim()

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

function asObjectBody(input: unknown): VerifyBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as VerifyBody
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTelegramUsername(value: unknown): string | null {
  const raw = asTrimmed(value)
  if (!raw) return null
  return raw.toLowerCase().replace(/^@/, '') || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setEntryCors(res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(rateLimitKey('zora-csw-entry-telegram-verify', getClientIp(req)), RATE_LIMITS.telegramLinkWrite)
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureTelegramTradingSchema(db as any)

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: VERIFY_BODY_MAX_BYTES }))
  const verificationToken = asTrimmed(body.verificationToken)
  const sessionToken = asTrimmed(body.sessionToken)
  if (!verificationToken || !sessionToken) {
    return res
      .status(400)
      .json({ success: false, error: 'verificationToken and sessionToken are required' } satisfies ApiEnvelope<never>)
  }

  const tokenRow = await readZoraCswGateVerificationToken({
    db: db as any,
    token: verificationToken,
  })
  if (!tokenRow) {
    return res.status(404).json({ success: false, error: 'Invalid verification token' } satisfies ApiEnvelope<never>)
  }
  if (tokenRow.consumedAt) {
    return res.status(409).json({ success: false, error: 'Verification token already used' } satisfies ApiEnvelope<never>)
  }
  if (Date.parse(tokenRow.expiresAt) <= Date.now()) {
    return res.status(409).json({ success: false, error: 'Verification token expired' } satisfies ApiEnvelope<never>)
  }

  const session = await readTelegramMiniAppSession({ db: db as any, sessionToken })
  if (!session.ok) {
    const error =
      session.reason === 'expired'
        ? 'Telegram mini app session expired'
        : session.reason === 'revoked'
          ? 'Telegram mini app session revoked'
          : 'Invalid Telegram mini app session'
    return res.status(409).json({ success: false, error } satisfies ApiEnvelope<never>)
  }

  const sessionUsername = normalizeTelegramUsername(session.session.telegramUsername)
  if (tokenRow.requestedTelegramUsername) {
    if (!sessionUsername) {
      return res.status(409).json({
        success: false,
        error: `Telegram account has no username set. Expected @${tokenRow.requestedTelegramUsername}`,
      } satisfies ApiEnvelope<never>)
    }
    if (sessionUsername !== tokenRow.requestedTelegramUsername) {
      return res.status(409).json({
        success: false,
        error: `Telegram username mismatch. Expected @${tokenRow.requestedTelegramUsername}, got @${sessionUsername}`,
      } satisfies ApiEnvelope<never>)
    }
  }

  const consumed = await consumeZoraCswGateVerificationToken({
    db: db as any,
    token: verificationToken,
    telegramUserId: session.session.telegramUserId,
    telegramUsername: sessionUsername,
  })
  if (!consumed.ok) {
    const error =
      consumed.reason === 'expired'
        ? 'Verification token expired'
        : consumed.reason === 'consumed'
          ? 'Verification token already used'
          : 'Verification token invalid'
    return res.status(409).json({ success: false, error } satisfies ApiEnvelope<never>)
  }

  const verifiedAt = consumed.row.consumedAt ?? new Date().toISOString()

  if (isSupabaseAdminConfigured() && ENTRY_TABLE) {
    try {
      const supabase = getSupabaseAdmin()
      const payload: Record<string, unknown> = {
        [ENTRY_ADDRESS_COLUMN]: consumed.row.cswAddress,
      }
      if (ENTRY_HOLDER_COLUMN) payload[ENTRY_HOLDER_COLUMN] = null
      if (ENTRY_TELEGRAM_COLUMN) payload[ENTRY_TELEGRAM_COLUMN] = sessionUsername
      if (ENTRY_META_COLUMN) {
        payload[ENTRY_META_COLUMN] = {
          telegramVerified: true,
          telegramVerifiedAt: verifiedAt,
          telegramUserId: session.session.telegramUserId,
          telegramUsername: sessionUsername,
          verifiedVia: 'telegram_miniapp_session',
        }
      }
      await supabase.from(ENTRY_TABLE).upsert(payload, { onConflict: ENTRY_ADDRESS_COLUMN })
    } catch {
      // best-effort write; token consumption remains canonical verification record.
    }
  }

  const data: VerifyResponse = {
    verified: true,
    cswAddress: consumed.row.cswAddress,
    telegramUserId: session.session.telegramUserId,
    telegramUsername: sessionUsername,
    verifiedAt,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<VerifyResponse>)
}
