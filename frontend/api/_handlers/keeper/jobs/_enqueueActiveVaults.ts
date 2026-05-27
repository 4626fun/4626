import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getDbForCron,
  handleOptions,
  isDbConfigured,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { ensureKeeprSchema } from '../../../../server/_lib/keepr/keeprSchema.js'
import { isAuthorizedCron } from '../../../../server/_lib/lottery/cronAuth.js'
import { enqueueKeeperJob, type KeeperJob } from '../../../../server/_lib/keeperJobs/keeperJobs.js'
import { validateKeeperVaultListing } from '../../../../server/_lib/onchain/creatorRegistryVerification.js'
import { parseMinDeviationBps } from '../../../../server/_lib/keeper/strategyReallocEnv.js'

type ActiveVaultEnqueueResponse = {
  enabled: boolean
  jobs: KeeperJob[]
  scanned: number
  workflows: string[]
  reason?: string
}

type ActiveVaultRow = {
  vault_address: string
  chain_id: number
  creator_coin_address: string
  share_token_address: string | null
  settled_at: string | null
  config_json: Record<string, unknown> | string | null
}

const VALID_WORKFLOWS = new Set(['sweep', 'tend', 'report', 'payout', 'rebalance'])

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function envBool(name: string): boolean {
  return ['1', 'true', 'yes'].includes(env(name).toLowerCase())
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? (raw as `0x${string}`) : null
}

function configObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
}

function contractsFromConfig(raw: unknown): Record<string, unknown> {
  const cfg = configObject(raw)
  const contracts = cfg.contracts
  return contracts && typeof contracts === 'object' && !Array.isArray(contracts) ? contracts as Record<string, unknown> : {}
}

function vaultFromConfig(raw: unknown): Record<string, unknown> {
  const cfg = configObject(raw)
  const vault = cfg.vault
  return vault && typeof vault === 'object' && !Array.isArray(vault) ? vault as Record<string, unknown> : {}
}

function readWorkflows(): string[] {
  const raw = env('KEEPER_ACTIVE_VAULT_WORKFLOWS')
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(/[\s,]+/g)) {
    const workflow = part.trim().toLowerCase()
    if (VALID_WORKFLOWS.has(workflow) && !out.includes(workflow)) out.push(workflow)
  }
  return out
}

function payoutRecipientMode(): 'gauge' | 'payout_router' {
  return env('KEEPER_ACTIVE_VAULT_PAYOUT_RECIPIENT_MODE') === 'payout_router' ? 'payout_router' : 'gauge'
}

function enforceInvariants(): boolean {
  return env('KEEPER_ACTIVE_VAULT_ENFORCE_INVARIANTS').toLowerCase() !== 'false'
}

function chainIdFilter(): number {
  const parsed = Number(env('KEEPER_ACTIVE_VAULT_CHAIN_ID') || 8453)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8453
}

function maxVaults(): number {
  const parsed = Number(env('KEEPER_ACTIVE_VAULT_LIMIT') || 5)
  return Number.isInteger(parsed) ? Math.min(50, Math.max(1, parsed)) : 5
}

function validateListingBeforeEnqueue(): boolean {
  return env('KEEPER_ACTIVE_VAULT_VALIDATE_LISTING').toLowerCase() !== 'false'
}

