import { getAddress, isAddress, type Address, type Hex } from 'viem'

import { getDb } from '../db/postgres.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type AjnaAutomationStatus = 'dry_run' | 'live' | 'paused' | 'halted'

export type AjnaVaultRegistryRow = {
  chainId: number
  creatorToken: Address
  creatorVault: Address
  strategyAdapter: Address
  innerAjnaVault: Address
  ajnaAuth: Address
  ajnaPool: Address
  ownerAddress: Address
  bufferRatioBps: number | null
  minBucketIndex: number | null
  maxBucketStep: number
  maxAssetsPerMove: bigint | null
  automationStatus: AjnaAutomationStatus
  lastRunAt: string | null
  lastSuccessTx: Hex | null
  lastError: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type UpsertAjnaVaultRegistryParams = {
  chainId: number
  creatorToken: Address
  creatorVault: Address
  strategyAdapter: Address
  innerAjnaVault: Address
  ajnaAuth: Address
  ajnaPool: Address
  ownerAddress: Address
  bufferRatioBps: number | null
  minBucketIndex: number | null
  metadata?: Record<string, unknown>
}

function normalizeAddressLower(value: string): Address {
  return getAddress(value).toLowerCase() as Address
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function parseAutomationStatus(value: unknown): AjnaAutomationStatus {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'dry_run' || raw === 'live' || raw === 'paused' || raw === 'halted') return raw
  return 'paused'
}

function parseHex(value: unknown): Hex | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return /^0x[a-fA-F0-9]{64}$/.test(raw) ? (raw as Hex) : null
}

function parseRow(row: any): AjnaVaultRegistryRow | null {
  const creatorToken = typeof row.creator_token === 'string' && isAddress(row.creator_token)
    ? normalizeAddressLower(row.creator_token)
    : null
  const creatorVault = typeof row.creator_vault === 'string' && isAddress(row.creator_vault)
    ? normalizeAddressLower(row.creator_vault)
    : null
  const strategyAdapter = typeof row.strategy_adapter === 'string' && isAddress(row.strategy_adapter)
    ? normalizeAddressLower(row.strategy_adapter)
    : null
  const innerAjnaVault = typeof row.inner_ajna_vault === 'string' && isAddress(row.inner_ajna_vault)
    ? normalizeAddressLower(row.inner_ajna_vault)
    : null
  const ajnaAuth = typeof row.ajna_auth === 'string' && isAddress(row.ajna_auth)
    ? normalizeAddressLower(row.ajna_auth)
    : null
  const ajnaPool = typeof row.ajna_pool === 'string' && isAddress(row.ajna_pool)
    ? normalizeAddressLower(row.ajna_pool)
    : null
  const ownerAddress = typeof row.owner_address === 'string' && isAddress(row.owner_address)
    ? normalizeAddressLower(row.owner_address)
    : null
  const chainId = Number(row.chain_id ?? 0)
  const maxBucketStep = Number(row.max_bucket_step ?? 20)
  if (
    !Number.isFinite(chainId) ||
    chainId <= 0 ||
    !creatorToken ||
    !creatorVault ||
    !strategyAdapter ||
    !innerAjnaVault ||
    !ajnaAuth ||
    !ajnaPool ||
    !ownerAddress ||
    !Number.isFinite(maxBucketStep)
  ) {
    return null
  }

  const bufferRatioRaw = row.buffer_ratio_bps
  const minBucketRaw = row.min_bucket_index
  const bufferRatioBps = Number.isFinite(Number(bufferRatioRaw)) ? Number(bufferRatioRaw) : null
  const minBucketIndex = Number.isFinite(Number(minBucketRaw)) ? Number(minBucketRaw) : null
  const maxAssetsRaw = row.max_assets_per_move
  const maxAssetsPerMove = maxAssetsRaw == null ? null : BigInt(maxAssetsRaw)

  return {
    chainId: Math.trunc(chainId),
    creatorToken,
    creatorVault,
    strategyAdapter,
    innerAjnaVault,
    ajnaAuth,
    ajnaPool,
    ownerAddress,
    bufferRatioBps,
    minBucketIndex,
    maxBucketStep: Math.trunc(maxBucketStep),
    maxAssetsPerMove,
    automationStatus: parseAutomationStatus(row.automation_status),
    lastRunAt:
      typeof row.last_run_at === 'string'
        ? row.last_run_at
        : row.last_run_at instanceof Date
          ? row.last_run_at.toISOString()
          : null,
    lastSuccessTx: parseHex(row.last_success_tx),
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
    metadata: asRecord(row.metadata),
    createdAt:
      typeof row.created_at === 'string'
        ? row.created_at
        : row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(0).toISOString(),
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(0).toISOString(),
  }
}

