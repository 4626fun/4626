import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  getDbForCron,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'

type KeeperJobHealth = {
  retry: number
  failed: number
  expiredClaims: number
  claimed: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  try {
    const db = await getDbForCron()
    if (!db) {
      return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
    }
    const result = await db.sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'retry')::int AS retry,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (
          WHERE status = 'claimed'
            AND claim_expires_at IS NOT NULL
            AND claim_expires_at <= NOW()
        )::int AS expired_claims,
        COUNT(*) FILTER (WHERE status = 'claimed')::int AS claimed
      FROM keeper_jobs;
    `
    const row = result.rows?.[0] ?? {}
    return res.status(200).json({
      success: true,
      data: {
        retry: Number(row.retry ?? 0),
        failed: Number(row.failed ?? 0),
        expiredClaims: Number(row.expired_claims ?? 0),
        claimed: Number(row.claimed ?? 0),
      },
    } satisfies ApiEnvelope<KeeperJobHealth>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'keeper_job_health_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
