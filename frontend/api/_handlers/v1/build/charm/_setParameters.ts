import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { CREATOR_CHARM_STRATEGY_ABI } from './_abi.js'
import {
  BASE_CHAIN_ID,
  assertBps,
  assertNonNegative,
  assertSwapPoolFee,
  requireAddress,
  setPublicCors,
  toBigIntStrict,
} from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/setParameters', kind: 'build' })
  if (!g.ok) return

  const body =
    (await readJsonBody<{
      strategy: Address
      maxSwapPercent: string | number | bigint
      swapSlippageBps: string | number | bigint
      depositSlippageBps: string | number | bigint
      swapPoolFee: string | number | bigint
    }>(req)) ?? ({} as any)

  try {
    const strategy = requireAddress(body.strategy, 'strategy')
    const maxSwapPercent = toBigIntStrict(body.maxSwapPercent, 'maxSwapPercent')
    const swapSlippageBps = toBigIntStrict(body.swapSlippageBps, 'swapSlippageBps')
    const depositSlippageBps = toBigIntStrict(body.depositSlippageBps, 'depositSlippageBps')
    const swapPoolFee = toBigIntStrict(body.swapPoolFee, 'swapPoolFee')
    assertBps(maxSwapPercent, 'maxSwapPercent')
    assertBps(swapSlippageBps, 'swapSlippageBps')
    assertBps(depositSlippageBps, 'depositSlippageBps')
    assertNonNegative(swapPoolFee, 'swapPoolFee')
    assertSwapPoolFee(swapPoolFee)

    const data = encodeFunctionData({
      abi: CREATOR_CHARM_STRATEGY_ABI,
      functionName: 'setParameters',
      args: [maxSwapPercent, swapSlippageBps, depositSlippageBps, Number(swapPoolFee)],
    })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: strategy,
      data,
      value: '0',
      description: 'CreatorCharmStrategy (owner): update maxSwapPercent / slippage bps / swap pool fee.',
      warnings: [
        'Owner-only onchain action. This API only builds calldata; it does not execute.',
        'Be careful: overly tight slippage can cause deposits/withdraws to fail; overly loose slippage can increase MEV risk.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

