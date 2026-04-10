import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'


import type { BuildTxResponse } from '../_types.js'
import { CREATOR_CHARM_STRATEGY_ABI } from './_abi.js'
import {
  CHARM_BUILD_BODY_MAX_BYTES,
  parseObjectBody,
  requireAddress,
  setPublicCors,
  setRateLimitRetryAfter,
} from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/ownerEmergencyWithdrawFromCharm', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey(
      'v1-build-charm-owner-emergency-withdraw-from-charm',
      g.auth?.address?.toLowerCase() ?? 'anon',
      getClientIp(req),
    ),
    RATE_LIMITS.buildCharmCalldata,
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = parseObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: CHARM_BUILD_BODY_MAX_BYTES }))
  try {
    const strategy = requireAddress(body.strategy, 'strategy')

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'ownerEmergencyWithdrawFromCharm',
      args: [],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): withdraw all shares from Charm vault into strategy (no swaps).',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'This pulls underlying tokens into the strategy contract; you may still need to move them to the vault.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
