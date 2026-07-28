/**
 * GET/POST /api/v1/lottery/amoe/daily-quest-reminder-cron
 *
 * Cron-secret-gated Base App push for AMOE daily check-in reminders.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'

import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { runAmoeDailyQuestReminder } from '../../../../server/_lib/lottery/amoeDailyQuestReminder.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('amoe-daily-quest-reminder', getClientIp(req)),
    RATE_LIMITS.adminAction,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const dryRun =
    String(req.query?.dryRun ?? req.query?.dry_run ?? '').trim() === '1' ||
    String(req.query?.dryRun ?? req.query?.dry_run ?? '').trim().toLowerCase() === 'true'

  try {
    const result = await runAmoeDailyQuestReminder({ dryRun })
    const status = result.ok ? 200 : result.reason?.includes('not configured') ? 503 : 202
    return res.status(status).json({
      success: result.ok,
      reason: result.reason,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return res.status(500).json({ success: false, error: message.slice(0, 256) })
  }
}
