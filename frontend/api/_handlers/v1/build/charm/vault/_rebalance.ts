import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import {
  handleOptions,
  readJsonBody,
  guardAgentApiRequest,
} from '../../../../../../packages/server-core/src/index.js'


import { isOfficialCharmVault, officialCharmVaultError } from '../../../../../../server/_lib/charmVaults.js'
import type { BuildTxResponse } from '../../_types.js'
import { CHARM_ALPHA_VAULT_ABI } from './_abi.js'
import { requireAddress, setPublicCors } from '../_shared.js'

type Body = {
  vault: Address
  mode?: unknown
  swapAmount?: unknown
  sqrtPriceLimitX96?: unknown
  baseLower?: unknown
  baseUpper?: unknown
  bidLower?: unknown
  bidUpper?: unknown
  askLower?: unknown
  askUpper?: unknown
}

const REMOVED_LEGACY_FIELDS = [
  'mode',
  'swapAmount',
  'sqrtPriceLimitX96',
  'baseLower',
  'baseUpper',
  'bidLower',
  'bidUpper',
  'askLower',
  'askUpper',
] as const

function hasRemovedLegacyInputs(body: Record<string, unknown>): boolean {
  return REMOVED_LEGACY_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/build/charm/vault/rebalance', kind: 'build' })
  if (!g.ok) return

  const body = (await readJsonBody(req, { maxBytes: 512_000 })) ?? ({} as any)
  try {
    if (hasRemovedLegacyInputs(body as Record<string, unknown>)) {
      throw new Error('Legacy rebalance params were removed. Use { vault } only.')
    }
    const vault = requireAddress(body.vault, 'vault')
    const isOfficialVault = await isOfficialCharmVault({ charmVaultAddress: vault })
    if (!isOfficialVault) throw new Error(officialCharmVaultError(vault))

    const data = encodeFunctionData({
      abi: CHARM_ALPHA_VAULT_ABI,
      functionName: 'rebalance',
      args: [],
    })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: vault,
      data,
      value: '0',
      description: 'Charm/AlphaVault: rebalance() no-arg (Base default).',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        'Onchain permission check: rebalance() typically requires manager or rebalance delegate authorization.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

