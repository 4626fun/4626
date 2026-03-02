import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData } from 'viem'

import { handleOptions } from '../../../../server/auth/_shared.js'
import { getApiContracts } from '../../../../server/_lib/contracts.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import type { BuildTxResponse } from '../_types.js'
import { BASE_CHAIN_ID, setBuildCors } from '../_phase1Shared.js'

const GAUGE_ABI = [
  { type: 'function', name: 'resetVotes', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/gauge/resetVotes', kind: 'build' })
  if (!g.ok) return

  const gauge = getApiContracts().vaultGaugeVoting
  if (!gauge) {
    return res.status(503).json({ success: false, error: 'VaultGaugeVoting not configured' })
  }

  try {
    const data = encodeFunctionData({ abi: GAUGE_ABI, functionName: 'resetVotes', args: [] })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: String(gauge).toLowerCase() as `0x${string}`,
      data,
      value: '0',
      description: 'Reset gauge votes for the current epoch.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Only the submitting address votes are reset for the active epoch.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