async function rowPassesKeeperListing(row: ActiveVaultRow): Promise<boolean> {
  const vaultAddress = normalizeAddress(row.vault_address)
  const creatorCoinAddress = normalizeAddress(row.creator_coin_address)
  if (!vaultAddress || !creatorCoinAddress) return false

  const vaultCfg = vaultFromConfig(row.config_json)
  const shareTokenAddress =
    normalizeAddress(vaultCfg.shareTokenAddress) ?? normalizeAddress(row.share_token_address)

  try {
    const validation = await validateKeeperVaultListing({
      creatorCoinAddress,
      vaultAddress,
      shareTokenAddress,
    })
    return validation.ok
  } catch (error) {
    console.warn('[keeper/enqueue-active-vaults] listing validation unavailable', {
      vaultAddress,
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function readVaultRows(): Promise<ActiveVaultRow[]> {
  if (!isDbConfigured()) throw new Error('db_not_configured')
  await ensureKeeprSchema()
  const db = await getDbForCron()
  if (!db) throw new Error('db_unavailable')
  const chainId = chainIdFilter()
  const limit = maxVaults()
  const result = await db.sql`
    WITH eligible AS (
      SELECT
        vault_address,
        chain_id,
        creator_coin_address,
        share_token_address,
        settled_at,
        config_json,
        ROW_NUMBER() OVER (ORDER BY created_at ASC, vault_address ASC) - 1 AS row_index,
        COUNT(*) OVER () AS total_count
      FROM keepr_vaults
      WHERE chain_id = ${chainId}
    ),
    rotated AS (
      SELECT
        *,
        CASE
          WHEN total_count <= 0 THEN 0
          ELSE (FLOOR(EXTRACT(EPOCH FROM NOW()) / 300)::bigint % total_count)
        END AS rotation_offset
      FROM eligible
    )
    SELECT vault_address, chain_id, creator_coin_address, share_token_address, settled_at, config_json
    FROM rotated
    ORDER BY ((row_index - rotation_offset + total_count) % total_count), row_index
    LIMIT ${limit};
  `
  return (result.rows ?? []) as ActiveVaultRow[]
}

function sweepPayload(row: ActiveVaultRow): Record<string, unknown> | null {
  if (row.settled_at) return null
  const contracts = contractsFromConfig(row.config_json)
  const vaultCfg = vaultFromConfig(row.config_json)
  const ccaStrategyAddress = normalizeAddress(contracts.ccaStrategy)
  if (!ccaStrategyAddress) return null
  const vaultAddress = normalizeAddress(row.vault_address)
  const creatorCoinAddress = normalizeAddress(row.creator_coin_address)
  const shareTokenAddress = normalizeAddress(vaultCfg.shareTokenAddress) ?? normalizeAddress(row.share_token_address)
  const gaugeControllerAddress = normalizeAddress(contracts.gaugeController)
  if (!vaultAddress || !creatorCoinAddress || !shareTokenAddress || !gaugeControllerAddress) return null

  const mode = payoutRecipientMode()
  const invariants: Record<string, unknown> = {
    creatorCoinAddress,
    shareTokenAddress,
    gaugeControllerAddress,
    payoutRecipientMode: mode,
  }
  if (mode === 'payout_router') {
    const payoutRouterAddress = normalizeAddress(contracts.payoutRouter)
    const burnStreamAddress = normalizeAddress(contracts.burnStream)
    if (!payoutRouterAddress || !burnStreamAddress) return null
    invariants.payoutRouterAddress = payoutRouterAddress
    invariants.burnStreamAddress = burnStreamAddress
  }

  return {
    path: '/api/keeper/sweep',
    body: {
      ccaStrategyAddress,
      enforceInvariants: enforceInvariants(),
      markSettled: { vaultAddress },
      invariants,
    },
  }
}

function vaultActionPayload(row: ActiveVaultRow, action: 'tend' | 'report'): Record<string, unknown> | null {
  const vaultAddress = normalizeAddress(row.vault_address)
  if (!vaultAddress) return null
  return {
    path: `/api/keeper/${action}`,
    body: { vaultAddress },
  }
}

function rebalancePayload(row: ActiveVaultRow): Record<string, unknown> | null {
  const vaultAddress = normalizeAddress(row.vault_address)
  if (!vaultAddress) return null
  const minDeviationBps = String(parseMinDeviationBps(env('VAULT_STRATEGY_REALLOC_MIN_DEVIATION_BPS') || undefined))
  return {
    path: '/api/keeper/rebalance-strategies',
    body: { vaultAddress, minDeviationBps },
  }
}

function payoutPayload(row: ActiveVaultRow): Record<string, unknown> | null {
  const contracts = contractsFromConfig(row.config_json)
  const payoutRouterAddress = normalizeAddress(contracts.payoutRouter)
  const creatorCoinAddress = normalizeAddress(row.creator_coin_address)
  if (!payoutRouterAddress || !creatorCoinAddress) return null
  return {
    path: '/api/keeper/payout-router-harvest',
    body: {
      payoutRouterAddress,
      creatorCoinAddress,
      includeZora: true,
      includeWeth: true,
      claimProtocolRewards: true,
    },
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!isAuthorizedCron(req)) {
    return res.status(401).json({ success: false, error: 'unauthorized' } satisfies ApiEnvelope<never>)
  }

  if (!envBool('KEEPER_ACTIVE_VAULT_ENQUEUE_ENABLED')) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], scanned: 0, workflows: [], reason: 'disabled' },
    } satisfies ApiEnvelope<ActiveVaultEnqueueResponse>)
  }

  const workflows = readWorkflows()
  if (workflows.length === 0) {
    return res.status(200).json({
      success: true,
      data: { enabled: false, jobs: [], scanned: 0, workflows: [], reason: 'no_workflows_configured' },
    } satisfies ApiEnvelope<ActiveVaultEnqueueResponse>)
  }

  const rows = await readVaultRows()
  const jobs: KeeperJob[] = []
  const shouldValidateListing = validateListingBeforeEnqueue()
  for (const row of rows) {
    if (shouldValidateListing) {
      const listingOk = await rowPassesKeeperListing(row)
      if (!listingOk) {
        console.warn('[keeper/enqueue-active-vaults] skipping vault — keeper listing validation failed', {
          vaultAddress: normalizeAddress(row.vault_address),
        })
        continue
      }
    }
    if (workflows.includes('sweep')) {
      const payload = sweepPayload(row)
      const strategy = normalizeAddress((payload?.body as Record<string, unknown> | undefined)?.ccaStrategyAddress)
      if (payload && strategy) {
        jobs.push(await enqueueKeeperJob({
          kind: 'internal_api',
          dedupeKey: `active-sweep:${strategy}`,
          source: 'keeper-active-vaults',
          payload,
          maxAttempts: 3,
        }))
      }
    }
    for (const action of ['tend', 'report'] as const) {
      if (!workflows.includes(action)) continue
      const payload = vaultActionPayload(row, action)
      const vaultAddress = normalizeAddress(row.vault_address)
      if (payload && vaultAddress) {
        jobs.push(await enqueueKeeperJob({
          kind: 'internal_api',
          dedupeKey: `active-${action}:${vaultAddress}`,
          source: 'keeper-active-vaults',
          payload,
          maxAttempts: 3,
        }))
      }
    }
    if (workflows.includes('rebalance')) {
      const payload = rebalancePayload(row)
      const vaultAddress = normalizeAddress(row.vault_address)
      if (payload && vaultAddress) {
        jobs.push(await enqueueKeeperJob({
          kind: 'internal_api',
          dedupeKey: `active-rebalance:${vaultAddress}`,
          source: 'keeper-active-vaults',
          payload,
          maxAttempts: 3,
        }))
      }
    }
    if (workflows.includes('payout')) {
      const payload = payoutPayload(row)
      const vaultAddress = normalizeAddress(row.vault_address)
      if (payload && vaultAddress) {
        jobs.push(await enqueueKeeperJob({
          kind: 'internal_api',
          dedupeKey: `active-payout:${vaultAddress}`,
          source: 'keeper-active-vaults',
          payload,
          maxAttempts: 3,
        }))
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: { enabled: true, jobs, scanned: rows.length, workflows },
  } satisfies ApiEnvelope<ActiveVaultEnqueueResponse>)
}
