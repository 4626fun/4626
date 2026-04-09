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
import { AJNA_ERC20_POOL_ABI } from './_abi.js'
import { assertBucketIndex, assertNonNegative, assertPositive, requireAddress, setBuildCors, toBigIntStrict } from './_shared.js'

type Body = {
  pool: Address
  borrower: Address
  maxQuoteTokenAmountToRepay: string | bigint
  collateralAmountToPull?: string | bigint
  collateralReceiver: Address
  limitIndex: string | bigint
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/repay', kind: 'build' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-build-ajna-repay', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.buildAjnaCalldata,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const body = (await readJsonBody(req, { maxBytes: 16_384 })) ?? ({} as Body)
  try {
    const pool = requireAddress(body.pool, 'pool')
    const borrower = requireAddress(body.borrower, 'borrower')
    const collateralReceiver = requireAddress(body.collateralReceiver, 'collateralReceiver')
    const maxQuoteTokenAmountToRepay = toBigIntStrict(body.maxQuoteTokenAmountToRepay, 'maxQuoteTokenAmountToRepay')
    const collateralAmountToPull = body.collateralAmountToPull == null ? 0n : toBigIntStrict(body.collateralAmountToPull, 'collateralAmountToPull')
    const limitIndex = toBigIntStrict(body.limitIndex, 'limitIndex')
    assertPositive(maxQuoteTokenAmountToRepay, 'maxQuoteTokenAmountToRepay')
    assertNonNegative(collateralAmountToPull, 'collateralAmountToPull')
    assertBucketIndex(limitIndex, 'limitIndex')

    const data = encodeFunctionData({
      abi: AJNA_ERC20_POOL_ABI,
      functionName: 'repayDebt',
      args: [borrower, maxQuoteTokenAmountToRepay, collateralAmountToPull, collateralReceiver, limitIndex],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: pool,
      data,
      value: '0',
      description: 'Ajna: repay debt (optionally pulling collateral) from an ERC20 pool.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'You must ERC20-approve the Ajna pool for quote token transfers before repaying.',
        'Onchain checks still apply: bucket index and loan state can still revert the call.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
