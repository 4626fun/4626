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
} from '@4626/server-core'


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

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/rebalance', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-charm-rebalance', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
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
      functionName: 'rebalance',
      args: [],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy: emit StrategyRebalanced(totalAssets).',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain permission check: only the strategy owner or vault can call rebalance().',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