export async function upsertAjnaVaultRegistryEntry(params: UpsertAjnaVaultRegistryParams): Promise<AjnaVaultRegistryRow | null> {
  const db = (await getDb()) as Db | null
  if (!db) return null

  const result = await db.sql`
    INSERT INTO public.ajna_vaults (
      chain_id,
      creator_token,
      creator_vault,
      strategy_adapter,
      inner_ajna_vault,
      ajna_auth,
      ajna_pool,
      owner_address,
      buffer_ratio_bps,
      min_bucket_index,
      metadata
    ) VALUES (
      ${params.chainId},
      ${params.creatorToken.toLowerCase()},
      ${params.creatorVault.toLowerCase()},
      ${params.strategyAdapter.toLowerCase()},
      ${params.innerAjnaVault.toLowerCase()},
      ${params.ajnaAuth.toLowerCase()},
      ${params.ajnaPool.toLowerCase()},
      ${params.ownerAddress.toLowerCase()},
      ${params.bufferRatioBps},
      ${params.minBucketIndex},
      ${JSON.stringify(params.metadata ?? {})}::jsonb
    )
    ON CONFLICT (chain_id, creator_token, strategy_adapter)
    DO UPDATE SET
      creator_vault = EXCLUDED.creator_vault,
      inner_ajna_vault = EXCLUDED.inner_ajna_vault,
      ajna_auth = EXCLUDED.ajna_auth,
      ajna_pool = EXCLUDED.ajna_pool,
      owner_address = EXCLUDED.owner_address,
      buffer_ratio_bps = EXCLUDED.buffer_ratio_bps,
      min_bucket_index = EXCLUDED.min_bucket_index,
      metadata = CASE
        WHEN COALESCE(ajna_vaults.metadata, '{}'::jsonb) = '{}'::jsonb THEN EXCLUDED.metadata
        ELSE ajna_vaults.metadata || EXCLUDED.metadata
      END,
      updated_at = NOW()
    RETURNING *;
  `

  return parseRow(result.rows?.[0] ?? null)
}

export async function listAjnaVaultRegistryEntries(params?: {
  chainId?: number
  statuses?: AjnaAutomationStatus[]
  limit?: number
}): Promise<AjnaVaultRegistryRow[]> {
  const db = (await getDb()) as Db | null
  if (!db) return []

  const limit = Math.max(1, Math.min(200, Math.trunc(params?.limit ?? 100)))
  const chainId = Number.isFinite(Number(params?.chainId)) && Number(params?.chainId) > 0
    ? Math.trunc(Number(params?.chainId))
    : null
  const statuses = Array.isArray(params?.statuses) ? params.statuses.filter(Boolean) : []
  const rows = await db.sql`
    SELECT *
    FROM public.ajna_vaults
    WHERE (${chainId}::integer IS NULL OR chain_id = ${chainId})
      AND (
        ${statuses.length} = 0
        OR automation_status = ANY(${statuses}::text[])
      )
    ORDER BY updated_at DESC
    LIMIT ${limit};
  `
  return (rows.rows ?? []).map(parseRow).filter((entry): entry is AjnaVaultRegistryRow => Boolean(entry))
}

