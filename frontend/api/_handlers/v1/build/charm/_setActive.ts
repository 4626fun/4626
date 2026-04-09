import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  guardAgentApiRequest,
} from '../../../../../packages/server-core/src/index.js'


import type { BuildTxResponse } from '../_types.js'
import { CREATOR_CHARM_STRATEGY_ABI } from './_abi.js'
import { BASE_CHAIN_ID, requireAddress, requireBoolean, setPublicCors } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/setActive', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody(req, { maxBytes: 512_000 })) ?? ({} as any)
  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const active = requireBoolean(body.active, 'active')

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'setActive',
      args: [active],
    })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): set active flag.',
      warnings: ['Owner-only onchain action. This API only builds calldata; it does not execute.'],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

