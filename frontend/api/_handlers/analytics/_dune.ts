import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, setCache, setCors } from '../../../server/zora/_shared.js'
import { setNoStore } from '../../../packages/server-core/src/index.js'
import { isDuneConfigured, runDuneSqlRows } from '../../../server/_lib/dune/duneApi.js'
import { isDuneMetricKey, listDuneMetricKeys, loadDuneMetricSql } from '../../../server/_lib/dune/duneMetricSql.js'

type DuneCacheEntry = { rows: Array<Record<string, unknown>>; cachedAt: number }

const METRIC_CACHE_TTL_MS = 15 * 60_000
const metricCache = new Map<string, DuneCacheEntry>()

function getStringQuery(req: VercelRequest, key: string): string | null {
  const raw = req.query?.[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const probe = getStringQuery(req, 'probe') === '1'
  const metric = getStringQuery(req, 'metric')

  if (!isDuneConfigured()) {
    setNoStore(res)
    return res.status(503).json({
      success: false,
      error: 'dune_not_configured',
      data: {
        configured: false,
        metrics: listDuneMetricKeys(),
        dashboardUrl: String(process.env.VITE_DUNE_DASHBOARD_URL ?? '').trim() || null,
      },
    })
  }

  if (probe) {
    try {
      const rows = await runDuneSqlRows('SELECT 1 AS ok', { performance: 'small', maxWaitMs: 30_000 })
      setNoStore(res)
      return res.status(200).json({
        success: true,
        data: {
          configured: true,
          probe: 'ok',
          rows,
        },
      })
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : 502
      setNoStore(res)
      return res.status(status).json({
        success: false,
        error: e?.message ?? 'dune_probe_failed',
      })
    }
  }

  if (!metric) {
    setCache(res, 300)
    return res.status(200).json({
      success: true,
      data: {
        configured: true,
        metrics: listDuneMetricKeys(),
        usage: 'GET /api/analytics/dune?metric=batcher-tx | probe=1',
        dashboardUrl: String(process.env.VITE_DUNE_DASHBOARD_URL ?? '').trim() || null,
      },
    })
  }

  if (!isDuneMetricKey(metric)) {
    setNoStore(res)
    return res.status(400).json({
      success: false,
      error: 'invalid_metric',
      data: { allowed: listDuneMetricKeys() },
    })
  }

  const now = Date.now()
  const cached = metricCache.get(metric)
  if (cached && now - cached.cachedAt < METRIC_CACHE_TTL_MS) {
    setCache(res, 120)
    return res.status(200).json({
      success: true,
      data: { metric, rows: cached.rows, cached: true, cachedAt: new Date(cached.cachedAt).toISOString() },
    })
  }

  try {
    const sql = loadDuneMetricSql(metric)
    const rows = await runDuneSqlRows(sql, { performance: 'medium', maxWaitMs: 60_000 })
    metricCache.set(metric, { rows, cachedAt: now })
    setCache(res, 120)
    return res.status(200).json({
      success: true,
      data: { metric, rows, cached: false, cachedAt: new Date(now).toISOString() },
    })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    setNoStore(res)
    return res.status(status).json({
      success: false,
      error: e?.message ?? 'dune_metric_failed',
      data: { metric },
    })
  }
}
