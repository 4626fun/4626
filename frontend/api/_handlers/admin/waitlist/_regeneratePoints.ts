import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  logger,
} from '../../../../packages/server-core/src/index.js'

import { ensureWaitlistSchema } from '../../../../server/_lib/onboarding/waitlistSchema.js'
import { logAdminAction } from '../../../../server/_lib/admin/adminAudit.js'
import {
  CANONICAL_POINT_VALUES,
  EXCLUDED_FROM_TOPUP,
  executePointsBackfill,
  planPointsBackfill,
  type BackfillPlan,
} from '../../../../server/_lib/onboarding/pointsBackfill.js'

declare const process: { env: Record<string, string | undefined> }

const BODY_MAX_BYTES = 16_384
const EXECUTE_CONFIRMATION = 'REGENERATE-POINTS'

type Body = {
  mode?: 'dry_run' | 'execute'
  confirm?: string | null
  limit?: number | null
}

type BaseSummary = {
  topupCandidates: number
  passthroughCandidates: number
  missingBaselineCandidates: number
  missingLinkEmailCandidates: number
  totalTopupDelta: number
  topupsBySource: Record<string, { count: number; totalDelta: number }>
  unknownSourcesObserved: string[]
  canonicalValues: Record<string, number>
  excludedFromTopup: Record<string, string>
}

type DryRunSummary = BaseSummary & { mode: 'dry_run' }

type ExecuteSummary = BaseSummary & {
  mode: 'execute'
  topupsInserted: number
  passthroughsInserted: number
  passthroughsSkipped: number
  baselinesInserted: number
  linkEmailsInserted: number
}

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function readCronSecretFromHeaders(req: VercelRequest): string {
  const cronHeader = req.headers['x-cron-secret']
  if (Array.isArray(cronHeader) && cronHeader[0]) return String(cronHeader[0]).trim()
  if (typeof cronHeader === 'string' && cronHeader.trim()) return cronHeader.trim()
  const authHeader = (req.headers.authorization ?? '').trim()
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (match?.[1]) return match[1].trim()
  return ''
}

function isMachineAuthOk(req: VercelRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim()
  if (!secret) return false
  return readCronSecretFromHeaders(req) === secret
}

function toBaseSummary(plan: BackfillPlan): BaseSummary {
  const totalTopupDelta = plan.topups.reduce((sum, t) => sum + t.delta, 0)
  return {
    topupCandidates: plan.topups.length,
    passthroughCandidates: plan.passthroughs.length,
    missingBaselineCandidates: plan.missingBaselines.length,
    missingLinkEmailCandidates: plan.missingLinkEmails.length,
    totalTopupDelta,
    topupsBySource: plan.topupsBySource,
    unknownSourcesObserved: plan.unknownSourcesObserved,
    canonicalValues: CANONICAL_POINT_VALUES as Record<string, number>,
    excludedFromTopup: EXCLUDED_FROM_TOPUP as Record<string, string>,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    } satisfies ApiEnvelope<never>)
  }

  // ── Auth: defense in depth ─────────────────────────────────────────────
  // 1. Known-human admin session (same gate as other admin/waitlist/*)
  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({
      success: false,
      error: 'Sign in required',
    } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({
      success: false,
      error: 'Admin only',
    } satisfies ApiEnvelope<never>)
  }
  // 2. Machine-auth secret — so a logged-in admin in a browser can't fire
  //    this by accident. Header-only; query-string transport is rejected.
  if (!isMachineAuthOk(req)) {
    return res.status(403).json({
      success: false,
      error: 'Machine auth required (Authorization: Bearer $CRON_SECRET or x-cron-secret)',
    } satisfies ApiEnvelope<never>)
  }

  const rate = checkRateLimit(
    rateLimitKey('admin-regen-points', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
    } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Database not configured',
    } satisfies ApiEnvelope<never>)
  }

  let rawBody: unknown
  try {
    rawBody = await readBoundedJsonObjectBody(req, { maxBytes: BODY_MAX_BYTES })
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body',
    } satisfies ApiEnvelope<never>)
  }
  const body = asObjectBody(rawBody) as Body
  const mode = body.mode === 'execute' ? 'execute' : 'dry_run'
  const limit =
    typeof body.limit === 'number' && Number.isFinite(body.limit) && body.limit > 0
      ? Math.floor(body.limit)
      : undefined

  if (mode === 'execute' && body.confirm !== EXECUTE_CONFIRMATION) {
    return res.status(400).json({
      success: false,
      error: `Execute mode requires confirm='${EXECUTE_CONFIRMATION}'`,
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable',
    } satisfies ApiEnvelope<never>)
  }

  try {
    await ensureWaitlistSchema(db)
    const plan = await planPointsBackfill(db, { limit })
    const base = toBaseSummary(plan)

    const ipAddress = getClientIp(req)

    if (mode === 'dry_run') {
      const summary: DryRunSummary = { ...base, mode: 'dry_run' }
      await logAdminAction({
        db,
        adminAddress: admin,
        action: 'waitlist_regenerate_points_dry_run',
        targetType: 'profile',
        targetId: 'all',
        details: {
          topupCandidates: base.topupCandidates,
          passthroughCandidates: base.passthroughCandidates,
          missingBaselineCandidates: base.missingBaselineCandidates,
          missingLinkEmailCandidates: base.missingLinkEmailCandidates,
          totalTopupDelta: base.totalTopupDelta,
          unknownSourcesObserved: base.unknownSourcesObserved,
        },
        ipAddress,
      })
      return res.status(200).json({
        success: true,
        data: summary,
      } satisfies ApiEnvelope<DryRunSummary>)
    }

    // execute mode
    const result = await executePointsBackfill(db, plan)
    const executeSummary: ExecuteSummary = {
      ...base,
      mode: 'execute',
      topupsInserted: result.topupsInserted,
      passthroughsInserted: result.passthroughsInserted,
      passthroughsSkipped: result.passthroughsSkipped,
      baselinesInserted: result.baselinesInserted,
      linkEmailsInserted: result.linkEmailsInserted,
    }
    await logAdminAction({
      db,
      adminAddress: admin,
      action: 'waitlist_regenerate_points_execute',
      targetType: 'profile',
      targetId: 'all',
      details: {
        topupsInserted: result.topupsInserted,
        passthroughsInserted: result.passthroughsInserted,
        passthroughsSkipped: result.passthroughsSkipped,
        baselinesInserted: result.baselinesInserted,
        linkEmailsInserted: result.linkEmailsInserted,
        totalTopupDelta: base.totalTopupDelta,
      },
      ipAddress,
    })
    logger.info('[regenerate-points] completed', {
      admin: admin.toLowerCase(),
      ...result,
    })
    return res.status(200).json({
      success: true,
      data: executeSummary,
    } satisfies ApiEnvelope<ExecuteSummary>)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[regenerate-points] failed', { admin: admin.toLowerCase(), message })
    return res.status(500).json({
      success: false,
      error: `Regeneration failed: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}
