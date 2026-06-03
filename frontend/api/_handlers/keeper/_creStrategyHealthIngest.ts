import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  getDbForCron,
  handleOptions,
  isDbConfigured,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { ensureKeeperCreSchema } from '../../../server/_lib/db/schemaBootstrap.js'
import {
  buildAttestationDedupeKey,
  deriveCreReportId,
  normalizeAddress,
  normalizeReportIdHex,
  upsertKeeperCreAttestation,
  upsertKeeperCreStrategyHealth,
} from '../../../server/_lib/keeper/creAttestations.js'

type CreStrategyHealthIngestBody = {
  vaultAddress?: string
  strategyAddress?: string
  status?: 'healthy' | 'degraded' | 'stale' | 'unknown'
  confidenceBps?: number
  reportTimestampMs?: number
  source?: string
  attestationDigest?: string
  reportId?: string
  metadata?: Record<string, unknown>
}

type CreStrategyHealthIngestResponse = {
  attestationId: number
  dedupeKey: string
  reportId: string
  persisted: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-cre-strategy-health-ingest', getClientIp(req)),
    RATE_LIMITS.keeperIngestWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }
  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'db_not_configured' } satisfies ApiEnvelope<never>)
  }

  const db = await getDbForCron()
  if (!db) {
    return res.status(503).json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureKeeperCreSchema(db)

  const body = (await readBoundedJsonObjectBody<CreStrategyHealthIngestBody>(req, { maxBytes: 65_536 })) ?? {}
  const vaultAddress = normalizeAddress(body.vaultAddress)
  const strategyAddress = normalizeAddress(body.strategyAddress)
  if (!vaultAddress || !strategyAddress) {
    return res.status(400).json({ success: false, error: 'invalid_vault_or_strategy_address' } satisfies ApiEnvelope<never>)
  }
  const status = body.status
  if (!status || !['healthy', 'degraded', 'stale', 'unknown'].includes(status)) {
    return res.status(400).json({ success: false, error: 'invalid_strategy_health_status' } satisfies ApiEnvelope<never>)
  }

  const confidenceBps = Math.max(0, Math.min(10_000, Math.floor(Number(body.confidenceBps ?? 0))))
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 200) : ''
  if (!source) {
    return res.status(400).json({ success: false, error: 'invalid_source' } satisfies ApiEnvelope<never>)
  }
  const reportTimestampMs =
    typeof body.reportTimestampMs === 'number' && Number.isFinite(body.reportTimestampMs)
      ? Math.floor(body.reportTimestampMs)
      : Date.now()
  const reportTimestamp = new Date(reportTimestampMs)
  if (!Number.isFinite(reportTimestamp.getTime())) {
    return res.status(400).json({ success: false, error: 'invalid_report_timestamp' } satisfies ApiEnvelope<never>)
  }

  const reportId =
    normalizeReportIdHex(body.reportId) ??
    deriveCreReportId([vaultAddress, strategyAddress, status, confidenceBps, reportTimestamp.toISOString(), source])
  const dedupeKey = buildAttestationDedupeKey({
    attestationKind: 'strategy_health',
    primaryAddress: strategyAddress,
    reportId,
  })

  await upsertKeeperCreStrategyHealth(db, {
    vaultAddress,
    strategyAddress,
    status,
    confidenceBps,
    reportTimestamp: reportTimestamp.toISOString(),
    source,
    attestationDigest: typeof body.attestationDigest === 'string' ? body.attestationDigest.slice(0, 256) : null,
    metadata:
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
  })

  const attestationId = await upsertKeeperCreAttestation(db, {
    dedupeKey,
    attestationKind: 'strategy_health',
    status: 'ingested',
    source,
    payload: {
      vaultAddress,
      strategyAddress,
      status,
      confidenceBps,
      reportTimestampMs,
      reportId,
      metadata:
        body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
          ? body.metadata
          : {},
    },
    vaultAddress,
    strategyAddress,
    reportId,
    reportTimestamp: reportTimestamp.toISOString(),
    attestationDigest: typeof body.attestationDigest === 'string' ? body.attestationDigest.slice(0, 256) : null,
    decision: {
      mode: 'persisted',
      confidenceBps,
      status,
    },
  })

  return res.status(200).json({
    success: true,
    data: {
      attestationId,
      dedupeKey,
      reportId,
      persisted: true,
    },
  } satisfies ApiEnvelope<CreStrategyHealthIngestResponse>)
}
