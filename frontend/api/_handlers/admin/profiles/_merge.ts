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
} from '@4626/server-core'

import { logAdminAction } from '../../../../server/_lib/admin/adminAudit.js'
import {
  executeProfileMergeInTransaction,
  planProfileMerge,
  ProfileMergeValidationError,
  type ProfileMergePlan,
  type ProfileMergeResult,
} from '../../../../server/_lib/identity/profileMerge.js'

declare const process: { env: Record<string, string | undefined> }

const BODY_MAX_BYTES = 16_384
const EXECUTE_CONFIRMATION = 'MERGE-PROFILES'

type Body = {
  fromProfileId?: number | string
  toProfileId?: number | string
  mode?: 'dry_run' | 'execute'
  confirm?: string | null
}

type DryRunSummary = ProfileMergePlan & { mode: 'dry_run' }
type ExecuteSummary = ProfileMergePlan & { mode: 'execute'; result: ProfileMergeResult }

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

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
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

  // Dual auth: admin session + CRON_SECRET. A browser-only admin can't fire this.
  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }
  if (!isMachineAuthOk(req)) {
    return res.status(403).json({
      success: false,
      error: 'Machine auth required (Authorization: Bearer $CRON_SECRET)',
    } satisfies ApiEnvelope<never>)
  }

  const rate = checkRateLimit(
    rateLimitKey('admin-merge-profiles', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  let rawBody: unknown
  try {
    rawBody = await readBoundedJsonObjectBody(req, { maxBytes: BODY_MAX_BYTES })
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(rawBody) as Body
  const fromProfileId = toInteger(body.fromProfileId)
  const toProfileId = toInteger(body.toProfileId)
  if (fromProfileId === null || toProfileId === null) {
    return res.status(400).json({
      success: false,
      error: 'fromProfileId and toProfileId must be positive integers',
    } satisfies ApiEnvelope<never>)
  }
  const mode = body.mode === 'execute' ? 'execute' : 'dry_run'
  if (mode === 'execute' && body.confirm !== EXECUTE_CONFIRMATION) {
    return res.status(400).json({
      success: false,
      error: `Execute mode requires confirm='${EXECUTE_CONFIRMATION}'`,
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const plan = await planProfileMerge(db as any, fromProfileId, toProfileId)
    const ipAddress = getClientIp(req)

    if (mode === 'dry_run') {
      await logAdminAction({
        db: db as any,
        adminAddress: admin,
        action: 'profile_merge_dry_run',
        targetType: 'profile',
        targetId: `${fromProfileId}->${toProfileId}`,
        details: {
          from: plan.from.id,
          to: plan.to.id,
          pointsRowsToMove: plan.pointsRowsToMove,
          pointsRowsSkippedAsDuplicate: plan.pointsRowsSkippedAsDuplicate,
          referralConversionsToRepoint: plan.referralConversionsToRepoint,
          refereesToRepoint: plan.refereesToRepoint,
        },
        ipAddress,
      })
      return res.status(200).json({
        success: true,
        data: { ...plan, mode: 'dry_run' } satisfies DryRunSummary,
      } satisfies ApiEnvelope<DryRunSummary>)
    }

    const result = await executeProfileMergeInTransaction(plan)
    await logAdminAction({
      db: db as any,
      adminAddress: admin,
      action: 'profile_merge_execute',
      targetType: 'profile',
      targetId: `${fromProfileId}->${toProfileId}`,
      details: { ...result, from: plan.from.id, to: plan.to.id },
      ipAddress,
    })
    logger.info('[profile-merge] completed', {
      admin: admin.toLowerCase(),
      from: plan.from.id,
      to: plan.to.id,
      ...result,
    })
    return res.status(200).json({
      success: true,
      data: { ...plan, mode: 'execute', result } satisfies ExecuteSummary,
    } satisfies ApiEnvelope<ExecuteSummary>)
  } catch (err) {
    if (err instanceof ProfileMergeValidationError) {
      return res.status(400).json({
        success: false,
        error: `${err.code}: ${err.message}`,
      } satisfies ApiEnvelope<never>)
    }
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[profile-merge] failed', { admin: admin.toLowerCase(), message })
    return res.status(500).json({
      success: false,
      error: `Merge failed: ${message}`,
    } satisfies ApiEnvelope<never>)
  }
}
