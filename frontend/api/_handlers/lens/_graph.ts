import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { resolveCanonicalSmartWalletAddress } from '../../../server/_lib/canonicalWalletResolver.js'
import { resolveLensUserByOwner } from '../../../server/_lib/lensAccounts.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type GraphNode = {
  id: string
  label: string
  type: 'wallet' | 'lens-account' | 'lens-owner'
  address?: string
  handle?: string | null
}

type GraphEdge = {
  source: string
  target: string
  type: 'wallet_to_lens' | 'lens_to_owner'
}

type GraphGroup = {
  id: string
  label: string
  nodeIds: string[]
  namespace?: string
}

type LensGraph = {
  requestedWallet: string
  wallet: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  groups: GraphGroup[]
  generatedAt: string
  source: string
}

type GroveAttachment = {
  lensUri: string
  gatewayUrl: string
  storageKey: string
  statusUrl: string | null
}

type LensGraphResponse = {
  graph: LensGraph | null
  grove?: GroveAttachment
  groveStatus?: 'stored' | 'unavailable' | 'skipped'
}

type LensGraphRequest = {
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

  const body = req.method === 'POST' ? (await readJsonBody<LensGraphRequest>(req)) ?? {} : {}
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
      return res.status(200).json({ success: true, data: { graph: null } } satisfies ApiEnvelope<LensGraphResponse>)
    }

    const walletNodeId = `wallet:${canonicalWallet}`
    const lensAccountId = `lens:account:${lensUser.accountAddress.toLowerCase()}`
    const lensOwnerId = lensUser.ownerAddress ? `lens:owner:${lensUser.ownerAddress.toLowerCase()}` : null

    const nodes: GraphNode[] = [
      { id: walletNodeId, label: canonicalWallet, type: 'wallet', address: canonicalWallet },
      {
        id: lensAccountId,
        label: lensUser.handle ? `@${lensUser.handle}` : lensUser.accountAddress,
        type: 'lens-account',
        address: lensUser.accountAddress,
        handle: lensUser.handle,
      },
    ]

    const edges: GraphEdge[] = [{ source: walletNodeId, target: lensAccountId, type: 'wallet_to_lens' }]

    if (lensOwnerId) {
      nodes.push({
        id: lensOwnerId,
        label: lensUser.ownerAddress ?? '',
        type: 'lens-owner',
        address: lensUser.ownerAddress ?? undefined,
      })
      edges.push({ source: lensAccountId, target: lensOwnerId, type: 'lens_to_owner' })
    }

    const groups: GraphGroup[] = [
      {
        id: 'namespace:wallet',
        label: 'Wallet namespace',
        nodeIds: [walletNodeId],
        namespace: `wallet:${canonicalWallet}`,
      },
    ]

    if (lensUser.handle) {
      groups.push({
        id: 'namespace:lens-handle',
        label: `Lens @${lensUser.handle}`,
        nodeIds: [lensAccountId],
        namespace: `lens:${lensUser.handle}`,
      })
    }

    if (lensOwnerId) {
      groups.push({
        id: 'namespace:lens-owner',
        label: 'Lens owner',
        nodeIds: [lensOwnerId],
        namespace: lensOwnerId,
      })
    }

    const graph: LensGraph = {
      requestedWallet: wallet,
      wallet: canonicalWallet,
      nodes,
      edges,
      groups,
      generatedAt: new Date().toISOString(),
      source: 'lens.accountsBulk',
    }

    let grove: GroveAttachment | undefined
    let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
    if (shouldStore) {
      const attempt = await tryUploadImmutableJson(graph)
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

    return res.status(200).json({ success: true, data: { graph, grove, groveStatus } } satisfies ApiEnvelope<LensGraphResponse>)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to build Lens graph'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
