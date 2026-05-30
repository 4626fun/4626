// Repo-root script; not on the frontend tsconfig.node surface.
// @ts-expect-error resolved at deploy bundle time
import { run1659RiskTick } from '../../../../scripts/ops/1659-risk-watcher.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Internal API endpoint called by the keeper job runner
 * when a job of kind "1659_hype_risk_monitor" is processed.
 *
 * This lets the entire risk watcher be managed as a first-class
 * keeper job (recurring via cron enqueuers, claimable, trackable, etc.).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const result = await run1659RiskTick({ once: true })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('[keeper] 1659-risk-monitor failed', error)
    return res.status(500).json({
      success: false,
      error: error?.message || 'internal_error',
    })
  }
}