import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'

declare const process: { env: Record<string, string | undefined> }

type Body = {
  notificationId?: string
  title?: string
  body?: string
  targetUrl?: string
  // Optional: send to a subset of users (by fid)
  fids?: number[]
  // Optional: dry-run validation only (no network)
  dryRun?: boolean
}

type SendResult = {
  notificationId: string
  attemptedTokens: number
  successfulTokens: number
  invalidTokens: number
  rateLimitedTokens: number
  skippedTokens: number
  skippedReasons: Record<string, number>
}

const MAX_TITLE = 32
const MAX_BODY = 128
const MAX_TARGET_URL = 1024
const MAX_NOTIFICATION_ID = 128
const MAX_TOKENS_PER_REQUEST = 100

function coerceString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function coerceFids(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null
  const out: number[] = []
  for (const x of v) {
    const n = typeof x === 'number' ? x : Number(x)
    if (!Number.isFinite(n)) continue
    const i = Math.floor(n)
    if (i > 0) out.push(i)
  }
  return out.length > 0 ? Array.from(new Set(out)).slice(0, 500) : null
}

function normalizeTargetUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (s.length > MAX_TARGET_URL) return null

  // Allow relative paths but enforce same-origin in the final URL.
  const base = 'https://4626.fun'
  try {
    const u = new URL(s, base)
    const host = u.hostname.toLowerCase()
    if (host !== '4626.fun' && !host.endsWith('.4626.fun')) return null
    return u.toString()
  } catch {
    return null
  }
}

async function ensureNotificationsSendColumns(db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any> }) {
  // Idempotent: add columns if they don't exist.
  await db.sql`ALTER TABLE IF EXISTS miniapp_notifications ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;`
  await db.sql`ALTER TABLE IF EXISTS miniapp_notifications ADD COLUMN IF NOT EXISTS sent_day DATE;`
  await db.sql`ALTER TABLE IF EXISTS miniapp_notifications ADD COLUMN IF NOT EXISTS sent_day_count INT NOT NULL DEFAULT 0;`
}

