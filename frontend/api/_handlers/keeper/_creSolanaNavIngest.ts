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
import { enqueueKeeperJob, type KeeperJob } from '../../../server/_lib/keeperJobs/keeperJobs.js'
import {
  buildAttestationDedupeKey,
  deriveCreReportId,
  normalizeAddress,
  normalizeReportIdHex,
  parseBooleanFlag,
  upsertKeeperCreAttestation,
} from '../../../server/_lib/keeper/creAttestations.js'

type CreSolanaNavIngestBody = {
  strategyAddress?: string
  vaultAddress?: string
  creatorTokenAddress?: string
  reportId?: string
  reportedRemoteNav?: string | number
  reportTimestampMs?: number
  source?: string
  attestationDigest?: string
  metadata?: Record<string, unknown>
  forceWrite?: boolean
}

type CreSolanaNavIngestResponse = {
  attestationId: number
  dedupeKey: string
  reportId: string
  queuedJob: KeeperJob | null
  mode: 'shadow_only' | 'queued'
  reason: string
}

function parseNavValue(input: unknown): bigint | null {
  if (typeof input === 'number' && Number.isFinite(input) && input >= 0) return BigInt(Math.floor(input))
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

function readSource(input: unknown): string {
  const source = typeof input === 'string' ? input.trim() : ''
  return source.slice(0, 200)
}

function allowlistIncludes(address: string): boolean {
  const raw = String(process.env.CRE_SOLANA_NAV_STRATEGY_ALLOWLIST ?? '')
  const normalized = address.toLowerCase()
  const entries = raw
    .split(/[\s,]+/g)
    .map((entry) => normalizeAddress(entry))
    .filter((entry): entry is `0x${string}` => Boolean(entry))
  if (entries.length === 0) return true
  return entries.includes(normalized as `0x${string}`)
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
    rateLimitKey('keeper-cre-solana-nav-ingest', getClientIp(req)),
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

  const body = (await readBoundedJsonObjectBody<CreSolanaNavIngestBody>(req, { maxBytes: 65_536 })) ?? {}
  const strategyAddress = normalizeAddress(body.strategyAddress)
  if (!strategyAddress) {
    return res.status(400).json({ success: false, error: 'invalid_strategy_address' } satisfies ApiEnvelope<never>)
  }
  if (!allowlistIncludes(strategyAddress)) {
    return res.status(403).json({ success: false, error: 'strategy_not_allowlisted' } satisfies ApiEnvelope<never>)
  }

  const navValue = parseNavValue(body.reportedRemoteNav)
  if (navValue === null) {
    return res.status(400).json({ success: false, error: 'invalid_reported_remote_nav' } satisfies ApiEnvelope<never>)
  }
  const source = readSource(body.source)
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
    deriveCreReportId([strategyAddress, navValue.toString(), reportTimestamp.toISOString(), source, body.attestationDigest ?? ''])
  const dedupeKey = buildAttestationDedupeKey({
    attestationKind: 'solana_nav',
    primaryAddress: strategyAddress,
    reportId,
  })

  const shadowOnlyEnv = parseBooleanFlag(process.env.CRE_SOLANA_NAV_SHADOW_ONLY, true)
  const writeEnabledEnv = parseBooleanFlag(process.env.CRE_SOLANA_NAV_WRITE_ENABLED, false)
  const forceWrite = body.forceWrite === true
  const shouldQueueWrite = writeEnabledEnv && (!shadowOnlyEnv || forceWrite)

  const payload: Record<string, unknown> = {
    strategyAddress,
    vaultAddress: normalizeAddress(body.vaultAddress),
    creatorTokenAddress: normalizeAddress(body.creatorTokenAddress),
    reportId,
    reportedRemoteNav: navValue.toString(),
    reportTimestampMs,
    source,
    attestationDigest: typeof body.attestationDigest === 'string' ? body.attestationDigest.slice(0, 256) : null,
    metadata:
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata
        : {},
  }

  const attestationId = await upsertKeeperCreAttestation(db, {
    dedupeKey,
    attestationKind: 'solana_nav',
    status: shouldQueueWrite ? 'ingested' : 'shadow_only',
    source,
    payload,
    strategyAddress,
    vaultAddress: normalizeAddress(body.vaultAddress),
    creatorTokenAddress: normalizeAddress(body.creatorTokenAddress),
    reportId,
    navValue: navValue.toString(),
    reportTimestamp: reportTimestamp.toISOString(),
    attestationDigest: typeof body.attestationDigest === 'string' ? body.attestationDigest.slice(0, 256) : null,
    decision: {
      mode: shouldQueueWrite ? 'queue_write' : 'shadow_only',
      shadowOnlyEnv,
      writeEnabledEnv,
      forceWrite,
    },
  })

  let queuedJob: KeeperJob | null = null
  if (shouldQueueWrite) {
    queuedJob = await enqueueKeeperJob({
      kind: 'internal_api',
      dedupeKey: `cre-solana-nav:${strategyAddress}:${reportId}`,
      source: 'keeper-cre-solana-nav',
      payload: {
        path: '/api/keeper/cre-solana-nav-update',
        body: {
          attestationId,
          strategyAddress,
          reportId,
          reportedRemoteNav: navValue.toString(),
          source,
          reportTimestampMs,
        },
      },
      maxAttempts: 3,
    })
    await upsertKeeperCreAttestation(db, {
      dedupeKey,
      attestationKind: 'solana_nav',
      status: 'queued',
      source,
      payload,
      strategyAddress,
      reportId,
      navValue: navValue.toString(),
      reportTimestamp: reportTimestamp.toISOString(),
      executionJobId: queuedJob.id,
      decision: {
        mode: 'queued',
        jobId: queuedJob.id,
      },
    })
  }

  const response: CreSolanaNavIngestResponse = {
    attestationId,
    dedupeKey,
    reportId,
    queuedJob,
    mode: shouldQueueWrite ? 'queued' : 'shadow_only',
    reason: shouldQueueWrite ? 'write_enqueued' : 'shadow_mode_or_write_disabled',
  }
  console.info('[keeper/cre-solana-nav-ingest] decision', response)
  return res.status(200).json({ success: true, data: response } satisfies ApiEnvelope<CreSolanaNavIngestResponse>)
}
