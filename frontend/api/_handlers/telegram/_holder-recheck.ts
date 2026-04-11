import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'

import {
  checkSharesEligibility } from '../../../server/_lib/keeprGating.js'
import { getDb,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'
import {
  ensureTelegramTradingSchema,
  listHolderRoomMembersNeedingRecheck,
  upsertHolderRoomMember,
  type TelegramHolderRoomRecheckRow,
} from '../../../server/_lib/telegramTrading.js'
import { getTelegramWebhookConfig } from './webhook/config.js'

declare const process: { env: Record<string, string | undefined> }

function asTrimmed(value: unknown): string {
  return String(value ?? '').trim()
}

function readHolderRecheckSecret(req: VercelRequest): string {
  const direct = req.headers['x-telegram-holder-secret']
  if (Array.isArray(direct)) return asTrimmed(direct[0] ?? '')
  if (typeof direct === 'string') return asTrimmed(direct)
  const auth = asTrimmed(req.headers.authorization ?? '')
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]
  return asTrimmed(bearer ?? '')
}

function readLimit(req: VercelRequest): number {
  const raw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.min(250, Math.floor(parsed)))
  }
  return 50
}

function readChatId(req: VercelRequest): string {
  const raw = Array.isArray(req.query.chatId) ? req.query.chatId[0] : req.query.chatId
  return asTrimmed(raw ?? '')
}

function toPositiveBigIntOrDefault(raw: string, fallback: bigint): bigint {
  const normalized = asTrimmed(raw)
  if (!normalized) return fallback
  try {
    const parsed = BigInt(normalized)
    if (parsed > 0n) return parsed
    return fallback
  } catch {
    return fallback
  }
}

function parseIsoMsOrNaN(value: string | null): number {
  if (!value) return Number.NaN
  return Date.parse(value)
}

function toGraceUntilMs(nowMs: number, graceHours: number): number {
  const clampedHours = Math.max(1, Math.min(24 * 30, Math.floor(Number(graceHours) || 24)))
  return nowMs + clampedHours * 60 * 60 * 1000
}

