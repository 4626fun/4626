import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
} from '../../../../packages/server-core/src/index.js'




type CandidateRow = {
  schemaname: string
  tablename: string
  indexname: string
  sampleCount: number
  sampleWindow: string
  idxScanDelta: number
  tableWritesDelta: number
  indexSize: string
  dropSql: string
  rollbackSql: string
}

type IndexUsageResponse = {
  admin: string
  capturedRows: number
  minDays: number
  minSamples: number
  minTableWrites: number
  candidateCount: number
  draftSql: string
  candidates?: CandidateRow[]
}

function parseIntParam(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function parseBooleanParam(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback
  const raw = value.trim().toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return fallback
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

  if (!isDbConfigured()) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  const minDays = parseIntParam((req.query as any)?.minDays, 14, 0, 365)
  const minSamples = parseIntParam((req.query as any)?.minSamples, 2, 1, 1000)
  const minTableWrites = parseIntParam((req.query as any)?.minTableWrites, 0, 0, Number.MAX_SAFE_INTEGER)
  const capture = parseBooleanParam((req.query as any)?.capture, true)
  const includeCandidates = parseBooleanParam((req.query as any)?.includeCandidates, false)
  const candidateLimit = parseIntParam((req.query as any)?.candidateLimit, 100, 1, 500)

  try {
    const capabilityCheck = await db.sql`
      SELECT
        to_regprocedure('public.capture_index_usage_snapshot()') AS capture_proc,
        to_regprocedure('public.index_drop_migration_draft(integer,integer,bigint)') AS draft_proc,
        to_regprocedure('public.index_drop_candidates(integer,integer,bigint)') AS candidates_proc;
    `
    const capability = capabilityCheck.rows?.[0] as
      | { capture_proc?: string | null; draft_proc?: string | null; candidates_proc?: string | null }
      | undefined
    if (!capability?.capture_proc || !capability?.draft_proc || !capability?.candidates_proc) {
      return res.status(409).json({
        success: false,
        error: 'index_usage_monitoring_not_initialized',
      } satisfies ApiEnvelope<never>)
    }

    const capturedRows = capture
      ? Number((await db.sql`SELECT public.capture_index_usage_snapshot() AS inserted_count;`).rows?.[0]?.inserted_count ?? 0)
      : 0

    const countResult = await db.sql`
      SELECT COUNT(*)::int AS count
      FROM public.index_drop_candidates(${minDays}, ${minSamples}, ${minTableWrites});
    `
    const candidateCount = Number(countResult.rows?.[0]?.count ?? 0)

    const draftResult = await db.sql`
      SELECT public.index_drop_migration_draft(${minDays}, ${minSamples}, ${minTableWrites}) AS draft_sql;
    `
    const draftSql = String(draftResult.rows?.[0]?.draft_sql ?? '-- no draft returned')

    let candidates: CandidateRow[] | undefined
    if (includeCandidates) {
      const rows = await db.sql`
        SELECT
          schemaname,
          tablename,
          indexname,
          sample_count,
          sample_window,
          idx_scan_delta,
          table_writes_delta,
          index_size_pretty,
          drop_sql,
          rollback_sql
        FROM public.index_drop_candidates(${minDays}, ${minSamples}, ${minTableWrites})
        LIMIT ${candidateLimit};
      `
      candidates = (rows.rows ?? []).map((row: any) => ({
        schemaname: String(row.schemaname ?? ''),
        tablename: String(row.tablename ?? ''),
        indexname: String(row.indexname ?? ''),
        sampleCount: Number(row.sample_count ?? 0),
        sampleWindow: String(row.sample_window ?? ''),
        idxScanDelta: Number(row.idx_scan_delta ?? 0),
        tableWritesDelta: Number(row.table_writes_delta ?? 0),
        indexSize: String(row.index_size_pretty ?? ''),
        dropSql: String(row.drop_sql ?? ''),
        rollbackSql: String(row.rollback_sql ?? ''),
      }))
    }

    return res.status(200).json({
      success: true,
      data: {
        admin,
        capturedRows,
        minDays,
        minSamples,
        minTableWrites,
        candidateCount,
        draftSql,
        ...(candidates ? { candidates } : {}),
      } satisfies IndexUsageResponse,
    } satisfies ApiEnvelope<IndexUsageResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'index_usage_monitoring_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
