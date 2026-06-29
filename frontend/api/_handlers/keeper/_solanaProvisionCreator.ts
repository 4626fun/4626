/**
 * POST /api/keeper/solana/provision-creator
 *
 * Machine-auth provisioning checkpoint for Solana share-mesh follow-up after
 * vault_full_deploy payment or post-deploy vault settlement.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress, isAddress, type Address } from 'viem'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
  getDbForCron,
  isDbConfigured,
} from '@4626/server-core'

import { listActivationsForCreator } from '../../../server/_lib/creatorStrategy/activations.js'
import { creatorHasSolanaShareMeshEntitlement } from '../../../server/_lib/creatorStrategy/solanaShareMeshProvisioning.js'
import {
  ensureSolanaHookStatusSchema,
  ensureSolanaMeteoraPoolStatusSchema,
  ensureSolanaShareMeshMappingsSchema,
} from '../../../server/_lib/db/schemaBootstrap.js'
import { SOLANA_NATIVE_MINT } from '../../../server/_lib/onchain/meteoraAlphaVaultConfig.js'
import { readSolanaHookStatusByCreatorToken } from '../../../server/_lib/onchain/solanaHookStatus.js'
import { listSolanaShareMeshMappingsForCreator } from '../../../server/_lib/onchain/solanaShareMeshMappings.js'

type Body = {
  creatorToken?: unknown
  activationId?: unknown
  paymentSource?: unknown
  trigger?: unknown
  vaultAddress?: unknown
  deploySessionId?: unknown
  shareMeshMint?: unknown
  shareOft?: unknown
}

type ShareMeshMappingSummary =
  | { status: 'found'; shareOft: string; shareMeshMint: string; sourceSessionId: string | null; mappingStatus: string }
  | { status: 'provided'; shareOft: string | null; shareMeshMint: string; sourceSessionId: string | null; mappingStatus: 'provided' }
  | { status: 'missing' }

type MeteoraPoolProvisionResult =
  | { status: 'disabled'; reason: string }
  | { status: 'waiting_for_share_mesh_mint' }
  | { status: 'skipped_unconfigured'; reason: string; tokenMintX: string; tokenMintY: string }
  | { status: 'completed'; tokenMintX: string; tokenMintY: string; poolAddress: string | null; signature: string | null; response: unknown }
  | { status: 'failed'; tokenMintX: string; tokenMintY: string; error: string; upstreamStatusCode?: number; response?: unknown }

type HookProvisionResult =
  | { status: 'disabled'; reason: string }
  | { status: 'waiting_for_share_oft' }
  | { status: 'skipped_unconfigured'; reason: string }
  | { status: 'completed'; hookMint: string; creatorConfig: string | null; pendingEntries: string | null; winnerRecord: string | null; response: unknown }
  | { status: 'failed'; error: string; upstreamStatusCode?: number; response?: unknown }

type ProvisionChecklist = {
  creatorToken: Address
  trigger: string
  orchestratorConfigured: boolean
  orchestratorHealthy: boolean | null
  entitlementConfirmed: boolean
  shareMeshMapping: ShareMeshMappingSummary
  hookLane: HookProvisionResult
  meteoraPool: MeteoraPoolProvisionResult
  nextSteps: string[]
  runbook: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function envFlag(name: string, fallback = false): boolean {
  const raw = env(name).toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(env(name), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function isSolanaPubkey(value: unknown): value is string {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

function normalizeOptionalAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function deriveCreatePoolUrl(): string {
  const explicit = env('SOLANA_METEORA_POOL_PROVISIONER_URL')
  if (explicit) return explicit
  const dynamic = env('SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL')
  if (dynamic) return dynamic.replace(/\/provision\/?$/, '/create-pool')
  return ''
}

function deriveSetupCreatorUrl(): string {
  const explicit = env('SOLANA_HOOK_PROVISIONER_URL')
  if (explicit) return explicit
  const dynamic = env('SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL')
  if (dynamic) return dynamic.replace(/\/provision\/?$/, '/setup-creator')
  return ''
}

function readCreatePoolSecret(): string {
  return (
    env('SOLANA_METEORA_POOL_PROVISIONER_SECRET') ||
    env('SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET') ||
    env('METEORA_IX_PROVISIONER_SECRET')
  )
}

function readSetupCreatorSecret(): string {
  return (
    env('SOLANA_HOOK_PROVISIONER_SECRET') ||
    env('SOLANA_METEORA_POOL_PROVISIONER_SECRET') ||
    env('SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET') ||
    env('METEORA_IX_PROVISIONER_SECRET')
  )
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readPoolAddress(response: unknown): string | null {
  const raw = readObject(response)
  if (!raw) return null
  const data = readObject(raw.data)
  const candidates = [raw.poolAddress, raw.pool, data?.poolAddress, data?.pool]
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : ''
    if (isSolanaPubkey(value)) return value
  }
  const output = typeof raw.output === 'string' ? raw.output : typeof data?.output === 'string' ? data.output : ''
  const match = output.match(/Pool(?:\s*\(PDA\))?:\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i)
  return match?.[1] ?? null
}

function readSignature(response: unknown): string | null {
  const raw = readObject(response)
  if (!raw) return null
  const data = readObject(raw.data)
  const candidates = [raw.signature, data?.signature]
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : ''
    if (value) return value.slice(0, 160)
  }
  const output = typeof raw.output === 'string' ? raw.output : typeof data?.output === 'string' ? data.output : ''
  const match = output.match(/Signature:\s*([^\s]+)/i)
  return match?.[1] ? match[1].slice(0, 160) : null
}

function readSetupCreatorMint(response: unknown): string | null {
  const raw = readObject(response)
  if (!raw) return null
  const candidates = [raw.mint, readObject(raw.data)?.mint]
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : ''
    if (isSolanaPubkey(value)) return value
  }
  return null
}

function readSetupCreatorPdas(response: unknown): {
  creatorConfig: string | null
  pendingEntries: string | null
  winnerRecord: string | null
} {
  const raw = readObject(response)
  const pdas = readObject(raw?.pdas) ?? readObject(readObject(raw?.data)?.pdas)
  if (!pdas) {
    return { creatorConfig: null, pendingEntries: null, winnerRecord: null }
  }
  const readPubkey = (value: unknown): string | null => {
    const candidate = typeof value === 'string' ? value.trim() : ''
    return isSolanaPubkey(candidate) ? candidate : null
  }
  return {
    creatorConfig: readPubkey(pdas.creatorConfig),
    pendingEntries: readPubkey(pdas.pendingEntries),
    winnerRecord: readPubkey(pdas.winnerRecord),
  }
}

function resolveShareOft(params: { mapping: ShareMeshMappingSummary; body: Body }): string | null {
  if (params.mapping.status !== 'missing') {
    const fromMapping = params.mapping.shareOft
    if (fromMapping) return fromMapping.toLowerCase()
  }
  return normalizeOptionalAddress(params.body.shareOft)?.toLowerCase() ?? null
}

function resolveSourceSessionId(params: { mapping: ShareMeshMappingSummary; body: Body }): string | null {
  if (params.mapping.status !== 'missing' && params.mapping.sourceSessionId) {
    return params.mapping.sourceSessionId
  }
  const fromBody = typeof params.body.deploySessionId === 'string' ? params.body.deploySessionId.trim() : ''
  return fromBody || null
}

async function pingOrchestratorHealth(): Promise<boolean | null> {
  const base = env('SOLANA_ORCHESTRATOR_URL').replace(/\/+$/, '')
  if (!base) return null
  const headers: Record<string, string> = {}
  const apiKey = env('SOLANA_ORCHESTRATOR_API_KEY')
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  try {
    const res = await fetch(`${base}/healthz`, { method: 'GET', headers })
    return res.ok
  } catch {
    return false
  }
}

async function readShareMeshMapping(params: {
  db: { sql: any }
  creatorToken: Address
  body: Body
}): Promise<ShareMeshMappingSummary> {
  const providedMint = typeof params.body.shareMeshMint === 'string' ? params.body.shareMeshMint.trim() : ''
  if (isSolanaPubkey(providedMint)) {
    const providedShareOft = normalizeOptionalAddress(params.body.shareOft)
    return {
      status: 'provided',
      shareOft: providedShareOft ? providedShareOft.toLowerCase() : null,
      shareMeshMint: providedMint,
      sourceSessionId: typeof params.body.deploySessionId === 'string' ? params.body.deploySessionId.trim() || null : null,
      mappingStatus: 'provided',
    }
  }

  await ensureSolanaShareMeshMappingsSchema(params.db as any)
  const mappings = await listSolanaShareMeshMappingsForCreator({
    db: params.db as any,
    creatorToken: params.creatorToken,
  })
  const selected =
    mappings.find((row) => row.status === 'applied') ??
    mappings.find((row) => row.status === 'pending') ??
    mappings[0]
  if (!selected) return { status: 'missing' }
  return {
    status: 'found',
    shareOft: selected.shareOft,
    shareMeshMint: selected.shareMeshMint,
    sourceSessionId: selected.sourceSessionId,
    mappingStatus: selected.status,
  }
}

async function recordMeteoraPoolAttempt(params: {
  db: { sql: any }
  creatorToken: Address
  mapping: Extract<ShareMeshMappingSummary, { status: 'found' | 'provided' }>
  quoteMint: string
  status: 'creating' | 'created' | 'failed' | 'skipped'
  poolAddress?: string | null
  signature?: string | null
  error?: string | null
  response?: unknown
}): Promise<void> {
  await ensureSolanaMeteoraPoolStatusSchema(params.db as any)
  await params.db.sql`
    INSERT INTO solana_meteora_pool_status (
      creator_token,
      share_oft,
      share_mesh_mint,
      quote_mint,
      pool_address,
      status,
      provision_attempt_count,
      last_signature,
      last_error,
      response_json,
      source_session_id,
      updated_at
    ) VALUES (
      ${params.creatorToken.toLowerCase()},
      ${params.mapping.shareOft},
      ${params.mapping.shareMeshMint},
      ${params.quoteMint},
      ${params.poolAddress ?? null},
      ${params.status},
      1,
      ${params.signature ?? null},
      ${params.error ?? null},
      ${JSON.stringify(params.response ?? null)}::jsonb,
      ${params.mapping.sourceSessionId ?? null},
      NOW()
    )
    ON CONFLICT (share_mesh_mint, quote_mint)
    DO UPDATE SET
      creator_token = EXCLUDED.creator_token,
      share_oft = COALESCE(EXCLUDED.share_oft, solana_meteora_pool_status.share_oft),
      pool_address = COALESCE(EXCLUDED.pool_address, solana_meteora_pool_status.pool_address),
      status = EXCLUDED.status,
      provision_attempt_count = solana_meteora_pool_status.provision_attempt_count + 1,
      last_signature = COALESCE(EXCLUDED.last_signature, solana_meteora_pool_status.last_signature),
      last_error = EXCLUDED.last_error,
      response_json = EXCLUDED.response_json,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_meteora_pool_status.source_session_id),
      updated_at = NOW();
  `
}

async function maybeCreateMeteoraPool(params: {
  db: { sql: any }
  creatorToken: Address
  mapping: ShareMeshMappingSummary
}): Promise<MeteoraPoolProvisionResult> {
  if (params.mapping.status === 'missing') return { status: 'waiting_for_share_mesh_mint' }
  if (!envFlag('SOLANA_METEORA_POOL_PROVISIONING_ENABLED', false)) {
    return { status: 'disabled', reason: 'SOLANA_METEORA_POOL_PROVISIONING_ENABLED is not enabled' }
  }

  const tokenMintX = params.mapping.shareMeshMint
  const tokenMintY = envFlag('SOLANA_STRICT_SOL_PAIR', false)
    ? SOLANA_NATIVE_MINT
    : env('SOLANA_METEORA_POOL_QUOTE_MINT') || SOLANA_NATIVE_MINT
  const url = deriveCreatePoolUrl()
  const secret = readCreatePoolSecret()
  if (!url || !secret) {
    const reason = !url ? 'create_pool_provisioner_url_missing' : 'create_pool_provisioner_secret_missing'
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'skipped',
      error: reason,
    })
    return { status: 'skipped_unconfigured', reason, tokenMintX, tokenMintY }
  }

  await recordMeteoraPoolAttempt({
    db: params.db,
    creatorToken: params.creatorToken,
    mapping: params.mapping,
    quoteMint: tokenMintY,
    status: 'creating',
  })

  const requestBody = {
    tokenMintX,
    tokenMintY,
    binStep: readIntEnv('SOLANA_METEORA_POOL_BIN_STEP', 25, 1, 10_000),
    activeId: readIntEnv('SOLANA_METEORA_POOL_ACTIVE_ID', 0, -8_388_608, 8_388_607),
    baseFactor: readIntEnv('SOLANA_METEORA_POOL_BASE_FACTOR', 10_000, 1, 1_000_000),
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(readIntEnv('SOLANA_METEORA_POOL_PROVISIONER_TIMEOUT_MS', 300_000, 30_000, 600_000)),
  })
  const payload = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }))
  if (!response.ok || (readObject(payload)?.success === false)) {
    const objectPayload = readObject(payload)
    const error = typeof objectPayload?.error === 'string' ? objectPayload.error : `create_pool_failed:${response.status}`
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'failed',
      error,
      response: payload,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error, upstreamStatusCode: response.status, response: payload }
  }

  const poolAddress = readPoolAddress(payload)
  const signature = readSignature(payload)
  await recordMeteoraPoolAttempt({
    db: params.db,
    creatorToken: params.creatorToken,
    mapping: params.mapping,
    quoteMint: tokenMintY,
    status: 'created',
    poolAddress,
    signature,
    response: payload,
  })
  return { status: 'completed', tokenMintX, tokenMintY, poolAddress, signature, response: payload }
}

async function recordHookAttempt(params: {
  db: { sql: any }
  creatorToken: Address
  shareOft: string | null
  sourceSessionId: string | null
  status: 'creating' | 'created' | 'failed' | 'skipped'
  hookMint?: string | null
  creatorConfig?: string | null
  pendingEntries?: string | null
  winnerRecord?: string | null
  error?: string | null
  response?: unknown
}): Promise<void> {
  await ensureSolanaHookStatusSchema(params.db as any)
  await params.db.sql`
    INSERT INTO solana_hook_status (
      creator_token,
      share_oft,
      hook_mint,
      creator_config,
      pending_entries,
      winner_record,
      status,
      provision_attempt_count,
      last_error,
      response_json,
      source_session_id,
      updated_at
    ) VALUES (
      ${params.creatorToken.toLowerCase()},
      ${params.shareOft},
      ${params.hookMint ?? null},
      ${params.creatorConfig ?? null},
      ${params.pendingEntries ?? null},
      ${params.winnerRecord ?? null},
      ${params.status},
      1,
      ${params.error ?? null},
      ${JSON.stringify(params.response ?? null)}::jsonb,
      ${params.sourceSessionId},
      NOW()
    )
    ON CONFLICT (creator_token)
    DO UPDATE SET
      share_oft = COALESCE(EXCLUDED.share_oft, solana_hook_status.share_oft),
      hook_mint = COALESCE(EXCLUDED.hook_mint, solana_hook_status.hook_mint),
      creator_config = COALESCE(EXCLUDED.creator_config, solana_hook_status.creator_config),
      pending_entries = COALESCE(EXCLUDED.pending_entries, solana_hook_status.pending_entries),
      winner_record = COALESCE(EXCLUDED.winner_record, solana_hook_status.winner_record),
      status = EXCLUDED.status,
      provision_attempt_count = solana_hook_status.provision_attempt_count + 1,
      last_error = EXCLUDED.last_error,
      response_json = EXCLUDED.response_json,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_hook_status.source_session_id),
      updated_at = NOW();
  `
}

async function maybeSetupCreator(params: {
  db: { sql: any }
  creatorToken: Address
  mapping: ShareMeshMappingSummary
  body: Body
}): Promise<HookProvisionResult> {
  const shareOft = resolveShareOft({ mapping: params.mapping, body: params.body })
  const sourceSessionId = resolveSourceSessionId({ mapping: params.mapping, body: params.body })

  if (!shareOft) return { status: 'waiting_for_share_oft' }
  if (!envFlag('SOLANA_HOOK_PROVISIONING_ENABLED', false)) {
    return { status: 'disabled', reason: 'SOLANA_HOOK_PROVISIONING_ENABLED is not enabled' }
  }

  const existing = await readSolanaHookStatusByCreatorToken({
    db: params.db as any,
    creatorToken: params.creatorToken,
  })
  if (existing?.status === 'created' && existing.hookMint) {
    return {
      status: 'completed',
      hookMint: existing.hookMint,
      creatorConfig: existing.creatorConfig,
      pendingEntries: existing.pendingEntries,
      winnerRecord: existing.winnerRecord,
      response: null,
    }
  }

  const url = deriveSetupCreatorUrl()
  const secret = readSetupCreatorSecret()
  if (!url || !secret) {
    const reason = !url ? 'setup_creator_provisioner_url_missing' : 'setup_creator_provisioner_secret_missing'
    await recordHookAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      shareOft,
      sourceSessionId,
      status: 'skipped',
      error: reason,
    })
    return { status: 'skipped_unconfigured', reason }
  }

  await recordHookAttempt({
    db: params.db,
    creatorToken: params.creatorToken,
    shareOft,
    sourceSessionId,
    status: 'creating',
  })

  const requestBody = {
    hubCreatorCoin: params.creatorToken,
    hubShareToken: shareOft,
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(readIntEnv('SOLANA_HOOK_PROVISIONER_TIMEOUT_MS', 300_000, 30_000, 600_000)),
  })
  const payload = await response.json().catch(async () => ({ text: await response.text().catch(() => '') }))
  const objectPayload = readObject(payload)
  const setupFailed = !response.ok || objectPayload?.success === false
  if (setupFailed) {
    const error = typeof objectPayload?.error === 'string' ? objectPayload.error : `setup_creator_failed:${response.status}`
    await recordHookAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      shareOft,
      sourceSessionId,
      status: 'failed',
      error,
      response: payload,
    })
    return { status: 'failed', error, upstreamStatusCode: response.status, response: payload }
  }

  const hookMint = readSetupCreatorMint(payload)
  const pdas = readSetupCreatorPdas(payload)
  if (!hookMint) {
    const error = 'setup_creator_missing_hook_mint'
    await recordHookAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      shareOft,
      sourceSessionId,
      status: 'failed',
      error,
      response: payload,
    })
    return { status: 'failed', error, response: payload }
  }

  await recordHookAttempt({
    db: params.db,
    creatorToken: params.creatorToken,
    shareOft,
    sourceSessionId,
    status: 'created',
    hookMint,
    creatorConfig: pdas.creatorConfig,
    pendingEntries: pdas.pendingEntries,
    winnerRecord: pdas.winnerRecord,
    response: payload,
  })
  return {
    status: 'completed',
    hookMint,
    creatorConfig: pdas.creatorConfig,
    pendingEntries: pdas.pendingEntries,
    winnerRecord: pdas.winnerRecord,
    response: payload,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })
  const body = (bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}) as Body

  const creatorRaw = typeof body.creatorToken === 'string' ? body.creatorToken.trim() : ''
  if (!isAddress(creatorRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid creatorToken' } satisfies ApiEnvelope<never>)
  }
  const creatorToken = getAddress(creatorRaw as Address)
  const trigger = typeof body.trigger === 'string' && body.trigger.trim() ? body.trigger.trim() : 'payment'

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDbForCron()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  const entitled = await creatorHasSolanaShareMeshEntitlement(creatorToken)
  if (!entitled) {
    return res.status(409).json({
      success: false,
      error: 'Creator has no paid Solana share-mesh entitlement',
    } satisfies ApiEnvelope<never>)
  }

  const activationId = Number(body.activationId ?? 0)
  if (Number.isInteger(activationId) && activationId > 0) {
    const rows = await listActivationsForCreator(db as any, creatorToken)
    const row = rows.find((r) => r.id === activationId)
    if (row) {
      const metadata = {
        ...(row.metadata ?? {}),
        solanaShareMeshProvisioningQueuedAt: new Date().toISOString(),
        solanaShareMeshTrigger: trigger,
      }
      await (db as any).sql`
        UPDATE creator_strategy_features
        SET metadata = ${JSON.stringify(metadata)}::jsonb, updated_at = NOW()
        WHERE id = ${activationId}
      `
    }
  }

  const orchestratorConfigured = Boolean(env('SOLANA_ORCHESTRATOR_URL'))
  const orchestratorHealthy = orchestratorConfigured ? await pingOrchestratorHealth() : null
  const shareMeshMapping = await readShareMeshMapping({ db: db as any, creatorToken, body })
  const hookLane = await maybeSetupCreator({ db: db as any, creatorToken, mapping: shareMeshMapping, body })
  const meteoraPool = await maybeCreateMeteoraPool({ db: db as any, creatorToken, mapping: shareMeshMapping })

  const nextSteps = [
    'Confirm Path 1 platform readiness: verify-batcher-pipe-a-readiness.ts exit 0',
    'After finalizePhase2, bridge 30% ShareOFT seeds the LZ share-mesh mint on Solana',
    shareMeshMapping.status === 'missing'
      ? 'Wait for deploy-session finalize to persist solana_share_mesh_mappings.share_mesh_mint'
      : 'Meteora DLMM pool provisioning is recorded in solana_meteora_pool_status',
    hookLane.status === 'completed'
      ? 'Solana lottery hook mint + PDAs are recorded in solana_hook_status'
      : 'Provision the required Solana lottery hook lane (setup-creator) before enabling relay_entries',
    'Seed initial DLMM liquidity after the pool exists; empty pools do not swap or browse reliably',
  ]
  if (!orchestratorConfigured) {
    nextSteps.unshift('Set SOLANA_ORCHESTRATOR_URL on Vercel and redeploy production API')
  } else if (orchestratorHealthy === false) {
    nextSteps.unshift('Restore solana-keeper-orchestrator.service on ops host (GET /healthz failed)')
  }

  const checklist: ProvisionChecklist = {
    creatorToken,
    trigger,
    orchestratorConfigured,
    orchestratorHealthy,
    entitlementConfirmed: true,
    shareMeshMapping,
    hookLane,
    meteoraPool,
    nextSteps,
    runbook: 'docs/operations/solana-share-mesh-budget-paths.md',
  }

  console.info('[keeper/solana/provision-creator]', {
    creatorToken: creatorToken.toLowerCase(),
    trigger,
    activationId: Number.isInteger(activationId) ? activationId : null,
    orchestratorConfigured,
    orchestratorHealthy,
    shareMeshMappingStatus: shareMeshMapping.status,
    hookLaneStatus: hookLane.status,
    meteoraPoolStatus: meteoraPool.status,
    vaultAddress: typeof body.vaultAddress === 'string' ? body.vaultAddress : null,
    deploySessionId: typeof body.deploySessionId === 'string' ? body.deploySessionId : null,
  })

  return res.status(200).json({ success: true, data: checklist } satisfies ApiEnvelope<ProvisionChecklist>)
}
