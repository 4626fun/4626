import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

/**
 * Ajna borrower “Add Collateral” is modeled as `drawDebt(...)` with `amountToBorrow=0`.
 * This matches Ajna ERC20Pool behavior (see `ERC20Pool.drawDebt` in ajna-core).
 */

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
import { AJNA_ERC20_POOL_ABI } from './_abi.js'
import { assertBucketIndex, assertPositive, requireAddress, setBuildCors, setRateLimitRetryAfter, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/addCollateral', kind: 'build' })
  if (!g.ok) return

  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1-build-ajna-add-collateral', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildAjnaCalldata,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    setRateLimitRetryAfter(res, limiter.resetAt)
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? ({} as any)

  try {
    const pool = requireAddress(body.pool, 'pool')
    const borrower = requireAddress(body.borrower, 'borrower')
    const collateralToPledge = toBigIntStrict(body.collateralToPledge, 'collateralToPledge')
    const limitIndex = toBigIntStrict(body.limitIndex, 'limitIndex')
    assertPositive(collateralToPledge, 'collateralToPledge')
    assertBucketIndex(limitIndex, 'limitIndex')

    const data = encodeFunctionData({
      abi: AJNA_ERC20_POOL_ABI,
      functionName: 'drawDebt',
      args: [borrower, 0n, limitIndex, collateralToPledge],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: pool,
      data,
      value: '0',
      description: 'Ajna: pledge borrower collateral (drawDebt with amountToBorrow=0).',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Ajna pools typically require the transaction sender to be the borrower; set borrower to the submitting address.',
        'You must ERC20-approve the Ajna pool for collateral transfers before pledging collateral.',
        'Onchain checks still apply: bucket index and collateralization rules can still revert the call.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