function isAddressLike(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

async function sendHolderRoomWarning(params: {
  botToken: string
  roomChatId: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.roomChatId,
        text: params.text,
        disable_web_page_preview: true,
      }),
    })
    if (!response.ok) {
      const details = await response.text().catch(() => '')
      return { ok: false, error: `send_failed_${response.status}:${details.slice(0, 180)}` }
    }
    const body = (await response.json().catch(() => null)) as any
    if (body?.ok !== true) {
      return { ok: false, error: `send_failed_api:${asTrimmed(body?.description ?? 'unknown')}` }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function removeHolderRoomMember(params: {
  botToken: string
  roomChatId: string
  telegramUserId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${params.botToken}/banChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.roomChatId,
        user_id: params.telegramUserId,
        revoke_messages: false,
      }),
    })
    if (!response.ok) {
      const details = await response.text().catch(() => '')
      return { ok: false, error: `ban_failed_${response.status}:${details.slice(0, 180)}` }
    }
    const body = (await response.json().catch(() => null)) as any
    if (body?.ok !== true) {
      return { ok: false, error: `ban_failed_api:${asTrimmed(body?.description ?? 'unknown')}` }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function buildGraceWarningText(row: TelegramHolderRoomRecheckRow, graceUntilIso: string): string {
  return [
    'Holder room access warning',
    '',
    `Your wallet no longer meets the holder threshold for vault ${row.vaultAddress}.`,
    `Grace period ends: ${graceUntilIso}`,
    'Regain required shares to remain in the room.',
  ].join('\n')
}

function buildRemovalText(row: TelegramHolderRoomRecheckRow): string {
  return [
    'Holder room access removed',
    '',
    `Member removed from holder room for vault ${row.vaultAddress} after grace period.`,
    'Re-qualify and rejoin to restore access.',
  ].join('\n')
}

function buildLinkRevokedText(row: TelegramHolderRoomRecheckRow): string {
  return [
    'Holder room access removed',
    '',
    `Member removed from holder room for vault ${row.vaultAddress} because Telegram link is no longer active/verified.`,
    'Relink your wallet in 4626, then rejoin with /join.',
  ].join('\n')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('telegram-holder-recheck', getClientIp(req)),
    RATE_LIMITS.telegramAdminWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const configuredSecret = asTrimmed(process.env.TELEGRAM_HOLDER_RECHECK_SECRET ?? '')
  if (!configuredSecret) {
    return res.status(503).json({ success: false, error: 'TELEGRAM_HOLDER_RECHECK_SECRET is not configured' })
  }
  const providedSecret = readHolderRecheckSecret(req)
  if (!providedSecret || providedSecret !== configuredSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const config = getTelegramWebhookConfig()
  if (!config.holderRoomsEnabled) {
    return res.status(404).json({ success: false, error: 'Holder rooms are disabled' })
  }
  if (!config.botToken) {
    return res.status(503).json({ success: false, error: 'TELEGRAM_BOT_TOKEN is not configured' })
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' })
  }
  await ensureTelegramTradingSchema(db as any)

  const due = await listHolderRoomMembersNeedingRecheck({
    db: db as any,
    limit: readLimit(req),
    chatId: readChatId(req),
  })

  let checked = 0
  let graced = 0
  let removed = 0
  let recovered = 0
  let skipped = 0
  let errors = 0

  for (const row of due) {
    checked += 1
    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()
    const walletRaw = asTrimmed(row.canonicalCswAddress).toLowerCase()
    if (!isAddressLike(walletRaw)) {
      skipped += 1
      continue
    }
    const wallet: Address = walletRaw

    const linkIsActive = asTrimmed(row.linkStatus).toLowerCase() === 'active'
    if (!linkIsActive || row.ownerVerified !== true) {
      const removalResult = await removeHolderRoomMember({
        botToken: config.botToken,
        roomChatId: row.roomChatId,
        telegramUserId: row.telegramUserId,
      })
      if (!removalResult.ok) {
        await upsertHolderRoomMember({
          db: db as any,
          roomChatId: row.roomChatId,
          telegramUserId: row.telegramUserId,
          canonicalCswAddress: wallet,
          status: row.status,
          lastEligibleAt: row.lastEligibleAt,
          graceUntil: row.graceUntil,
          lastCheckedAt: nowIso,
          removedAt: null,
        })
        errors += 1
        continue
      }

      await upsertHolderRoomMember({
        db: db as any,
        roomChatId: row.roomChatId,
        telegramUserId: row.telegramUserId,
        canonicalCswAddress: wallet,
        status: 'removed',
        lastEligibleAt: row.lastEligibleAt,
        graceUntil: row.graceUntil,
        lastCheckedAt: nowIso,
        removedAt: nowIso,
      })

      const noticeResult = await sendHolderRoomWarning({
        botToken: config.botToken,
        roomChatId: row.roomChatId,
        text: buildLinkRevokedText(row),
      })
      if (!noticeResult.ok) {
        errors += 1
      }

      removed += 1
      continue
    }

    const shareToken = asTrimmed(row.shareTokenAddress).toLowerCase()
    if (!isAddressLike(shareToken)) {
      skipped += 1
      continue
    }

    const minShares = toPositiveBigIntOrDefault(row.minSharesRaw, 1n)
    const eligibility = await checkSharesEligibility({
      wallet,
      shareToken,
      minShares,
    })

    if (eligibility.reason === 'onchain_read_failed') {
      await upsertHolderRoomMember({
        db: db as any,
        roomChatId: row.roomChatId,
        telegramUserId: row.telegramUserId,
        canonicalCswAddress: wallet,
        status: row.status,
        lastEligibleAt: row.lastEligibleAt,
        graceUntil: row.graceUntil,
        lastCheckedAt: nowIso,
        removedAt: row.status === 'removed' ? nowIso : null,
      })
      skipped += 1
      continue
    }

    if (eligibility.eligible) {
      await upsertHolderRoomMember({
        db: db as any,
        roomChatId: row.roomChatId,
        telegramUserId: row.telegramUserId,
        canonicalCswAddress: wallet,
        status: 'active',
        lastEligibleAt: nowIso,
        graceUntil: null,
        lastCheckedAt: nowIso,
        removedAt: null,
      })
      if (row.status === 'grace') recovered += 1
      continue
    }

    const graceUntilMs = parseIsoMsOrNaN(row.graceUntil)
    const graceExpired = row.status === 'grace' && Number.isFinite(graceUntilMs) && graceUntilMs <= nowMs
    if (graceExpired) {
      const removalResult = await removeHolderRoomMember({
        botToken: config.botToken,
        roomChatId: row.roomChatId,
        telegramUserId: row.telegramUserId,
      })
      if (!removalResult.ok) {
        await upsertHolderRoomMember({
          db: db as any,
          roomChatId: row.roomChatId,
          telegramUserId: row.telegramUserId,
          canonicalCswAddress: wallet,
          status: 'grace',
          lastEligibleAt: row.lastEligibleAt,
          graceUntil: row.graceUntil,
          lastCheckedAt: nowIso,
          removedAt: null,
        })
        errors += 1
        continue
      }

      await upsertHolderRoomMember({
        db: db as any,
        roomChatId: row.roomChatId,
        telegramUserId: row.telegramUserId,
        canonicalCswAddress: wallet,
        status: 'removed',
        lastEligibleAt: row.lastEligibleAt,
        graceUntil: row.graceUntil,
        lastCheckedAt: nowIso,
        removedAt: nowIso,
      })

      const removalNoticeResult = await sendHolderRoomWarning({
        botToken: config.botToken,
        roomChatId: row.roomChatId,
        text: buildRemovalText(row),
      })
      if (!removalNoticeResult.ok) {
        errors += 1
      }

      removed += 1
      continue
    }

    const nextGraceUntilMs =
      row.status === 'grace' && Number.isFinite(graceUntilMs) && graceUntilMs > nowMs
        ? graceUntilMs
        : toGraceUntilMs(nowMs, row.graceHours)
    const nextGraceUntilIso = new Date(nextGraceUntilMs).toISOString()

    await upsertHolderRoomMember({
      db: db as any,
      roomChatId: row.roomChatId,
      telegramUserId: row.telegramUserId,
      canonicalCswAddress: wallet,
      status: 'grace',
      lastEligibleAt: row.lastEligibleAt,
      graceUntil: nextGraceUntilIso,
      lastCheckedAt: nowIso,
      removedAt: null,
    })
    if (row.status !== 'grace') {
      try {
        await sendHolderRoomWarning({
          botToken: config.botToken,
          roomChatId: row.roomChatId,
          text: buildGraceWarningText(row, nextGraceUntilIso),
        })
      } catch {
        errors += 1
      }
      graced += 1
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      checked,
      graced,
      removed,
      recovered,
      skipped,
      errors,
    },
  })
}
