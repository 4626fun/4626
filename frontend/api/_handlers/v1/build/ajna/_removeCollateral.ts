import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

/**
 * Ajna borrower “Remove Collateral” is modeled as `repayDebt(...)` with `maxQuoteTokenAmountToRepay=0`.
 * This matches Ajna ERC20Pool behavior (see `ERC20Pool.repayDebt` in ajna-core).
 */

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { AJNA_ERC20_POOL_ABI } from './_abi.js'
import { assertBucketIndex, assertPositive, requireAddress, setBuildCors, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/removeCollateral', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<{
    pool: Address
    borrower: Address
    collateralAmountToPull: string | bigint
    collateralReceiver: Address
    limitIndex: string | bigint
  }>(req)) ?? ({} as any)

  try {
    const pool = requireAddress(body.pool, 'pool')
    const borrower = requireAddress(body.borrower, 'borrower')
    const collateralReceiver = requireAddress(body.collateralReceiver, 'collateralReceiver')
    const collateralAmountToPull = toBigIntStrict(body.collateralAmountToPull, 'collateralAmountToPull')
    const limitIndex = toBigIntStrict(body.limitIndex, 'limitIndex')
    assertPositive(collateralAmountToPull, 'collateralAmountToPull')
    assertBucketIndex(limitIndex, 'limitIndex')

    const data = encodeFunctionData({
      abi: AJNA_ERC20_POOL_ABI,
      functionName: 'repayDebt',
      args: [borrower, 0n, collateralAmountToPull, collateralReceiver, limitIndex],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: pool,
      data,
      value: '0',
      description: 'Ajna: pull borrower collateral (repayDebt with maxQuoteTokenAmountToRepay=0).',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'This will revert if pulling collateral would leave the loan undercollateralized.',
        'Onchain checks still apply: bucket index and loan state can still revert the call.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

