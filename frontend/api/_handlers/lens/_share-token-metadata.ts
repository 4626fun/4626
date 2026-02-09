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
import { uploadImmutableJson, resolveLensUri } from '../../../server/_lib/lensGrove.js'

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
  const shouldStore = storeRaw ? storeRaw.toLowerCase() !== 'false' : true

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
    if (shouldStore) {
      const uploaded = await uploadImmutableJson(metadata)
      grove = {
        lensUri: uploaded.lensUri,
        gatewayUrl: uploaded.gatewayUrl,
        storageKey: uploaded.storageKey,
        statusUrl: uploaded.statusUrl,
      }
      contractUri = uploaded.lensUri
    }

    const payload: ShareTokenMetadataResponse = {
      metadata,
      grove,
      contractUri,
    }

    return res.status(200).json({ success: true, data: payload } satisfies ApiEnvelope<ShareTokenMetadataResponse>)
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to build metadata' } satisfies ApiEnvelope<never>)
  }
}
