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
  BASE_CHAIN_ID,
  CHARM_BUILD_BODY_MAX_BYTES,
  assertBps,
  assertNonNegative,
  assertSwapPoolFee,
  parseObjectBody,
  requireAddress,
  setPublicCors,
  setRateLimitRetryAfter,
  toBigIntStrict,
} from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/setParameters', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-charm-set-parameters', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildCharmCalldata,
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = parseObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: CHARM_BUILD_BODY_MAX_BYTES }))

  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const maxSwapPercent = toBigIntStrict(body.maxSwapPercent, 'maxSwapPercent')
    const swapSlippageBps = toBigIntStrict(body.swapSlippageBps, 'swapSlippageBps')
    const depositSlippageBps = toBigIntStrict(body.depositSlippageBps, 'depositSlippageBps')
    const swapPoolFee = toBigIntStrict(body.swapPoolFee, 'swapPoolFee')
    assertBps(maxSwapPercent, 'maxSwapPercent')
    assertBps(swapSlippageBps, 'swapSlippageBps')
    assertBps(depositSlippageBps, 'depositSlippageBps')
    assertNonNegative(swapPoolFee, 'swapPoolFee')
    assertSwapPoolFee(swapPoolFee)

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'setParameters',
      args: [maxSwapPercent, swapSlippageBps, depositSlippageBps, Number(swapPoolFee)],
    })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): update maxSwapPercent / slippage bps / swap pool fee.',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'Be careful: overly tight slippage can cause deposits/withdraws to fail; overly loose slippage can increase MEV risk.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
