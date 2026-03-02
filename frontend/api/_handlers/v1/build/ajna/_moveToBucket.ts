import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { CREATOR_AJNA_STRATEGY_OWNER_ABI } from './_abi.js'
import { assertBucketIndex, assertPositive, requireAddress, setBuildCors, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/moveToBucket', kind: 'build' })
  if (!g.ok) return

  const body =
    (await readJsonBody<{ strategy: Address; newBucketIndex: string | bigint; maxAmountLp: string | bigint }>(req)) ??
    ({} as any)

  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const newBucketIndex = toBigIntStrict(body.newBucketIndex, 'newBucketIndex')
    const maxAmountLp = toBigIntStrict(body.maxAmountLp, 'maxAmountLp')
    assertBucketIndex(newBucketIndex, 'newBucketIndex')
    assertPositive(maxAmountLp, 'maxAmountLp')

    const data = encodeFunctionData({
      abi: CREATOR_AJNA_STRATEGY_OWNER_ABI,
      functionName: 'moveToBucket',
      args: [newBucketIndex, maxAmountLp],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy as Address,
      data,
      value: '0',
      description: 'AjnaStrategy (owner): move strategy liquidity to a new bucket.',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'Move can revert if there is insufficient LP liquidity or bucket preconditions are unmet.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

