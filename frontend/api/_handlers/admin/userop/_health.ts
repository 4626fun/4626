import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  getSessionAddress,
  isAdminAddress,
} from '../../../../packages/server-core/src/index.js'

/**
 * Admin-only aggregate view of ERC-4337 UserOp telemetry submitted by the
 * browser via POST /api/v1/chat/telemetry (event = 'xmtp_userop_submission_batch').
 *
 * Source: chat_command_center_events table. Telemetry is sampled + batched, so
 * these numbers are indicative rather than exhaustive. Each batch payload
 * already contains success/error/timeout counts and p50/p95/p99 durations,
 * so we sum those across recent batches per window.
 */

export type SignatureModeStat = { mode: string; count: number }
export type PaymasterModeStat = { mode: string; count: number }
export type SubmissionPathStat = { path: string; count: number }
type WindowStats = {
  batchCount: number
  totalSamples: number
  successCount: number
  errorCount: number
  timeoutCount: number
  successRate: number | null
  fallbackToSelfFundedCount: number
  fallbackRate: number | null
  ownerIsContractCount: number
  avgP50Ms: number | null
  avgP95Ms: number | null
  avgP99Ms: number | null
  signatureModeBreakdown: SignatureModeStat[]
  paymasterModeBreakdown: PaymasterModeStat[]
  submissionPathBreakdown: SubmissionPathStat[]
  topErrorCodes: Array<{ code: string; count: number }>
  firstEventAt: string | null
  lastEventAt: string | null
}

type UserOpHealthResponse = {
  admin: string
  source: 'chat_command_center_events'
  event: 'xmtp_userop_submission_batch'
  windows: {
    last24h: WindowStats
    last7d: WindowStats
  }
}

const ZERO_WINDOW: WindowStats = {
  batchCount: 0,
  totalSamples: 0,
  successCount: 0,
  errorCount: 0,
  timeoutCount: 0,
  successRate: null,
  fallbackToSelfFundedCount: 0,
  fallbackRate: null,
  ownerIsContractCount: 0,
  avgP50Ms: null,
  avgP95Ms: null,
  avgP99Ms: null,
  signatureModeBreakdown: [],
  paymasterModeBreakdown: [],
  submissionPathBreakdown: [],
  topErrorCodes: [],
  firstEventAt: null,
  lastEventAt: null,
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  return null
}

function bumpTopN(map: Map<string, number>, key: string, amount: number) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + amount)
}

function topN(map: Map<string, number>, n: number): Array<{ key: string; count: number }> {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
}

