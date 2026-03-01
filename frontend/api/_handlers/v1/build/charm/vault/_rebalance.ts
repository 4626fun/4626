import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../../_types.js'
import { CHARM_ALPHA_VAULT_ABI } from './_abi.js'
import { requireAddress, setPublicCors, toBigIntStrict, toInt24Strict } from '../_shared.js'

type Body = {
  vault: Address
  // rebalance params
  swapAmount: string | number | bigint
  sqrtPriceLimitX96: string | number | bigint
  baseLower: string | number | bigint
  baseUpper: string | number | bigint
  bidLower: string | number | bigint
  bidUpper: string | number | bigint
  askLower: string | number | bigint
  askUpper: string | number | bigint
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/vault/rebalance', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<Body>(req)) ?? ({} as any)
  try {
    const vault = requireAddress(body.vault, 'vault')
    const swapAmount = toBigIntStrict(body.swapAmount, 'swapAmount') // int256 encoded as bigint
    const sqrtPriceLimitX96 = toBigIntStrict(body.sqrtPriceLimitX96, 'sqrtPriceLimitX96') // uint160

    const baseLower = toInt24Strict(body.baseLower, 'baseLower')
    const baseUpper = toInt24Strict(body.baseUpper, 'baseUpper')
    const bidLower = toInt24Strict(body.bidLower, 'bidLower')
    const bidUpper = toInt24Strict(body.bidUpper, 'bidUpper')
    const askLower = toInt24Strict(body.askLower, 'askLower')
    const askUpper = toInt24Strict(body.askUpper, 'askUpper')

    const data = encodeFunctionData({
      abi: CHARM_ALPHA_VAULT_ABI,
      functionName: 'rebalance',
      args: [swapAmount, sqrtPriceLimitX96, baseLower, baseUpper, bidLower, bidUpper, askLower, askUpper],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: vault,
      data,
      value: '0',
      description: 'Charm/AlphaVault: rebalance with explicit base + limit ranges.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain permission check: vault.rebalance(...) typically requires msg.sender == strategy.',
        'Ticks must be aligned to the pool tickSpacing; misaligned ticks will revert.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

