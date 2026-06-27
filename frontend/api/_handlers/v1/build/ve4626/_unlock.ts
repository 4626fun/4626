import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData } from 'viem'

import {
  handleOptions,
  getApiContracts,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkDurableRateLimit,
  rateLimitKey,
} from '@4626/server-core'



import type { BuildTxResponse } from '../_types.js'
import { BASE_CHAIN_ID, setBuildCors, setRateLimitRetryAfter } from '../_phase1Shared.js'

const VE_ABI = [
  { type: 'function', name: 'unlock', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ve4626/unlock', kind: 'build' })
  if (!g.ok) return

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-build-ve4626-unlock', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildVe4626Calldata,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const ve = getApiContracts().ve4626
  if (!ve) return res.status(503).json({ success: false, error: 've4626 not configured' })

  try {
    const data = encodeFunctionData({ abi: VE_ABI, functionName: 'unlock', args: [] })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: String(ve).toLowerCase() as `0x${string}`,
      data,
      value: '0',
      description: 'Unlock tokens from ve4626 after lock expiry.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain checks still apply: lock must exist and be expired before unlock.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
