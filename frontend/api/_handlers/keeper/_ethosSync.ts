/**
 * POST /api/keeper/ethos-sync
 *
 * Keeper-internal Ethos hot-lane sync. Detects score updates and persists
 * them into Supabase cache tables so read paths stay DB-deterministic.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  getDbForCron,
  isDbConfigured,
} from '../../../packages/server-core/src/index.js'
import { syncEthosScoreUpdates } from '../../../server/_lib/identity/ethosCanonicalScores.js'
import {
  pickCreatorEthosProjectionRefreshMode,
  refreshCreatorEthosProjection,
} from '../../../server/_lib/zora/creatorEthosProjection.js'

function readInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function enabled(): boolean {
  const raw = String(process.env.ETHOS_CANONICAL_SCORE_SYNC_ENABLED ?? '').trim().toLowerCase()
  if (!raw) return true
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function projectionHotEnabled(): boolean {
  const raw = String(process.env.ETHOS_CREATOR_PROJECTION_HOT_ENABLED ?? '').trim().toLowerCase()
  if (!raw) return true
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

type KeeperEthosSyncResponse = {
  updates: {
    pages: number
    updatesSeen: number
    refreshedUserkeys: number
    cursorAfter: string | null
  }
  limits: {
    updatePageLimit: number
    updateMaxPages: number
    creatorProjectionHotLimit: number
  }
  creatorProjection: {
    refreshedRows: number
    appliedLimit: number
    available: boolean
  } | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  if (!enabled()) {
    return res.status(503).json({ success: false, error: 'feature_disabled' } satisfies ApiEnvelope<never>)
  }
  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'db_not_configured' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('keeper-ethos-sync', getClientIp(req)),
    RATE_LIMITS.creRuntimeTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const db = await getDbForCron()
  if (!db) {
    return res.status(503).json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }

  const updatePageLimit = readInt(process.env.ETHOS_SCORE_UPDATES_PAGE_LIMIT_HOT, 200, 1, 1000)
  const updateMaxPages = readInt(process.env.ETHOS_SCORE_UPDATES_MAX_PAGES_HOT, 2, 1, 20)
  const creatorProjectionHotLimit = readInt(process.env.ETHOS_CREATOR_PROJECTION_HOT_LIMIT, 2000, 100, 250000)

  try {
    const updates = await syncEthosScoreUpdates({
      db,
      pageLimit: updatePageLimit,
      maxPages: updateMaxPages,
    })
    const creatorProjection = projectionHotEnabled()
      ? await refreshCreatorEthosProjection({
          db,
          limit: creatorProjectionHotLimit,
          mode: pickCreatorEthosProjectionRefreshMode('hot'),
        })
      : null
    return res.status(200).json({
      success: true,
      data: {
        updates,
        creatorProjection,
        limits: {
          updatePageLimit,
          updateMaxPages,
          creatorProjectionHotLimit,
        },
      },
    } satisfies ApiEnvelope<KeeperEthosSyncResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ethos_sync_failed'
    return res.status(500).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }
}
