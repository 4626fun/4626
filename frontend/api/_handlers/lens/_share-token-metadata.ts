import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Address } from 'viem'
import { isAddress } from 'viem'

import {
  DEFAULT_CHAIN_ID,
  getNumberQuery,
  getStringQuery,
  handleOptions,
  setCors,
} from '../../../server/zora/_shared.js'
import { buildShareTokenMetadata } from '../../../server/_lib/shareTokenMetadata.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey, readRequestPrincipal } from '../../../packages/server-core/src/index.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type GroveAttachment = {
  lensUri: string
  gatewayUrl: string
  storageKey: string
  statusUrl: string | null
}

type ShareTokenMetadataResponse = {
  metadata: Record<string, unknown>
  grove?: GroveAttachment
  contractUri?: string
  groveStatus?: 'stored' | 'unavailable' | 'skipped'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const address = getStringQuery(req, 'address')
  if (!address || !isAddress(address)) {
    return res.status(400).json({ success: false, error: 'Invalid token address' } satisfies ApiEnvelope<never>)
  }

  const chainId = getNumberQuery(req, 'chain') ?? DEFAULT_CHAIN_ID
  const storeRaw = getStringQuery(req, 'store')
  const shouldStore = storeRaw ? storeRaw.toLowerCase() !== 'false' : false
  const rate = checkRateLimit(rateLimitKey('lens-share-token-metadata', String(address).toLowerCase(), getClientIp(req) || 'unknown'), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }
  const hasAuthPrincipal = Boolean(readRequestPrincipal(req))

  if (shouldStore && !hasAuthPrincipal) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to store on Grove. Use session or SIWA receipt, or set store=false.',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const metadata = await buildShareTokenMetadata({
      address: address as Address,
      chainId,
      rpcUrl: process.env.BASE_RPC_URL,
      apiHost: process.env.API_HOST,
      appHost: process.env.APP_HOST,
      zoraKey: process.env.ZORA_SERVER_API_KEY ?? null,
    })

    let grove: GroveAttachment | undefined
    let contractUri: string | undefined
    let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
    if (shouldStore) {
      const attempt = await tryUploadImmutableJson(metadata)
      if (attempt.ok) {
        grove = {
          lensUri: attempt.result.lensUri,
          gatewayUrl: attempt.result.gatewayUrl,
          storageKey: attempt.result.storageKey,
          statusUrl: attempt.result.statusUrl,
        }
        contractUri = attempt.result.lensUri
        groveStatus = 'stored'
      } else {
        groveStatus = 'unavailable'
      }
    }

    const payload: ShareTokenMetadataResponse = {
      metadata,
      grove,
      contractUri,
      groveStatus,
    }

    return res.status(200).json({ success: true, data: payload } satisfies ApiEnvelope<ShareTokenMetadataResponse>)
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to build metadata' } satisfies ApiEnvelope<never>)
  }
}
