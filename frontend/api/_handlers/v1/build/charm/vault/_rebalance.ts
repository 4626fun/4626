import type { VercelRequest, VercelResponse } from '@vercel/node'
import { encodeFunctionData, type Address } from 'viem'

import { handleOptions, readJsonBody } from '../../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../../server/_lib/agentApiGuard.js'
import { isOfficialCharmVault, officialCharmVaultError } from '../../../../../../server/_lib/charmVaults.js'
import type { BuildTxResponse } from '../../_types.js'
import { CHARM_ALPHA_VAULT_ABI } from './_abi.js'
import { requireAddress, setPublicCors, toBigIntStrict, toInt24Strict } from '../_shared.js'

type RebalanceMode = 'auto' | 'simple' | 'legacy-ranges'

type Body = {
  vault: Address
  mode?: RebalanceMode
  // legacy rebalance params (required when mode=legacy-ranges)
  swapAmount?: string | number | bigint
  sqrtPriceLimitX96?: string | number | bigint
  baseLower?: string | number | bigint
  baseUpper?: string | number | bigint
  bidLower?: string | number | bigint
  bidUpper?: string | number | bigint
  askLower?: string | number | bigint
  askUpper?: string | number | bigint
}

function hasLegacyRangeFields(body: Body): boolean {
  return [
    body.swapAmount,
    body.sqrtPriceLimitX96,
    body.baseLower,
    body.baseUpper,
    body.bidLower,
    body.bidUpper,
    body.askLower,
    body.askUpper,
  ].some((value) => value !== undefined && value !== null)
}

function parseRebalanceMode(mode: unknown): RebalanceMode {
  if (mode === undefined || mode === null || mode === '') return 'auto'
  if (mode === 'auto' || mode === 'simple' || mode === 'legacy-ranges') return mode
  throw new Error('mode must be one of: auto, simple, legacy-ranges')
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
    const isOfficialVault = await isOfficialCharmVault({ charmVaultAddress: vault })
    if (!isOfficialVault) throw new Error(officialCharmVaultError(vault))

    const mode = parseRebalanceMode(body.mode)
    const useLegacyRanges = mode === 'legacy-ranges' || (mode === 'auto' && hasLegacyRangeFields(body))
    const data = useLegacyRanges
      ? (() => {
          const swapAmount = toBigIntStrict(body.swapAmount, 'swapAmount') // int256 encoded as bigint
          const sqrtPriceLimitX96 = toBigIntStrict(body.sqrtPriceLimitX96, 'sqrtPriceLimitX96') // uint160

          const baseLower = toInt24Strict(body.baseLower, 'baseLower')
          const baseUpper = toInt24Strict(body.baseUpper, 'baseUpper')
          const bidLower = toInt24Strict(body.bidLower, 'bidLower')
          const bidUpper = toInt24Strict(body.bidUpper, 'bidUpper')
          const askLower = toInt24Strict(body.askLower, 'askLower')
          const askUpper = toInt24Strict(body.askUpper, 'askUpper')

          return encodeFunctionData({
            abi: CHARM_ALPHA_VAULT_ABI,
            functionName: 'rebalance',
            args: [swapAmount, sqrtPriceLimitX96, baseLower, baseUpper, bidLower, bidUpper, askLower, askUpper],
          })
        })()
      : encodeFunctionData({
          abi: CHARM_ALPHA_VAULT_ABI,
          functionName: 'rebalance',
          args: [],
        })

    const out: BuildTxResponse = {
      chainId: 8453,
      to: vault,
      data,
      value: '0',
      description: useLegacyRanges
        ? 'Charm/AlphaVault: legacy rebalance with explicit base + limit ranges.'
        : 'Charm/AlphaVault: rebalance() no-arg (default for Base Charm vaults).',
      warnings: [
        'This is build-only: you must submit the transaction via your wallet/provider.',
        useLegacyRanges
          ? 'Legacy range mode: ticks must match pool tickSpacing, otherwise rebalance reverts.'
          : 'Onchain permission check: rebalance() typically requires manager or rebalance delegate authorization.',
      ],
    }

    return res.status(200).json({ success: true, data: out })
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid params' })
  }
}

