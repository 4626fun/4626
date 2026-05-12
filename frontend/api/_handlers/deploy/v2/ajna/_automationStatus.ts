import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '../../../../../packages/server-core/src/index.js'
import { isServerAdminAddress } from '../../../../../server/_lib/infra/trust.js'
import { resolveCoinPartiesAndOwner } from '../../../../../server/_lib/onchain/coinParties.js'
import { getAjnaVaultRegistryEntry } from '../../../../../server/_lib/ajnaVaultManager/registry.js'

type AutomationStatusResponse = {
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
  principalAddress: Address
  creatorCoinOwner: Address | null
  status: 'dry_run' | 'live' | 'paused' | 'halted'
  maxBucketStep: number
  maxAssetsPerMove: string | null
  lastRunAt: string | null
  lastSuccessTx: string | null
  lastError: string | null
  updatedAt: string
}

function normalizeAddress(value: unknown): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!isAddress(trimmed)) return null
  return getAddress(trimmed)
}

function normalizeChainId(value: unknown): number {
  const parsed = Number(value ?? 8453)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8453
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }

  const creatorToken = normalizeAddress(req.query.creatorToken) ?? normalizeAddress(req.query.creator)
  const strategyAdapter = normalizeAddress(req.query.strategyAdapter)
  const chainId = normalizeChainId(req.query.chainId)
  if (!creatorToken || !strategyAdapter) {
    return res.status(400).json({
      success: false,
      error: 'creatorToken and strategyAdapter are required',
    } satisfies ApiEnvelope<never>)
  }

  const parties = await resolveCoinPartiesAndOwner(creatorToken)
  const creatorCoinOwner = normalizeAddress(parties.owner)
  const normalizedPrincipal = getAddress(principalAddress as Address)
  const isAdmin = isServerAdminAddress(normalizedPrincipal)
  if (!isAdmin && (!creatorCoinOwner || creatorCoinOwner.toLowerCase() !== normalizedPrincipal.toLowerCase())) {
    return res.status(403).json({
      success: false,
      error: 'Creator owner access required for Ajna automation diagnostics',
    } satisfies ApiEnvelope<never>)
  }

  const row = await getAjnaVaultRegistryEntry({ chainId, creatorToken, strategyAdapter })
  if (!row) {
    return res.status(404).json({ success: false, error: 'Ajna vault registry entry not found' } satisfies ApiEnvelope<never>)
  }

  const data: AutomationStatusResponse = {
    chainId,
    creatorToken,
    strategyAdapter,
    principalAddress: normalizedPrincipal,
    creatorCoinOwner,
    status: row.automationStatus,
    maxBucketStep: row.maxBucketStep,
    maxAssetsPerMove: row.maxAssetsPerMove == null ? null : row.maxAssetsPerMove.toString(),
    lastRunAt: row.lastRunAt,
    lastSuccessTx: row.lastSuccessTx,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AutomationStatusResponse>)
}