function roundOrNull(value: number | null, decimals = 0): number | null {
  if (value === null) return null
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

async function loadWindow(
  db: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<{ rows?: unknown[] }> },
  sinceIso: string,
): Promise<WindowStats> {
  const result = await db.sql`
    SELECT payload, created_at
    FROM chat_command_center_events
    WHERE event = 'xmtp_userop_submission_batch'
      AND created_at >= ${sinceIso}::timestamptz
    ORDER BY created_at DESC
    LIMIT 5000;
  `
  const rows = (result?.rows ?? []) as Array<{ payload?: unknown; created_at?: unknown }>
  if (rows.length === 0) return { ...ZERO_WINDOW }

  let totalSamples = 0
  let successCount = 0
  let errorCount = 0
  let timeoutCount = 0
  let fallbackToSelfFundedCount = 0
  let ownerIsContractCount = 0

  // Weight percentile averages by batch sampleCount so larger batches count proportionally.
  let p50Weighted = 0
  let p95Weighted = 0
  let p99Weighted = 0
  let percentileWeight = 0

  const signatureModes = new Map<string, number>()
  const paymasterModes = new Map<string, number>()
  const submissionPaths = new Map<string, number>()
  const errorCodes = new Map<string, number>()

  let firstEventAt: string | null = null
  let lastEventAt: string | null = null

  for (const row of rows) {
    const createdRaw = row?.created_at
    const createdIso =
      createdRaw instanceof Date
        ? createdRaw.toISOString()
        : typeof createdRaw === 'string'
          ? new Date(createdRaw).toISOString()
          : null
    if (createdIso) {
      if (!firstEventAt || createdIso < firstEventAt) firstEventAt = createdIso
      if (!lastEventAt || createdIso > lastEventAt) lastEventAt = createdIso
    }

    const payloadRaw = row?.payload
    let payload: Record<string, unknown> | null = null
    if (payloadRaw && typeof payloadRaw === 'object') {
      payload = payloadRaw as Record<string, unknown>
    } else if (typeof payloadRaw === 'string') {
      try {
        const parsed = JSON.parse(payloadRaw)
        if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>
      } catch {
        // skip malformed payloads
      }
    }
    if (!payload) continue

    const samples = asNumber(payload.sampleCount)
    totalSamples += samples
    successCount += asNumber(payload.successCount)
    errorCount += asNumber(payload.errorCount)
    timeoutCount += asNumber(payload.timeoutCount)

    // Prefer new generic fields, but fall back to the legacy flat shape so
    // older telemetry rows still contribute. Use explicit presence checks
    // rather than `||` so a legitimate zero in the new-shape row doesn't
    // silently read the legacy field (which can be non-zero on rows that
    // emit both shapes during the transition).
    const paymasterUsage =
      (payload.paymasterUsage as Record<string, unknown> | undefined) ?? null
    fallbackToSelfFundedCount +=
      payload.fallbackToSelfFundedCount !== undefined
        ? asNumber(payload.fallbackToSelfFundedCount)
        : asNumber(paymasterUsage?.fallbackToSelfFunded)
    const ownerType = (payload.ownerType as Record<string, unknown> | undefined) ?? null
    ownerIsContractCount +=
      payload.ownerIsContractCount !== undefined
        ? asNumber(payload.ownerIsContractCount)
        : asNumber(ownerType?.contract)

    const p50 = asNumber(payload.p50Ms)
    const p95 = asNumber(payload.p95Ms)
    const p99 = asNumber(payload.p99Ms)
    if (samples > 0) {
      p50Weighted += p50 * samples
      p95Weighted += p95 * samples
      p99Weighted += p99 * samples
      percentileWeight += samples
    }

    const sig =
      (payload.signatureModeBreakdown as Record<string, unknown> | undefined) ??
      (payload.signatureModes as Record<string, unknown> | undefined) ??
      null
    if (sig) {
      for (const [mode, count] of Object.entries(sig)) bumpTopN(signatureModes, mode, asNumber(count))
    }

    const pm =
      (payload.paymasterModeBreakdown as Record<string, unknown> | undefined) ??
      (payload.paymasterUsage as Record<string, unknown> | undefined) ??
      null
    if (pm) {
      for (const [mode, count] of Object.entries(pm)) bumpTopN(paymasterModes, mode, asNumber(count))
    }

    const sp = (payload.submissionPathBreakdown as Record<string, unknown> | undefined) ?? null
    if (sp) {
      for (const [path, count] of Object.entries(sp)) bumpTopN(submissionPaths, path, asNumber(count))
    }

    const errs = (payload.errorCodes as Record<string, unknown> | undefined) ?? null
    if (errs) {
      for (const [code, count] of Object.entries(errs)) bumpTopN(errorCodes, code, asNumber(count))
    }
  }

  const totalOutcomes = successCount + errorCount + timeoutCount
  const successRate = totalOutcomes > 0 ? successCount / totalOutcomes : null
  const fallbackRate = totalSamples > 0 ? fallbackToSelfFundedCount / totalSamples : null

  return {
    batchCount: rows.length,
    totalSamples,
    successCount,
    errorCount,
    timeoutCount,
    successRate: roundOrNull(successRate === null ? null : successRate * 100, 2),
    fallbackToSelfFundedCount,
    fallbackRate: roundOrNull(fallbackRate === null ? null : fallbackRate * 100, 2),
    ownerIsContractCount,
    avgP50Ms: percentileWeight > 0 ? Math.round(p50Weighted / percentileWeight) : null,
    avgP95Ms: percentileWeight > 0 ? Math.round(p95Weighted / percentileWeight) : null,
    avgP99Ms: percentileWeight > 0 ? Math.round(p99Weighted / percentileWeight) : null,
    signatureModeBreakdown: topN(signatureModes, 10).map(({ key, count }) => ({ mode: key, count })),
    paymasterModeBreakdown: topN(paymasterModes, 10).map(({ key, count }) => ({ mode: key, count })),
    submissionPathBreakdown: topN(submissionPaths, 10).map(({ key, count }) => ({ path: key, count })),
    topErrorCodes: topN(errorCodes, 10).map(({ key, count }) => ({ code: key, count })),
    firstEventAt,
    lastEventAt,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not configured (set POSTGRES_URL/DATABASE_URL).',
    } satisfies ApiEnvelope<never>)
  }

  const now = Date.now()
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [last24h, last7d] = await Promise.all([
    loadWindow(db as never, since24h).catch(() => ({ ...ZERO_WINDOW })),
    loadWindow(db as never, since7d).catch(() => ({ ...ZERO_WINDOW })),
  ])

  const data: UserOpHealthResponse = {
    admin,
    source: 'chat_command_center_events',
    event: 'xmtp_userop_submission_batch',
    windows: { last24h, last7d },
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<UserOpHealthResponse>)
}

export type { UserOpHealthResponse, WindowStats }
