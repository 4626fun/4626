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
} from '@4626/server-core'



import type { BuildTxResponse } from '../_types.js'
import { BASE_CHAIN_ID, assertUint256, setBuildCors, setRateLimitRetryAfter, toBigIntStrict } from '../_phase1Shared.js'

type Body = { amount: string | bigint }

const VE_ABI = [
  { type: 'function', name: 'increaseLock', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ve4626/increase', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-ve4626-increase', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
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
    const amount = toBigIntStrict((body as any).amount, 'amount')
    if (amount <= 0n) return res.status(400).json({ success: false, error: 'amount must be > 0' })
    assertUint256(amount, 'amount')

    const data = encodeFunctionData({ abi: VE_ABI, functionName: 'increaseLock', args: [amount] })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: String(ve).toLowerCase() as `0x${string}`,
      data,
      value: '0',
      description: 'Increase the amount of tokens locked in ve4626.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'You must ERC20-approve ve4626 for the lock token before submitting this transaction.',
        'Onchain checks still apply: caller must already have an active, unexpired lock.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
