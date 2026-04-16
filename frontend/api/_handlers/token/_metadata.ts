import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { isAddress } from 'viem'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  requireServerKey,
  setCache,
  setPublicCors,
} from '../../../server/zora/_shared.js'
import { buildShareTokenMetadata } from '../../../server/_lib/infra/shareTokenMetadata.js'

declare const process: { env: Record<string, string | undefined> }

/**
 * ERC-7572 Token Metadata API
 *
 * Returns contract-level metadata for ■TOKEN (CreatorShareOFT) tokens.
 * The image fields point at the canonical token renderer used across API and contract metadata.
 *
 * Query params:
 *   - address: ShareOFT token address (required)
 *   - chain: Chain ID (default: 8453 for Base)
 *
 * Response: ERC-7572 compliant JSON
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const address = getStringQuery(req, 'address')
  if (!address || !isAddress(address)) {
    return res.status(400).json({ error: 'Invalid token address' })
  }

  const chainId = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID

  // Use canonical API host when unset. Keep bare host only (no protocol)
  // unless buildShareTokenMetadata docs say otherwise.
  const apiHost =
    process.env.API_HOST?.trim().replace(/\/+$/, '') || 'api.4626.fun'

  try {
    const metadata = await buildShareTokenMetadata({
      address: address as Address,
      chainId,
      rpcUrl: process.env.BASE_RPC_URL, // ← Base-focused; see note above
      apiHost,
      appHost: process.env.APP_HOST?.trim().replace(/\/+$/, ''),
      zoraKey: requireServerKey(),
    })

    // Cache for 1 hour (metadata doesn't change often)
    setCache(res, 3600)
    return res.status(200).json(metadata)
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : 'Failed to fetch token metadata'
    console.error('[token/metadata] Error:', e)
    return res.status(500).json({ error: message })
  }
}