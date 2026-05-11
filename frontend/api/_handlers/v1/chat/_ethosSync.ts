import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getDb, isDbConfigured } from '../../../../server/_lib/db/postgres.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import {
  materializeCanonicalEthosScores,
  seedEthosIdentityKeys,
  syncEthosScoreUpdates,
  syncEthosUserkeyScores,
} from '../../../../server/_lib/identity/ethosCanonicalScores.js'

declare const process: { env: Record<string, string | undefined> }

function readInt(value: string | undefined, fallback: number, min = 1, max = 10_000): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.floor(parsed)))
}

function syncEnabled(): boolean {
  const raw = String(process.env.ETHOS_CANONICAL_SCORE_SYNC_ENABLED ?? '').trim().toLowerCase()
  if (!raw) return true
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  if (!syncEnabled()) {
    res.status(503).json({ ok: false, error: 'feature_disabled' })
    return
  }
  if (!isAuthorizedCron(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }
  if (!isDbConfigured()) {
    res.status(503).json({ ok: false, error: 'db_not_configured' })
    return
  }

  const db = await getDb()
  if (!db) {
    res.status(503).json({ ok: false, error: 'db_unavailable' })
    return
  }

  const seedLimit = readInt(process.env.ETHOS_SCORE_IDENTITY_SEED_LIMIT, 1000, 1, 10_000)
  const scoreSyncLimit = readInt(process.env.ETHOS_SCORE_SYNC_LIMIT, 1000, 1, 10_000)
  const updatePageLimit = readInt(process.env.ETHOS_SCORE_UPDATES_PAGE_LIMIT, 500, 1, 1000)
  const updateMaxPages = readInt(process.env.ETHOS_SCORE_UPDATES_MAX_PAGES, 5, 1, 20)

  try {
    const seeded = await seedEthosIdentityKeys({
      db,
      limit: seedLimit,
    })
    const synced = await syncEthosUserkeyScores({
      db,
      limit: scoreSyncLimit,
      chunkSize: 100,
    })
    const rollupAfterSync = await materializeCanonicalEthosScores({
      db,
      userkeys: synced.processedUserkeys,
      limit: scoreSyncLimit,
    })
    const updates = await syncEthosScoreUpdates({
      db,
      pageLimit: updatePageLimit,
      maxPages: updateMaxPages,
    })

    console.info('[ethos-canonical-sync] tick', {
      seeded,
      synced,
      rollupAfterSync,
      updates,
    })

    res.status(200).json({
      ok: true,
      seeded,
      synced,
      rollupAfterSync,
      updates,
      limits: {
        seedLimit,
        scoreSyncLimit,
        updatePageLimit,
        updateMaxPages,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    console.warn('[ethos-canonical-sync] failed', { error: message })
    res.status(200).json({
      ok: false,
      error: message.slice(0, 500),
    })
  }
}
