import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkDurableRateLimit,
  rateLimitKey,
} from '@4626/server-core'


import type { BuildTxResponse } from '../_types.js'
import { ERC4626_STRATEGY_ADAPTER_OWNER_ABI } from './_abi.js'
import { assertBps, requireAddress, setBuildCors, setRateLimitRetryAfter, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/setIdleBufferBps', kind: 'build' })
  if (!g.ok) return

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-build-ajna-set-idle-buffer-bps', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildAjnaCalldata,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? ({} as any)

  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const idleBufferBps = toBigIntStrict(body.idleBufferBps, 'idleBufferBps')
    assertBps(idleBufferBps, 'idleBufferBps')

    const data = encodeFunctionData({
      abi: ERC4626_STRATEGY_ADAPTER_OWNER_ABI,
      functionName: 'setIdleBufferBps',
      args: [idleBufferBps],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy as Address,
      data,
      value: '0',
      description: 'ERC4626StrategyAdapter (owner): set Ajna idle buffer bps.',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'Canonical nested Ajna deployments should target the ERC4626StrategyAdapter address here.',
        'idleBufferBps is clamped onchain to basis points range [0, 10000].',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
