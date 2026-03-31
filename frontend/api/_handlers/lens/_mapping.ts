import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  readRequestPrincipalAddress,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'

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
  groveStatus?: 'stored' | 'unavailable' | 'skipped'
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

function parseStoreRequested(req: VercelRequest, body: LensMappingRequest): boolean {
  if (req.method === 'POST') return body.store === true
  const raw = typeof req.query.store === 'string' ? req.query.store.trim().toLowerCase() : ''
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }
  const clientIp = getClientIp(req) || 'unknown'
  const rate = checkRateLimit(rateLimitKey('lens-mapping', clientIp), RATE_LIMITS.general)
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  const body = req.method === 'POST' ? (await readJsonBody<LensMappingRequest>(req)) ?? {} : {}
  const addressRaw = body.address?.trim() || getAddressFromRequest(req) || ''

  const principalAddress = (readRequestPrincipalAddress(req, { lowercase: false }) ?? '').trim()
  const wallet = normalizeAddress(addressRaw || principalAddress)

  if (!wallet || !isAddressLike(wallet)) {
    return res.status(400).json({ success: false, error: 'address is required' } satisfies ApiEnvelope<never>)
  }

  const storeRequested = parseStoreRequested(req, body)
  if (storeRequested && !principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required for Grove uploads' } satisfies ApiEnvelope<never>)
  }
  const shouldStore = storeRequested

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
