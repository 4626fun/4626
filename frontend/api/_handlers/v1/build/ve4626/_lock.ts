import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  getApiContracts,
  guardAgentApiRequest,
} from '../../../../../packages/server-core/src/index.js'



import type { BuildTxResponse } from '../_types.js'
import {
  BASE_CHAIN_ID,
  VE_MAX_LOCK_DURATION,
  VE_MIN_LOCK_DURATION,
  assertUint256,
  requireAddress,
  setBuildCors,
  toBigIntStrict,
} from '../_phase1Shared.js'

type Body = {
  token: Address
  amount: string | bigint
  durationSec: string | number | bigint
}

const VE_ABI = [
  { type: 'function', name: 'lock', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/ve4626/lock', kind: 'build' })
  if (!g.ok) return

  const ve = getApiContracts().ve4626
  if (!ve) return res.status(503).json({ success: false, error: 've4626 not configured' })

  try {
    const body = (await readJsonBody<Body>(req)) ?? ({} as Body)
    const token = requireAddress(body.token, 'token')
    const amount = toBigIntStrict(body.amount, 'amount')
    const duration = toBigIntStrict(body.durationSec, 'durationSec')
    if (amount <= 0n) return res.status(400).json({ success: false, error: 'amount must be > 0' })
    if (duration < VE_MIN_LOCK_DURATION || duration > VE_MAX_LOCK_DURATION) {
      return res.status(400).json({
        success: false,
        error: `durationSec must be between ${VE_MIN_LOCK_DURATION.toString()} and ${VE_MAX_LOCK_DURATION.toString()} seconds`,
      })
    }
    assertUint256(amount, 'amount')

    const data = encodeFunctionData({
      abi: VE_ABI,
      functionName: 'lock',
      args: [token, amount, duration],
    })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: String(ve).toLowerCase() as `0x${string}`,
      data,
      value: '0',
      description: 'Create a ve4626 lock.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'You must ERC20-approve ve4626 for the lock token before submitting this transaction.',
        'Onchain checks still apply: token must match ve4626 wrappedShareOFT and caller must not have an active lock.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

