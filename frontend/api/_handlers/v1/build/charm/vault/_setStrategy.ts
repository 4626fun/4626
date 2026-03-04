import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import { isOfficialCharmVault, officialCharmVaultError } from '../../../../../../server/_lib/charmVaults.js'
import type { BuildTxResponse } from '../../_types.js'
import { CHARM_ALPHA_VAULT_ABI } from './_abi.js'
import { requireAddress, setPublicCors } from '../_shared.js'

type SetMode = 'delegate' | 'manager'

type Body = {
  vault: Address
  strategy: Address
  mode?: SetMode
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
    const mode: SetMode = body.mode ?? 'delegate'
    if (mode !== 'delegate' && mode !== 'manager') {
      throw new Error('mode must be one of: delegate, manager')
    }
    const isOfficialVault = await isOfficialCharmVault({ charmVaultAddress: vault })
    if (!isOfficialVault) throw new Error(officialCharmVaultError(vault))

    const data = encodeFunctionData({
      abi: CHARM_ALPHA_VAULT_ABI,
      functionName: mode === 'manager' ? 'setManager' : 'setRebalanceDelegate',
      args: [strategy],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: vault,
      data,
      value: '0',
      description:
        mode === 'manager'
          ? 'Charm/AlphaVault (governance): set manager address.'
          : 'Charm/AlphaVault (governance): set rebalance delegate address.',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain permission check: manager/delegate updates are governance-only.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

