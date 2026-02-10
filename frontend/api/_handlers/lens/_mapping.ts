import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { resolveLensUserByOwner } from '../../../server/_lib/lensAccounts.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type LensMapping = {
  requestedWallet: string
  wallet: string
  lens: {
    handle: string | null
    username: string | null
    displayName: string
    avatar: string | null
    accountAddress: string
    ownerAddress: string | null
  } | null
  namespaces: {
    wallet: string
    lensHandle: string | null
    lensAccount: string | null
    lensOwner: string | null
  }
  generatedAt: string
  source: string
}

type GroveAttachment = {
  lensUri: string
  gatewayUrl: string
  storageKey: string
  statusUrl: string | null
}

type LensMappingResponse = {
  mapping: LensMapping | null
  grove?: GroveAttachment
}

type LensMappingRequest = {
  address?: string
  store?: boolean
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase()
}

function getAddressFromRequest(req: VercelRequest): string | null {
  const query = typeof req.query.address === 'string' ? req.query.address.trim() : ''
  if (query) return query
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = req.method === 'POST' ? (await readJsonBody<LensMappingRequest>(req)) ?? {} : {}
  const addressRaw = body.address?.trim() || getAddressFromRequest(req) || ''

  const session = readSessionFromRequest(req)
  const sessionAddress = session?.address ? String(session.address).trim() : ''
  const wallet = normalizeAddress(addressRaw || sessionAddress)

  if (!wallet || !isAddressLike(wallet)) {
    return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
  }

  const shouldStore = body.store !== false

  try {
    const canonicalWallet = (await resolveCanonicalSmartWalletAddress(wallet)) ?? wallet
    const lensUser = await resolveLensUserByOwner(canonicalWallet)
    if (!lensUser) {
      return res.status(200).json({ success: true, data: { mapping: null } } satisfies ApiEnvelope<LensMappingResponse>)
    }

    const mapping: LensMapping = {
      requestedWallet: wallet,
      wallet: canonicalWallet,
      lens: {
        handle: lensUser.handle,
        username: lensUser.username,
        displayName: lensUser.displayName,
        avatar: lensUser.avatar,
        accountAddress: lensUser.accountAddress,
        ownerAddress: lensUser.ownerAddress,
      },
      namespaces: {
        wallet: `wallet:${canonicalWallet}`,
        lensHandle: lensUser.handle ? `lens:${lensUser.handle}` : null,
        lensAccount: lensUser.accountAddress ? `lens:account:${lensUser.accountAddress.toLowerCase()}` : null,
        lensOwner: lensUser.ownerAddress ? `lens:owner:${lensUser.ownerAddress.toLowerCase()}` : null,
      },
      generatedAt: new Date().toISOString(),
      source: 'lens.accountsBulk',
    }

    let grove: GroveAttachment | undefined
    let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
    if (shouldStore) {
      const attempt = await tryUploadImmutableJson(mapping)
      if (attempt.ok) {
        grove = {
          lensUri: attempt.result.lensUri,
          gatewayUrl: attempt.result.gatewayUrl,
          storageKey: attempt.result.storageKey,
          statusUrl: attempt.result.statusUrl,
        }
        groveStatus = 'stored'
      } else {
        groveStatus = 'unavailable'
      }
    }

    return res.status(200).json({ success: true, data: { mapping, grove, groveStatus } } satisfies ApiEnvelope<LensMappingResponse>)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to resolve Lens mapping'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
