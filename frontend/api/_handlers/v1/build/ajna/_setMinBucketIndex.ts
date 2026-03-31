import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  guardAgentApiRequest,
} from '../../../../../packages/server-core/src/index.js'


import type { BuildTxResponse } from '../_types.js'
import { AJNA_VAULT_AUTH_ADMIN_ABI } from './_abi.js'
import { assertMinBucketIndex, requireAddress, setBuildCors, toBigIntStrict } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ajna/setMinBucketIndex', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<{ auth: Address; minBucketIndex: string | bigint }>(req)) ?? ({} as any)

  try {
    const auth = requireAddress(body.auth, 'auth')
    const minBucketIndex = toBigIntStrict(body.minBucketIndex, 'minBucketIndex')
    assertMinBucketIndex(minBucketIndex, 'minBucketIndex')

    const data = encodeFunctionData({
      abi: AJNA_VAULT_AUTH_ADMIN_ABI,
      functionName: 'setMinBucketIndex',
      args: [minBucketIndex],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: auth as Address,
      data,
      value: '0',
      description: 'AjnaVaultAuth (admin): set nested Ajna min bucket index.',
      warnings: [
        'Admin-only onchain action. This API only builds calldata; it does not execute.',
        'Canonical nested Ajna flow: target the AjnaVaultAuth contract, not the ERC4626StrategyAdapter.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}
