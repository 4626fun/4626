import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import {
  readAlfaClubDailyBriefFlags,
  runAlfaClubDailyBrief,
} from '../../../../server/_lib/alfaclub/dailyBrief.js'
import {
  readInverseAkitaTradeJournalFlags,
  runInverseAkitaTradeJournal,
} from '../../../../server/_lib/alfaclub/inverseAkitaTradeJournal.js'
import {
  isCronSecretAuthorized,
  readConfiguredCronSecret,
} from '../../../../server/_lib/alfaclub/alfaclubCronAuth.js'

function readForceSendQuery(req: VercelRequest): boolean {
  const raw = req.query?.forceSend
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('alfaclub-daily-brief', getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }
  if (!readConfiguredCronSecret()) {
    return res.status(503).json({
      success: false,
      error: 'CRON_SECRET is not configured',
    })
  }
  if (!isCronSecretAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    const journalFlags = readInverseAkitaTradeJournalFlags()
    if (journalFlags.publishEnabled) {
      const result = await runInverseAkitaTradeJournal()
      return res.status(200).json({
        success: true,
        reason: result.skippedDuplicate ? 'duplicate_window' : null,
        lane: 'inverse_akita_trade_journal',
        captureEnabled: journalFlags.captureEnabled,
        data: result,
      })
    }
    const flags = readAlfaClubDailyBriefFlags()
    if (readForceSendQuery(req)) {
      flags.forceSend = true
    }
    const result = await runAlfaClubDailyBrief({ flags })
    const status = result.ok ? 200 : 202
    return res.status(status).json({
      success: result.ok,
      reason: result.reason ?? null,
      lane: 'legacy_daily_brief',
      captureEnabled: journalFlags.captureEnabled,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
