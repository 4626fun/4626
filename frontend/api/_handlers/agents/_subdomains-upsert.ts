import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import {
  ensureAgentSubdomainsSchema,
  getDefaultParentDomain,
  getDefaultParentId,
  isAddressLike,
  isReservedSubdomainLabel,
  normalizeSubdomainLabel,
  upsertAgentSubdomain,
  type AgentSubdomainRecord,
} from '../../../server/_lib/agentSubdomains.js'
import { resolveLensUserByOwner } from '../../../server/_lib/lensAccounts.js'
import { getGroveChainId, tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { isAdminAddress } from '../../../server/_lib/session.js'

type UpsertBody = {
  label?: string
  parentId?: string | number
  parentDomain?: string
  subdomainId?: string | number | null
  chainId?: number | string
  ownerAddress?: string
  controllerAddress?: string | null
  metadata?: Record<string, unknown> | null
  storeOnGrove?: boolean
  resolveLens?: boolean
  active?: boolean
  source?: string
  txHash?: string | null
  blockNumber?: string | number | null
}

type SubdomainUpsertResponse = {
  record: AgentSubdomainRecord
  groveStatus: 'stored' | 'unavailable' | 'skipped'
  groveError?: string
}

function readBearerToken(req: VercelRequest): string {
  const header = String(req.headers.authorization ?? '').trim()
  if (!header.toLowerCase().startsWith('bearer ')) return ''
  return header.slice('bearer '.length).trim()
}

function parseChainId(value: unknown): number {
  const fallback = Number(String(process.env.SUBDOMAIN_CHAIN_ID ?? '1').trim())
  const defaultChainId = Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 1
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
  if (!Number.isFinite(n) || n <= 0) return defaultChainId
  return Math.floor(n)
}

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<UpsertBody>(req)) ?? {}

  const label = normalizeSubdomainLabel(String(body.label ?? ''))
  if (!label) {
    return res.status(400).json({ success: false, error: 'Invalid label' } satisfies ApiEnvelope<never>)
  }
  if (isReservedSubdomainLabel(label)) {
    return res.status(400).json({ success: false, error: 'Reserved label' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipal(req, { lowercase: true })
  const indexerSecret = String(process.env.SUBDOMAIN_INDEXER_SECRET ?? '').trim()
  const isIndexerWrite = Boolean(indexerSecret) && readBearerToken(req) === indexerSecret
  if (!principal && !isIndexerWrite) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const ownerAddressRaw = String(body.ownerAddress ?? principal?.address ?? '').trim().toLowerCase()
  if (!isAddressLike(ownerAddressRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid ownerAddress' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = String(principal?.address ?? '').trim().toLowerCase()
  const isPrincipalAdmin = isAddressLike(principalAddress) && isAdminAddress(principalAddress as `0x${string}`)
  if (principalAddress && ownerAddressRaw !== principalAddress && !isPrincipalAdmin && !isIndexerWrite) {
    return res.status(403).json({ success: false, error: 'Cannot write subdomain for another owner' } satisfies ApiEnvelope<never>)
  }

  const parentId = String(body.parentId ?? getDefaultParentId()).trim() || getDefaultParentId()
  const parentDomain = String(body.parentDomain ?? getDefaultParentDomain()).trim() || getDefaultParentDomain()
  const chainId = parseChainId(body.chainId)

  const metadataBase = parseObject(body.metadata) ?? {}
  const metadataPayload: Record<string, unknown> = {
    ...metadataBase,
    label,
    fullName: `${label}.${parentDomain.toLowerCase()}`,
    parentDomain: parentDomain.toLowerCase(),
    parentId,
    ownerAddress: ownerAddressRaw,
    chainId,
    updatedAt: new Date().toISOString(),
  }

  const shouldStoreOnGrove = body.storeOnGrove !== false
  const shouldResolveLens = body.resolveLens !== false

  let metadataLensUri: string | null = null
  let metadataGatewayUrl: string | null = null
  let metadataStorageKey: string | null = null
  let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
  let groveError: string | undefined

  if (shouldStoreOnGrove) {
    const attempt = await tryUploadImmutableJson(metadataPayload, getGroveChainId())
    if (attempt.ok) {
      metadataLensUri = attempt.result.lensUri
      metadataGatewayUrl = attempt.result.gatewayUrl
      metadataStorageKey = attempt.result.storageKey
      groveStatus = 'stored'
    } else {
      groveStatus = 'unavailable'
      groveError = attempt.error
    }
  }

  let lensHandle: string | null = null
  let lensAccountAddress: string | null = null
  let lensOwnerAddress: string | null = null
  if (shouldResolveLens) {
    const lensUser = await resolveLensUserByOwner(ownerAddressRaw)
    lensHandle = lensUser?.handle ?? null
    lensAccountAddress = lensUser?.accountAddress?.toLowerCase() ?? null
    lensOwnerAddress = lensUser?.ownerAddress?.toLowerCase() ?? null
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  }
  await ensureAgentSubdomainsSchema(db as any)

  try {
    const record = await upsertAgentSubdomain(db as any, {
      parentId,
      parentDomain,
      label,
      subdomainId: body.subdomainId == null ? null : String(body.subdomainId),
      chainId,
      ownerAddress: ownerAddressRaw,
      controllerAddress: body.controllerAddress ?? null,
      metadata: metadataPayload,
      metadataLensUri,
      metadataGatewayUrl,
      metadataStorageKey,
      lensHandle,
      lensAccountAddress,
      lensOwnerAddress,
      source: body.source || (isIndexerWrite ? 'indexer' : principal?.source || 'api'),
      txHash: body.txHash ?? null,
      blockNumber: body.blockNumber == null ? null : String(body.blockNumber),
      active: body.active !== false,
    })

    return res.status(200).json({
      success: true,
      data: {
        record,
        groveStatus,
        ...(groveError ? { groveError } : {}),
      } satisfies SubdomainUpsertResponse,
    } satisfies ApiEnvelope<SubdomainUpsertResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upsert subdomain'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
