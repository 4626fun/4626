import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import { isOfficialCharmVault, officialCharmVaultError } from '../../../../../../server/_lib/charmVaults.js'
import type { BuildTxResponse } from '../../_types.js'
import { CHARM_ALPHA_VAULT_ABI } from './_abi.js'
import { requireAddress, setPublicCors } from '../_shared.js'

type Body = {
  vault: Address
  strategy: Address
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/vault/setStrategy', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody<Body>(req)) ?? ({} as any)
  try {
    const vault = requireAddress(body.vault, 'vault')
    const strategy = requireAddress(body.strategy, 'strategy')
    const isOfficialVault = await isOfficialCharmVault({ charmVaultAddress: vault })
    if (!isOfficialVault) throw new Error(officialCharmVaultError(vault))

    const data = encodeFunctionData({
      abi: CHARM_ALPHA_VAULT_ABI,
      functionName: 'setStrategy',
      args: [strategy],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: vault,
      data,
      value: '0',
      description: 'Charm/AlphaVault (governance): set the strategy that is allowed to call rebalance().',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain permission check: setStrategy is governance-only.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

