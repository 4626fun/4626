/**
 * POST /api/keeper/rebalance-strategies
 *
 * HTTP bridge for cross-strategy TVL rebalancing via rebalanceStrategies().
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '@4626/server-core'
import { executeVaultRebalanceStrategies } from '../../../server/_lib/controlPlane/executors/keeperVaultActions.js'
import { parseMinDeviationBps } from '../../../server/_lib/keeper/strategyReallocEnv.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const limiter = checkRateLimit(
    rateLimitKey('keeper-rebalance-strategies', getClientIp(req)),
    RATE_LIMITS.keeperTriggerWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as {
    vaultAddress?: string
    minDeviationBps?: string | number
  } | null
  const vaultAddress = typeof body?.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  if (!vaultAddress || !vaultAddress.startsWith('0x') || vaultAddress.length !== 42) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }

  const minDeviationBps = BigInt(parseMinDeviationBps(body?.minDeviationBps))

  try {
    const result = await executeVaultRebalanceStrategies(vaultAddress, minDeviationBps)
    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<{ txHash: string; status: string }>)
  } catch (err) {
    console.error('[keeper/rebalance-strategies] Error:', err)
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    } satisfies ApiEnvelope<never>)
  }
}
