import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { AJNA_ERC20_POOL_ABI } from './_abi.js'
import { assertBucketIndex, assertNonNegative, assertPositive, requireAddress, setBuildCors, toBigIntStrict } from './_shared.js'

type Body = {
  pool: Address
  borrower: Address
  amountToBorrow: string | bigint
  limitIndex: string | bigint
  collateralToPledge?: string | bigint
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/borrow', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<Body>(req)) ?? ({} as Body)
  try {
    const pool = requireAddress(body.pool, 'pool')
    const borrower = requireAddress(body.borrower, 'borrower')
    const amountToBorrow = toBigIntStrict(body.amountToBorrow, 'amountToBorrow')
    const limitIndex = toBigIntStrict(body.limitIndex, 'limitIndex')
    const collateralToPledge = body.collateralToPledge == null ? 0n : toBigIntStrict(body.collateralToPledge, 'collateralToPledge')
    assertPositive(amountToBorrow, 'amountToBorrow')
    assertBucketIndex(limitIndex, 'limitIndex')
    assertNonNegative(collateralToPledge, 'collateralToPledge')

    const data = encodeFunctionData({
      abi: AJNA_ERC20_POOL_ABI,
      functionName: 'drawDebt',
      args: [borrower, amountToBorrow, limitIndex, collateralToPledge],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: pool,
      data,
      value: '0',
      description: 'Ajna: draw debt (borrow) from an ERC20 pool (optionally pledging collateral).',
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

