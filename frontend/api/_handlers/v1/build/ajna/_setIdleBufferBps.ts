import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { CREATOR_AJNA_STRATEGY_OWNER_ABI } from './_abi.js'
import { assertBps, requireAddress, setBuildCors, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/setIdleBufferBps', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<{ strategy: Address; idleBufferBps: string | bigint }>(req)) ?? ({} as any)

  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const idleBufferBps = toBigIntStrict(body.idleBufferBps, 'idleBufferBps')
    assertBps(idleBufferBps, 'idleBufferBps')

    const data = encodeFunctionData({
      abi: CREATOR_AJNA_STRATEGY_OWNER_ABI,
      functionName: 'setIdleBufferBps',
      args: [idleBufferBps],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: strategy as Address,
      data,
      value: '0',
      description: 'AjnaStrategy (owner): set idle buffer bps.',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'idleBufferBps is clamped onchain to basis points range [0, 10000].',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