function todayUtcDateString(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  if (!isAdminAddress(admin)) return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)

  const body = (await readJsonBody<Body>(req)) ?? {}
  const title = coerceString(body.title)
  const notifBody = coerceString(body.body)
  const targetUrl = normalizeTargetUrl(coerceString(body.targetUrl))
  const notificationIdRaw = coerceString(body.notificationId) || `manual-${Date.now()}`
  const notificationId = notificationIdRaw.slice(0, MAX_NOTIFICATION_ID)
  const fids = coerceFids(body.fids)
  const dryRun = Boolean(body.dryRun)

  if (!title || title.length > MAX_TITLE) {
    return res
      .status(400)
      .json({ success: false, error: `Invalid title (1-${MAX_TITLE} chars)` } satisfies ApiEnvelope<never>)
  }
  if (!notifBody || notifBody.length > MAX_BODY) {
    return res
      .status(400)
      .json({ success: false, error: `Invalid body (1-${MAX_BODY} chars)` } satisfies ApiEnvelope<never>)
  }
  if (!targetUrl) {
    return res
      .status(400)
      .json({ success: false, error: `Invalid targetUrl (must be same-domain, <=${MAX_TARGET_URL} chars)` } satisfies ApiEnvelope<never>)
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db || !isDbConfigured()) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureNotificationsSendColumns(db as any)

  const today = todayUtcDateString()

  // Pull stored tokens.
  const result =
    fids && fids.length > 0
      ? await db.sql`
          SELECT fid, app_fid, token, url, last_sent_at, sent_day, sent_day_count
          FROM miniapp_notifications
          WHERE fid = ANY(${fids}::BIGINT[])
          ORDER BY updated_at DESC
          LIMIT 2000;
        `
      : await db.sql`
          SELECT fid, app_fid, token, url, last_sent_at, sent_day, sent_day_count
          FROM miniapp_notifications
          ORDER BY updated_at DESC
          LIMIT 2000;
        `

  const rows = Array.isArray(result?.rows) ? result.rows : []

  // Enforce conservative local rate limits to stay well under platform limits.
  const sendable: Array<{ fid: number; appFid: number; token: string; url: string }> = []
  const skippedReasons: Record<string, number> = {}
  const now = Date.now()
  for (const r of rows) {
    const fid = Number(r?.fid)
    const appFid = Number(r?.app_fid)
    const token = typeof r?.token === 'string' ? r.token.trim() : ''
    const url = typeof r?.url === 'string' ? r.url.trim() : ''
    if (!Number.isFinite(fid) || fid <= 0 || !Number.isFinite(appFid) || appFid <= 0 || !token || !url) {
      skippedReasons.invalid_row = (skippedReasons.invalid_row ?? 0) + 1
      continue
    }

    const lastSentAt = r?.last_sent_at ? new Date(r.last_sent_at).getTime() : 0
    if (lastSentAt && now - lastSentAt < 35_000) {
      skippedReasons.too_soon = (skippedReasons.too_soon ?? 0) + 1
      continue
    }

    const sentDay = typeof r?.sent_day === 'string' ? r.sent_day : r?.sent_day ? new Date(r.sent_day).toISOString().slice(0, 10) : ''
    const count = Number(r?.sent_day_count ?? 0)
    const dayCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    const effectiveCount = sentDay === today ? dayCount : 0
    if (effectiveCount >= 95) {
      skippedReasons.daily_cap = (skippedReasons.daily_cap ?? 0) + 1
      continue
    }

    sendable.push({ fid, appFid, token, url })
  }

  if (dryRun) {
    return res.status(200).json({
      success: true,
      data: {
        notificationId,
        title,
        body: notifBody,
        targetUrl,
        sendableTokens: sendable.length,
        skippedTokens: rows.length - sendable.length,
        skippedReasons,
      },
    } satisfies ApiEnvelope<any>)
  }

  // Group by url so we can batch tokens per endpoint.
  const byUrl = new Map<string, Array<{ fid: number; appFid: number; token: string }>>()
  for (const s of sendable) {
    const list = byUrl.get(s.url) ?? []
    list.push({ fid: s.fid, appFid: s.appFid, token: s.token })
    byUrl.set(s.url, list)
  }

  let attemptedTokens = 0
  let successfulTokens = 0
  let invalidTokens = 0
  let rateLimitedTokens = 0

  for (const [url, list] of byUrl.entries()) {
    for (let i = 0; i < list.length; i += MAX_TOKENS_PER_REQUEST) {
      const batch = list.slice(i, i + MAX_TOKENS_PER_REQUEST)
      attemptedTokens += batch.length

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          title,
          body: notifBody,
          targetUrl,
          tokens: batch.map((b) => b.token),
        }),
      })

      const json = (await resp.json().catch(() => null)) as
        | { successfulTokens?: string[]; invalidTokens?: string[]; rateLimitedTokens?: string[] }
        | null

      const okTokens = Array.isArray(json?.successfulTokens) ? json!.successfulTokens!.map(String) : []
      const badTokens = Array.isArray(json?.invalidTokens) ? json!.invalidTokens!.map(String) : []
      const rlTokens = Array.isArray(json?.rateLimitedTokens) ? json!.rateLimitedTokens!.map(String) : []

      successfulTokens += okTokens.length
      invalidTokens += badTokens.length
      rateLimitedTokens += rlTokens.length

      // Update send counters for successful tokens.
      if (okTokens.length > 0) {
        const okSet = new Set(okTokens)
        const okRows = batch.filter((b) => okSet.has(b.token))
        for (const r of okRows) {
          await db.sql`
            UPDATE miniapp_notifications
            SET last_sent_at = NOW(),
                sent_day = ${today}::DATE,
                sent_day_count = CASE
                  WHEN sent_day = ${today}::DATE THEN sent_day_count + 1
                  ELSE 1
                END
            WHERE fid = ${r.fid} AND app_fid = ${r.appFid};
          `
        }
      }

      // Delete invalid tokens so we don't try again.
      if (badTokens.length > 0) {
        const badSet = new Set(badTokens)
        const badRows = batch.filter((b) => badSet.has(b.token))
        for (const r of badRows) {
          await db.sql`DELETE FROM miniapp_notifications WHERE fid = ${r.fid} AND app_fid = ${r.appFid};`
        }
      }

      // On hard errors, stop early (avoid spamming).
      if (!resp.ok) break
    }
  }

  const data: SendResult = {
    notificationId,
    attemptedTokens,
    successfulTokens,
    invalidTokens,
    rateLimitedTokens,
    skippedTokens: rows.length - sendable.length,
    skippedReasons,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<SendResult>)
}

