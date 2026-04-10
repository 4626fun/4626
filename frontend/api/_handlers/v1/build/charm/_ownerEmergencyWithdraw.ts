import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'


import type { BuildTxResponse } from '../_types.js'
import { CREATOR_CHARM_STRATEGY_ABI } from './_abi.js'
import { BASE_CHAIN_ID, assertNonNegative, requireAddress, setPublicCors, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/ownerEmergencyWithdraw', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-charm-owner-emergency-withdraw', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildCharmCalldata,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const body =
    (await readJsonBody(req, { maxBytes: 16_384 })) ?? ({} as any)

  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const token = requireAddress(body.token, 'token')
    const to = requireAddress(body.to, 'to')
    const amount = toBigIntStrict(body.amount, 'amount')
    assertNonNegative(amount, 'amount')

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'ownerEmergencyWithdraw',
      args: [token, to, amount],
    })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): emergency withdraw ERC20 from strategy.',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'Use with care: moving assets out of the strategy can break accounting/withdrawals.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