export async function getAjnaVaultRegistryEntry(params: {
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
}): Promise<AjnaVaultRegistryRow | null> {
  const db = (await getDb()) as Db | null
  if (!db) return null

  const row = await db.sql`
    SELECT *
    FROM public.ajna_vaults
    WHERE chain_id = ${params.chainId}
      AND creator_token = ${params.creatorToken.toLowerCase()}
      AND strategy_adapter = ${params.strategyAdapter.toLowerCase()}
    LIMIT 1;
  `
  return parseRow(row.rows?.[0] ?? null)
}

export async function recordAjnaVaultManagerRun(params: {
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
  txHash?: Hex | null
  error?: string | null
  metadataPatch?: Record<string, unknown>
}): Promise<AjnaVaultRegistryRow | null> {
  const db = (await getDb()) as Db | null
  if (!db) return null
  const row = await db.sql`
    UPDATE public.ajna_vaults
    SET
      last_run_at = NOW(),
      last_success_tx = CASE
        WHEN ${params.txHash ?? null}::text IS NULL THEN last_success_tx
        ELSE ${params.txHash ?? null}
      END,
      last_error = CASE
        WHEN ${params.error ?? null}::text IS NULL THEN NULL
        ELSE ${params.error ?? null}
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(params.metadataPatch ?? {})}::jsonb,
      updated_at = NOW()
    WHERE chain_id = ${params.chainId}
      AND creator_token = ${params.creatorToken.toLowerCase()}
      AND strategy_adapter = ${params.strategyAdapter.toLowerCase()}
    RETURNING *;
  `
  return parseRow(row.rows?.[0] ?? null)
}

export async function setAjnaVaultAutomationStatus(params: {
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
  automationStatus: AjnaAutomationStatus
  metadataPatch?: Record<string, unknown>
}): Promise<AjnaVaultRegistryRow | null> {
  const db = (await getDb()) as Db | null
  if (!db) return null

  const row = await db.sql`
    UPDATE public.ajna_vaults
    SET
      automation_status = ${params.automationStatus},
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(params.metadataPatch ?? {})}::jsonb,
      updated_at = NOW()
    WHERE chain_id = ${params.chainId}
      AND creator_token = ${params.creatorToken.toLowerCase()}
      AND strategy_adapter = ${params.strategyAdapter.toLowerCase()}
    RETURNING *;
  `
  return parseRow(row.rows?.[0] ?? null)
}

export async function updateAjnaVaultAutomationConfig(params: {
  chainId: number
  creatorToken: Address
  strategyAdapter: Address
  automationStatus?: AjnaAutomationStatus
  maxBucketStep?: number | null
  maxAssetsPerMove?: bigint | null
  metadataPatch?: Record<string, unknown>
}): Promise<AjnaVaultRegistryRow | null> {
  const db = (await getDb()) as Db | null
  if (!db) return null

  const maxBucketStep =
    params.maxBucketStep == null ? null : Math.max(1, Math.min(1000, Math.trunc(params.maxBucketStep)))
  const maxAssetsPerMove = params.maxAssetsPerMove == null ? null : params.maxAssetsPerMove.toString()
  const automationStatus = params.automationStatus ?? null

  const row = await db.sql`
    UPDATE public.ajna_vaults
    SET
      automation_status = COALESCE(${automationStatus}::text, automation_status),
      max_bucket_step = COALESCE(${maxBucketStep}::integer, max_bucket_step),
      max_assets_per_move = CASE
        WHEN ${maxAssetsPerMove}::text IS NULL THEN max_assets_per_move
        ELSE ${maxAssetsPerMove}::numeric
      END,
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(params.metadataPatch ?? {})}::jsonb,
      updated_at = NOW()
    WHERE chain_id = ${params.chainId}
      AND creator_token = ${params.creatorToken.toLowerCase()}
      AND strategy_adapter = ${params.strategyAdapter.toLowerCase()}
    RETURNING *;
  `
  return parseRow(row.rows?.[0] ?? null)
}
