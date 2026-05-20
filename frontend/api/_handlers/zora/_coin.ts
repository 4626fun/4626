import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'

import { loadMergedCreatorEthosByAddresses } from '../../../server/_lib/zora/creatorEthosProjection.js'
import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  isAddressLike,
  requireServerKey,
  setCache,
  setCors,
} from '../../../server/zora/_shared.js'

function readCreatorAddressFromCoin(coin: Record<string, unknown>): string | null {
  const creatorAddress =
    typeof coin.creatorAddress === 'string'
      ? coin.creatorAddress
      : typeof coin.payoutRecipientAddress === 'string'
        ? coin.payoutRecipientAddress
        : null
  if (!creatorAddress || !isAddressLike(creatorAddress)) return null
  return creatorAddress.toLowerCase()
}

async function attachCreatorEthosFields(coin: Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  if (!coin || typeof coin !== 'object') return coin
  const creatorAddress = readCreatorAddressFromCoin(coin)
  if (!creatorAddress) return coin

  try {
    const mergedMap = await loadMergedCreatorEthosByAddresses([creatorAddress])
    const merged = mergedMap.get(creatorAddress)
    if (!merged || merged.score == null) return coin
    return {
      ...coin,
      ethosScore: merged.score,
      ethosLevel: merged.level,
      ethosScoreSource: merged.source,
    }
  } catch {
    return coin
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const key = requireServerKey()
  if (!key) {
    return res.status(501).json({ success: false, error: 'ZORA_SERVER_API_KEY is not configured' })
  }

  const address = getStringQuery(req, 'address')
  if (!address || !isAddressLike(address)) {
    return res.status(400).json({ success: false, error: 'Invalid address' })
  }

  const chain = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID

  try {
    // Dynamic import to avoid TS export-resolution issues in some editor/lint configs.
    const sdk: any = await import('@zoralabs/coins-sdk')
    sdk.setApiKey(key)
    const response = await sdk.getCoin({
      address: address as Address,
      chain,
    })

    const rawCoin = response.data?.zora20Token ?? null
    const data =
      rawCoin && typeof rawCoin === 'object'
        ? await attachCreatorEthosFields(rawCoin as Record<string, unknown>)
        : rawCoin

    // Coin stats can move quickly; keep this short so UI matches zora.co more closely.
    setCache(res, 60)
    return res.status(200).json({ success: true, data })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500
    return res.status(status).json({
      success: false,
      error: e?.message || 'Failed to fetch coin',
    })
  }
}
