import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { CREATOR_CHARM_STRATEGY_ABI } from './_abi.js'
import { requireAddress, setPublicCors } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/setUniFactory', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<{ strategy: Address; uniFactory: Address }>(req)) ?? ({} as any)
  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const uniFactory = requireAddress(body.uniFactory, 'uniFactory')

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'setUniFactory',
      args: [uniFactory],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): set Uniswap V3 factory (auto fee discovery).',
      warnings: ['Owner-only onchain action. This API only builds calldata; it does not execute.'],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

