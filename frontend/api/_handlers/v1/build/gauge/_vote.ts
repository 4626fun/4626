import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, isAddress, type Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  getApiContracts,
  guardAgentApiRequest,
} from '../../../../../packages/server-core/src/index.js'



import type { BuildTxResponse } from '../_types.js'
import { BASE_CHAIN_ID, assertUint256, setBuildCors, toBigIntStrict } from '../_phase1Shared.js'

type Body = {
  vaults: Address[]
  weights: Array<string | number | bigint>
}

const GAUGE_ABI = [
  { type: 'function', name: 'vote', stateMutability: 'nonpayable', inputs: [{ type: 'address[]' }, { type: 'uint256[]' }], outputs: [] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setBuildCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/gauge/vote', kind: 'build' })
  if (!g.ok) return

  const gauge = getApiContracts().vaultGaugeVoting
  if (!gauge) {
    return res.status(503).json({ success: false, error: 'VaultGaugeVoting not configured' })
  }

  try {
    const body = (await readJsonBody<Body>(req)) ?? ({} as Body)
    const vaultsIn = Array.isArray(body.vaults) ? body.vaults : []
    const weightsIn = Array.isArray(body.weights) ? body.weights : []

    if (vaultsIn.length === 0) return res.status(400).json({ success: false, error: 'vaults is required' })
    if (vaultsIn.length !== weightsIn.length) return res.status(400).json({ success: false, error: 'vaults and weights length mismatch' })
    if (vaultsIn.length > 10) return res.status(400).json({ success: false, error: 'Too many vaults (max 10)' })

    // Mirror onchain behavior by aggregating duplicate vaults before encoding.
    const aggregate = new Map<string, bigint>()
    for (let i = 0; i < vaultsIn.length; i++) {
      const vault = vaultsIn[i]
      if (!vault || !isAddress(vault)) return res.status(400).json({ success: false, error: `Invalid vault at index ${i}` })
      const w = toBigIntStrict(weightsIn[i], `weights[${i}]`)
      if (w <= 0n) return res.status(400).json({ success: false, error: `weights[${i}] must be > 0` })
      assertUint256(w, `weights[${i}]`)
      const key = vault.toLowerCase()
      aggregate.set(key, (aggregate.get(key) ?? 0n) + w)
    }

    const vaults = Array.from(aggregate.keys()) as Address[]
    const weights = vaults.map((v) => aggregate.get(v) as bigint)

    const data = encodeFunctionData({
      abi: GAUGE_ABI,
      functionName: 'vote',
      args: [vaults, weights],
    })

    const out: BuildTxResponse = {
      chainId: BASE_CHAIN_ID,
      to: String(gauge).toLowerCase() as `0x${string}`,
      data,
      value: '0',
      description: 'Cast ve(3,3) gauge votes for one epoch.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain checks still apply: sender must hold ve4626 voting power and lock through the next epoch.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

