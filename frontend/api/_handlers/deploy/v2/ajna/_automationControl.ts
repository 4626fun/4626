import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  readRequestPrincipalAddress,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { isServerAdminAddress } from '../../../../../server/_lib/infra/trust.js'
import {
  getAjnaVaultRegistryEntry,
  updateAjnaVaultAutomationConfig,
} from '../../../../../server/_lib/ajnaVaultManager/registry.js'

type ControlRequest = {
  chainId?: number | string
  creatorToken?: string
  strategyAdapter?: string
  automationStatus?: 'dry_run' | 'live' | 'paused' | 'halted'
  maxBucketStep?: number | string | null
  maxAssetsPerMove?: number | string | null
}

type ControlResponse = {
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
  status: 'dry_run' | 'live' | 'paused' | 'halted'
  maxBucketStep: number
  maxAssetsPerMove: string | null
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

function parseNullableInt(value: unknown): number | null | undefined {
  if (value == null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parseNullableBigInt(value: unknown): bigint | null | undefined {
  if (value == null || value === '') return undefined
  try {
    const parsed = BigInt(String(value).trim())
    return parsed >= 0n ? parsed : null
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req, { lowercase: true })
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Not authenticated' } satisfies ApiEnvelope<never>)
  }
  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })) as ControlRequest | null
  const chainId = normalizeChainId(body?.chainId)
  const creatorToken = normalizeAddress(body?.creatorToken)
  const strategyAdapter = normalizeAddress(body?.strategyAdapter)
  if (!creatorToken || !strategyAdapter) {
    return res.status(400).json({
      success: false,
      error: 'creatorToken and strategyAdapter are required',
    } satisfies ApiEnvelope<never>)
  }

  const registryRow = await getAjnaVaultRegistryEntry({ chainId, creatorToken, strategyAdapter })
  if (!registryRow) {
    return res.status(404).json({ success: false, error: 'Ajna vault registry entry not found' } satisfies ApiEnvelope<never>)
  }

  const chainScopedOwner = normalizeAddress(registryRow.ownerAddress)
  const normalizedPrincipal = getAddress(principalAddress as Address)
  const isAdmin = isServerAdminAddress(normalizedPrincipal)
  if (!isAdmin && (!chainScopedOwner || chainScopedOwner.toLowerCase() !== normalizedPrincipal.toLowerCase())) {
    return res.status(403).json({
      success: false,
      error: 'Creator owner access required for Ajna automation control',
    } satisfies ApiEnvelope<never>)
  }

  const automationStatus =
    body?.automationStatus == null
      ? undefined
      : ['dry_run', 'live', 'paused', 'halted'].includes(body.automationStatus)
        ? body.automationStatus
        : null
  const maxBucketStep = parseNullableInt(body?.maxBucketStep)
  const maxAssetsPerMove = parseNullableBigInt(body?.maxAssetsPerMove)
  if (automationStatus === null || maxBucketStep === null || maxAssetsPerMove === null) {
    return res.status(400).json({
      success: false,
      error: 'Invalid automationStatus/maxBucketStep/maxAssetsPerMove payload',
    } satisfies ApiEnvelope<never>)
  }

  const row = await updateAjnaVaultAutomationConfig({
    chainId,
    creatorToken,
    strategyAdapter,
    automationStatus,
    maxBucketStep,
    maxAssetsPerMove,
    metadataPatch: {
      lastControlUpdatedBy: normalizedPrincipal.toLowerCase(),
      lastControlUpdatedAt: new Date().toISOString(),
    },
  })
  if (!row) return res.status(500).json({ success: false, error: 'Ajna vault registry update failed' } satisfies ApiEnvelope<never>)

  const data: ControlResponse = {
    chainId,
    creatorToken,
    strategyAdapter,
    status: row.automationStatus,
    maxBucketStep: row.maxBucketStep,
    maxAssetsPerMove: row.maxAssetsPerMove == null ? null : row.maxAssetsPerMove.toString(),
    updatedAt: row.updatedAt,
  }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ControlResponse>)
}
