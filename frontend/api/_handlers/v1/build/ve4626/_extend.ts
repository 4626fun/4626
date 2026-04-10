import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData } from 'viem'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  getApiContracts,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../../packages/server-core/src/index.js'



import type { BuildTxResponse } from '../_types.js'
import { BASE_CHAIN_ID, VE_MAX_LOCK_DURATION, nowUnixSeconds, setBuildCors, setRateLimitRetryAfter, toBigIntStrict } from '../_phase1Shared.js'

type Body = { newEnd: string | bigint }

const VE_ABI = [
  { type: 'function', name: 'extendLock', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ve4626/extend', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-ve4626-extend', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildVe4626Calldata,
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const ve = getApiContracts().ve4626
  if (!ve) return res.status(503).json({ success: false, error: 've4626 not configured' })

  try {
    const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) ?? ({} as Body)
    const newEnd = toBigIntStrict((body as any).newEnd, 'newEnd')
    const now = nowUnixSeconds()
    if (newEnd <= now) {
      return res.status(400).json({ success: false, error: 'newEnd must be a future unix timestamp (seconds)' })
    }
    if (newEnd > now + VE_MAX_LOCK_DURATION) {
      return res.status(400).json({
        success: false,
        error: `newEnd cannot exceed now + ${VE_MAX_LOCK_DURATION.toString()} seconds`,
      })
    }

    const data = encodeFunctionData({ abi: VE_ABI, functionName: 'extendLock', args: [newEnd] })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: String(ve).toLowerCase() as `0x${string}`,
      data,
      value: '0',
      description: 'Extend an existing ve4626 lock.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain checks still apply: newEnd must be greater than your current lock end.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
