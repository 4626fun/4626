/**
 * POST /api/keeper/solana/provision-creator
 *
 * Machine-auth provisioning checkpoint for Solana share-mesh follow-up after
 * vault_full_deploy payment or post-deploy vault settlement.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PublicKey } from '@solana/web3.js'
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
import { enqueueSolanaB2ReadinessVerification } from '../../../server/_lib/onchain/solanaRelayConfigSync.js'
import {
  ensureSolanaHookStatusSchema,
  ensureSolanaMeteoraPoolStatusSchema,
  ensureSolanaShareMeshMappingsSchema,
} from '../../../server/_lib/db/schemaBootstrap.js'
import { SOLANA_NATIVE_MINT } from '../../../server/_lib/onchain/meteoraAlphaVaultConfig.js'
import { deriveCreatorShareHookPdas } from '../../../server/_lib/onchain/creatorShareHookPdas.js'
import { readSolanaHookStatusByCreatorToken } from '../../../server/_lib/onchain/solanaHookStatus.js'
import { listSolanaShareMeshMappingsForCreator } from '../../../server/_lib/onchain/solanaShareMeshMappings.js'
import {
  deriveMeteoraCustomizablePoolAddress,
  readSolanaMeteoraPoolStatusByShareMeshMint,
} from '../../../server/_lib/onchain/solanaMeteoraPoolStatus.js'

type Body = {
  creatorToken?: unknown
  activationId?: unknown
  paymentSource?: unknown
  trigger?: unknown
  vaultAddress?: unknown
  deploySessionId?: unknown
  shareMeshMint?: unknown
  shareOft?: unknown
  b2Stage?: unknown
  ammPrograms?: unknown
}

const DEFAULT_METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

type ShareMeshMappingSummary =
  | { status: 'found'; shareOft: string; shareMeshMint: string; sourceSessionId: string | null; mappingStatus: string }
  | { status: 'missing' }

type MeteoraPoolProvisionResult =
  | { status: 'disabled'; reason: string }
  | { status: 'waiting_for_share_mesh_mint' }
  | { status: 'in_progress'; reason: string; tokenMintX: string; tokenMintY: string }
  | { status: 'skipped_unconfigured'; reason: string; tokenMintX: string; tokenMintY: string }
  | { status: 'completed'; tokenMintX: string; tokenMintY: string; poolAddress: string | null; signature: string | null; response: unknown }
  | { status: 'failed'; tokenMintX: string; tokenMintY: string; error: string; upstreamStatusCode?: number; response?: unknown }

type HookProvisionResult =
  | { status: 'disabled'; reason: string }
  | { status: 'waiting_for_share_mesh_mint' }
  | { status: 'waiting_for_share_oft' }
  | { status: 'in_progress'; reason: string }
  | { status: 'skipped_unconfigured'; reason: string }
  | { status: 'completed'; hookMint: string; creatorConfig: string | null; pendingEntries: string | null; winnerRecord: string | null; response: unknown }
  | { status: 'failed'; error: string; upstreamStatusCode?: number; response?: unknown }

type ProvisionChecklist = {
  creatorToken: Address
  trigger: string
  b2Stage: 'b1' | 'hook_pre_lz' | 'post_lz'
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
  if (s.length < 32 || s.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return false
  try {
    return new PublicKey(s).toBase58() === s
  } catch {
    return false
  }
}

function normalizeOptionalAddress(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function deriveCreatePoolUrl(): string {
  return env('SOLANA_METEORA_POOL_PROVISIONER_URL')
}

function deriveSetupCreatorUrl(): string {
  return env('SOLANA_HOOK_PROVISIONER_URL')
}

function readCreatePoolSecret(): string {
  return (
    env('SOLANA_METEORA_POOL_PROVISIONER_SECRET') ||
    env('METEORA_IX_PROVISIONER_SECRET')
  )
}

function readSetupCreatorSecret(): string {
  return (
    env('SOLANA_HOOK_PROVISIONER_SECRET') ||
    env('SOLANA_METEORA_POOL_PROVISIONER_SECRET') ||
    env('METEORA_IX_PROVISIONER_SECRET')
  )
}

function resolveAmmPrograms(body: Body): string[] {
  const configured = String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim()
  const fallback = configured || DEFAULT_METEORA_DLMM_PROGRAM_ID
  if (!Array.isArray(body.ammPrograms)) return [fallback]
  const values = body.ammPrograms
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
  return values.length > 0 ? values : [fallback]
}

function deriveProvisionerHealthUrl(setupUrl: string): string {
  try {
    return new URL('/healthz', setupUrl).toString()
  } catch {
    return ''
  }
}

async function verifyProvisionerHealth(params: {
  provisionerUrl: string
  secret: string
  errorPrefix: 'setup_creator' | 'create_pool'
  timeoutEnv: 'SOLANA_HOOK_PROVISIONER_HEALTH_TIMEOUT_MS' | 'SOLANA_METEORA_POOL_PROVISIONER_HEALTH_TIMEOUT_MS'
}): Promise<string | null> {
  const healthUrl = deriveProvisionerHealthUrl(params.provisionerUrl)
  if (!healthUrl) return `${params.errorPrefix}_provisioner_health_url_invalid`
  let response: Response
  try {
    response = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${params.secret}` },
      signal: AbortSignal.timeout(readIntEnv(params.timeoutEnv, 10_000, 1_000, 30_000)),
    })
  } catch (cause) {
    return cause instanceof DOMException && cause.name === 'TimeoutError'
      ? `${params.errorPrefix}_provisioner_health_timeout`
      : `${params.errorPrefix}_provisioner_health_network_error:${(cause instanceof Error ? cause.message : String(cause)).slice(0, 160)}`
  }
  const body = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) return `${params.errorPrefix}_provisioner_health_http_${response.status}`
  if (body?.ok !== true || body?.secretSet !== true || body?.payerConfigured !== true || body?.payerHealthy !== true || body?.solanaRpcConfigured !== true || body?.extendedEndpointsEnabled !== true) {
    return `${params.errorPrefix}_provisioner_not_ready`
  }
  return null
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
  if (params.mapping.status === 'found') return params.mapping.shareOft.toLowerCase()
  return null
}

function resolveSourceSessionId(params: { mapping: ShareMeshMappingSummary; body: Body }): string | null {
  if (params.mapping.status === 'found' && params.mapping.sourceSessionId) {
    return params.mapping.sourceSessionId
  }
  return null
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
  await ensureSolanaShareMeshMappingsSchema(params.db as any)
  const mappings = await listSolanaShareMeshMappingsForCreator({
    db: params.db as any,
    creatorToken: params.creatorToken,
  })
  const selected = mappings.find((row) => row.status === 'applied')
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
  mapping: Extract<ShareMeshMappingSummary, { status: 'found' }>
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

async function claimMeteoraPoolProvisionAttempt(params: {
  db: { sql: any }
  creatorToken: Address
  mapping: Extract<ShareMeshMappingSummary, { status: 'found' }>
  quoteMint: string
}): Promise<boolean> {
  await ensureSolanaMeteoraPoolStatusSchema(params.db as any)
  const operationTimeoutMs = readIntEnv(
    'SOLANA_METEORA_POOL_PROVISIONER_TIMEOUT_MS',
    300_000,
    30_000,
    600_000,
  )
  const staleAfterMs = Math.max(operationTimeoutMs + 30_000, readIntEnv(
    'SOLANA_METEORA_POOL_PROVISIONING_STALE_MS',
    operationTimeoutMs + 30_000,
    60_000,
    900_000,
  ))
  const result = await params.db.sql`
    /* claim_meteora_pool_provision */
    INSERT INTO solana_meteora_pool_status (
      creator_token,
      share_oft,
      share_mesh_mint,
      quote_mint,
      status,
      provision_attempt_count,
      source_session_id,
      updated_at
    ) VALUES (
      ${params.creatorToken.toLowerCase()},
      ${params.mapping.shareOft},
      ${params.mapping.shareMeshMint},
      ${params.quoteMint},
      'creating',
      1,
      ${params.mapping.sourceSessionId ?? null},
      NOW()
    )
    ON CONFLICT (share_mesh_mint, quote_mint)
    DO UPDATE SET
      creator_token = EXCLUDED.creator_token,
      share_oft = COALESCE(EXCLUDED.share_oft, solana_meteora_pool_status.share_oft),
      status = 'creating',
      provision_attempt_count = solana_meteora_pool_status.provision_attempt_count + 1,
      last_error = NULL,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_meteora_pool_status.source_session_id),
      updated_at = NOW()
    WHERE solana_meteora_pool_status.status IN ('pending', 'failed', 'skipped')
       OR (
         solana_meteora_pool_status.status = 'created'
         AND (solana_meteora_pool_status.pool_address IS NULL OR solana_meteora_pool_status.last_signature IS NULL)
       )
       OR (
         solana_meteora_pool_status.status = 'creating'
         AND solana_meteora_pool_status.updated_at < NOW() - (${staleAfterMs} * INTERVAL '1 millisecond')
       )
    RETURNING id;
  `
  return (result.rows ?? []).length === 1
}

async function maybeCreateMeteoraPool(params: {
  db: { sql: any }
  creatorToken: Address
  mapping: ShareMeshMappingSummary
  mode: 'b1' | 'b2'
}): Promise<MeteoraPoolProvisionResult> {
  if (params.mapping.status === 'missing') return { status: 'waiting_for_share_mesh_mint' }
  if (!envFlag('SOLANA_METEORA_POOL_PROVISIONING_ENABLED', false)) {
    return { status: 'disabled', reason: 'SOLANA_METEORA_POOL_PROVISIONING_ENABLED is not enabled' }
  }

  const tokenMintX = params.mapping.shareMeshMint
  const tokenMintY = envFlag('SOLANA_STRICT_SOL_PAIR', false)
    ? SOLANA_NATIVE_MINT
    : env('SOLANA_METEORA_POOL_QUOTE_MINT') || SOLANA_NATIVE_MINT
  let expectedPoolAddress: string
  try {
    expectedPoolAddress = deriveMeteoraCustomizablePoolAddress({
      tokenMintX,
      tokenMintY,
      programId: env('SOLANA_METEORA_DLMM_PROGRAM_ID') || DEFAULT_METEORA_DLMM_PROGRAM_ID,
    })
  } catch (error) {
    const reason = `meteora_pool_identity_invalid:${error instanceof Error ? error.message : String(error)}`
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'failed',
      error: reason,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error: reason }
  }
  const existing = await readSolanaMeteoraPoolStatusByShareMeshMint({
    db: params.db as any,
    shareMeshMint: tokenMintX,
    quoteMint: tokenMintY,
  })
  if (existing?.status === 'created' && existing.poolAddress && existing.lastSignature) {
    if (existing.poolAddress !== expectedPoolAddress) {
      const error = `existing_pool_address_mismatch:${existing.poolAddress}:${expectedPoolAddress}`
      await recordMeteoraPoolAttempt({
        db: params.db,
        creatorToken: params.creatorToken,
        mapping: params.mapping,
        quoteMint: tokenMintY,
        status: 'failed',
        poolAddress: existing.poolAddress,
        signature: existing.lastSignature,
        error,
      })
      return { status: 'failed', tokenMintX, tokenMintY, error }
    }
    return {
      status: 'completed',
      tokenMintX,
      tokenMintY,
      poolAddress: existing.poolAddress,
      signature: existing.lastSignature,
      response: null,
    }
  }
  if (existing?.status === 'created') {
    const error = 'existing_pool_status_incomplete'
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'failed',
      poolAddress: existing.poolAddress,
      signature: existing.lastSignature,
      error,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error }
  }
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

  const healthError = await verifyProvisionerHealth({
    provisionerUrl: url,
    secret,
    errorPrefix: 'create_pool',
    timeoutEnv: 'SOLANA_METEORA_POOL_PROVISIONER_HEALTH_TIMEOUT_MS',
  })
  if (healthError) {
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'failed',
      error: healthError,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error: healthError }
  }

  const claimed = await claimMeteoraPoolProvisionAttempt({
    db: params.db,
    creatorToken: params.creatorToken,
    mapping: params.mapping,
    quoteMint: tokenMintY,
  })
  if (!claimed) {
    return {
      status: 'in_progress',
      reason: 'meteora_pool_provisioning_already_in_progress',
      tokenMintX,
      tokenMintY,
    }
  }

  const requestBody = {
    tokenMintX,
    tokenMintY,
    mode: params.mode,
    binStep: readIntEnv('SOLANA_METEORA_POOL_BIN_STEP', 25, 1, 10_000),
    activeId: readIntEnv('SOLANA_METEORA_POOL_ACTIVE_ID', 0, -8_388_608, 8_388_607),
    baseFactor: readIntEnv('SOLANA_METEORA_POOL_BASE_FACTOR', 10_000, 1, 1_000_000),
  }
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(readIntEnv('SOLANA_METEORA_POOL_PROVISIONER_TIMEOUT_MS', 300_000, 30_000, 600_000)),
    })
  } catch (cause) {
    const error = cause instanceof DOMException && cause.name === 'TimeoutError'
      ? 'create_pool_timeout'
      : `create_pool_network_error:${(cause instanceof Error ? cause.message : String(cause)).slice(0, 200)}`
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'failed',
      error,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error }
  }
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
  if (!poolAddress || !signature) {
    const error = !poolAddress ? 'create_pool_missing_pool_address' : 'create_pool_missing_signature'
    await recordMeteoraPoolAttempt({
      db: params.db, creatorToken: params.creatorToken, mapping: params.mapping,
      quoteMint: tokenMintY, status: 'failed', error, response: payload,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error, response: payload }
  }
  if (poolAddress !== expectedPoolAddress) {
    const error = `create_pool_address_mismatch:${poolAddress}:${expectedPoolAddress}`
    await recordMeteoraPoolAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      mapping: params.mapping,
      quoteMint: tokenMintY,
      status: 'failed',
      poolAddress,
      signature,
      error,
      response: payload,
    })
    return { status: 'failed', tokenMintX, tokenMintY, error, response: payload }
  }
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

async function claimHookProvisionAttempt(params: {
  db: { sql: any }
  creatorToken: Address
  shareOft: string
  hookMint: string
  sourceSessionId: string | null
}): Promise<boolean> {
  await ensureSolanaHookStatusSchema(params.db as any)
  const operationTimeoutMs = readIntEnv(
    'SOLANA_HOOK_PROVISIONER_TIMEOUT_MS',
    300_000,
    30_000,
    600_000,
  )
  const staleAfterMs = Math.max(operationTimeoutMs + 30_000, readIntEnv(
    'SOLANA_HOOK_PROVISIONING_STALE_MS',
    operationTimeoutMs + 30_000,
    60_000,
    900_000,
  ))
  const result = await params.db.sql`
    /* claim_hook_provision */
    INSERT INTO solana_hook_status (
      creator_token,
      share_oft,
      hook_mint,
      status,
      provision_attempt_count,
      source_session_id,
      updated_at
    ) VALUES (
      ${params.creatorToken.toLowerCase()},
      ${params.shareOft},
      ${params.hookMint},
      'creating',
      1,
      ${params.sourceSessionId},
      NOW()
    )
    ON CONFLICT (creator_token)
    DO UPDATE SET
      share_oft = EXCLUDED.share_oft,
      hook_mint = EXCLUDED.hook_mint,
      status = 'creating',
      provision_attempt_count = solana_hook_status.provision_attempt_count + 1,
      last_error = NULL,
      source_session_id = COALESCE(EXCLUDED.source_session_id, solana_hook_status.source_session_id),
      updated_at = NOW()
    WHERE solana_hook_status.status IN ('pending', 'failed', 'skipped')
       OR (
         solana_hook_status.status = 'created'
         AND (
           solana_hook_status.creator_config IS NULL
           OR solana_hook_status.pending_entries IS NULL
           OR solana_hook_status.winner_record IS NULL
         )
       )
       OR (
         solana_hook_status.status = 'creating'
         AND solana_hook_status.updated_at < NOW() - (${staleAfterMs} * INTERVAL '1 millisecond')
       )
    RETURNING id;
  `
  return (result.rows ?? []).length === 1
}

async function maybeSetupCreator(params: {
  db: { sql: any }
  creatorToken: Address
  mapping: ShareMeshMappingSummary
  body: Body
  b2Stage: 'b1' | 'hook_pre_lz' | 'post_lz'
}): Promise<HookProvisionResult> {
  if (params.b2Stage === 'b1') {
    return { status: 'disabled', reason: 'B1 lane does not provision the lottery hook' }
  }
  const shareOft = resolveShareOft({ mapping: params.mapping, body: params.body })
  const sourceSessionId = resolveSourceSessionId({ mapping: params.mapping, body: params.body })

  if (!shareOft) return { status: 'waiting_for_share_oft' }
  if (!envFlag('SOLANA_HOOK_PROVISIONING_ENABLED', false)) {
    return { status: 'disabled', reason: 'SOLANA_HOOK_PROVISIONING_ENABLED is not enabled' }
  }
  if (params.mapping.status === 'missing') return { status: 'waiting_for_share_mesh_mint' }

  const expectedPdas = deriveCreatorShareHookPdas(params.mapping.shareMeshMint)
  if (!expectedPdas || expectedPdas.hookMint !== params.mapping.shareMeshMint) {
    const error = 'mapped_hook_mint_invalid'
    await recordHookAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      shareOft,
      sourceSessionId,
      status: 'failed',
      hookMint: params.mapping.shareMeshMint,
      error,
    })
    return { status: 'failed', error }
  }

  const existing = await readSolanaHookStatusByCreatorToken({
    db: params.db as any,
    creatorToken: params.creatorToken,
  })
  if (existing?.status === 'created' && existing.hookMint) {
    const expectedMint = params.mapping.shareMeshMint
    if (!expectedMint || existing.hookMint !== expectedMint) {
      const error = `existing_hook_mint_mismatch:${existing.hookMint}:${expectedMint || 'missing_mapping'}`
      await recordHookAttempt({
        db: params.db,
        creatorToken: params.creatorToken,
        shareOft,
        sourceSessionId,
        status: 'failed',
        hookMint: existing.hookMint,
        creatorConfig: existing.creatorConfig,
        pendingEntries: existing.pendingEntries,
        winnerRecord: existing.winnerRecord,
        error,
      })
      return {
        status: 'failed',
        error,
      }
    }
    // A created row is only reusable when every B2 PDA was persisted. Older
    // records could contain the mint alone; treating those as complete would
    // allow pool/readiness progression with an unverified hook lane. Leave
    // incomplete rows on the idempotent provisioner path so it can read back
    // or initialize the exact missing PDAs.
    if (existing.creatorConfig && existing.pendingEntries && existing.winnerRecord) {
      const mismatchedPda = (
        [
          ['creator_config', existing.creatorConfig, expectedPdas.creatorConfig],
          ['pending_entries', existing.pendingEntries, expectedPdas.pendingEntries],
          ['winner_record', existing.winnerRecord, expectedPdas.winnerRecord],
        ] as const
      ).find(([, actual, expected]) => actual !== expected)
      if (mismatchedPda) {
        const [name, actual, expected] = mismatchedPda
        const error = `existing_hook_pda_mismatch:${name}:${actual}:${expected}`
        await recordHookAttempt({
          db: params.db,
          creatorToken: params.creatorToken,
          shareOft,
          sourceSessionId,
          status: 'failed',
          hookMint: existing.hookMint,
          creatorConfig: existing.creatorConfig,
          pendingEntries: existing.pendingEntries,
          winnerRecord: existing.winnerRecord,
          error,
        })
        return { status: 'failed', error }
      }
      return {
        status: 'completed',
        hookMint: existing.hookMint,
        creatorConfig: existing.creatorConfig,
        pendingEntries: existing.pendingEntries,
        winnerRecord: existing.winnerRecord,
        response: null,
      }
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

  const healthError = await verifyProvisionerHealth({
    provisionerUrl: url,
    secret,
    errorPrefix: 'setup_creator',
    timeoutEnv: 'SOLANA_HOOK_PROVISIONER_HEALTH_TIMEOUT_MS',
  })
  if (healthError) {
    await recordHookAttempt({
      db: params.db, creatorToken: params.creatorToken, shareOft, sourceSessionId,
      status: 'failed', error: healthError,
    })
    return { status: 'failed', error: healthError }
  }

  const claimed = await claimHookProvisionAttempt({
    db: params.db,
    creatorToken: params.creatorToken,
    shareOft,
    hookMint: params.mapping.shareMeshMint,
    sourceSessionId,
  })
  if (!claimed) {
    return { status: 'in_progress', reason: 'hook_provisioning_already_in_progress' }
  }

  const requestBody = {
    mint: params.mapping.shareMeshMint,
    hubCreatorCoin: params.creatorToken,
    hubShareToken: shareOft,
    ammPrograms: resolveAmmPrograms(params.body),
  }
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(readIntEnv('SOLANA_HOOK_PROVISIONER_TIMEOUT_MS', 300_000, 30_000, 600_000)),
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    const error = cause instanceof DOMException && cause.name === 'TimeoutError'
      ? 'setup_creator_timeout'
      : `setup_creator_network_error:${message.slice(0, 200)}`
    await recordHookAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      shareOft,
      sourceSessionId,
      status: 'failed',
      error,
    })
    return { status: 'failed', error }
  }
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
  const expectedHookMint = params.mapping.shareMeshMint
  if (hookMint !== expectedHookMint) {
    const error = `setup_creator_hook_mint_mismatch:${hookMint}:${expectedHookMint}`
    await recordHookAttempt({
      db: params.db, creatorToken: params.creatorToken, shareOft, sourceSessionId,
      status: 'failed', error, response: payload,
    })
    return { status: 'failed', error, response: payload }
  }
  if (!pdas.creatorConfig || !pdas.pendingEntries || !pdas.winnerRecord) {
    const error = 'setup_creator_missing_required_pdas'
    await recordHookAttempt({
      db: params.db, creatorToken: params.creatorToken, shareOft, sourceSessionId,
      status: 'failed', error, response: payload,
    })
    return { status: 'failed', error, response: payload }
  }
  const mismatchedPda = (
    [
      ['creator_config', pdas.creatorConfig, expectedPdas.creatorConfig],
      ['pending_entries', pdas.pendingEntries, expectedPdas.pendingEntries],
      ['winner_record', pdas.winnerRecord, expectedPdas.winnerRecord],
    ] as const
  ).find(([, actual, expected]) => actual !== expected)
  if (mismatchedPda) {
    const [name, actual, expected] = mismatchedPda
    const error = `setup_creator_pda_mismatch:${name}:${actual}:${expected}`
    await recordHookAttempt({
      db: params.db,
      creatorToken: params.creatorToken,
      shareOft,
      sourceSessionId,
      status: 'failed',
      hookMint,
      creatorConfig: pdas.creatorConfig,
      pendingEntries: pdas.pendingEntries,
      winnerRecord: pdas.winnerRecord,
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

  if (body.ammPrograms !== undefined && !Array.isArray(body.ammPrograms)) {
    return res.status(400).json({ success: false, error: 'ammPrograms must be an array when provided' } satisfies ApiEnvelope<never>)
  }
  if (Array.isArray(body.ammPrograms) && body.ammPrograms.some((value) => typeof value !== 'string' || !value.trim())) {
    return res.status(400).json({ success: false, error: 'ammPrograms must contain non-empty strings' } satisfies ApiEnvelope<never>)
  }

  const creatorRaw = typeof body.creatorToken === 'string' ? body.creatorToken.trim() : ''
  if (!isAddress(creatorRaw)) {
    return res.status(400).json({ success: false, error: 'Invalid creatorToken' } satisfies ApiEnvelope<never>)
  }
  const creatorToken = getAddress(creatorRaw as Address)
  const trigger = typeof body.trigger === 'string' && body.trigger.trim() ? body.trigger.trim() : 'payment'
  const b2Stage = body.b2Stage === 'b1'
    ? 'b1'
    : body.b2Stage === 'hook_pre_lz'
    ? 'hook_pre_lz'
    : body.b2Stage === 'post_lz'
    ? 'post_lz'
    : 'post_lz'

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
  if (
    b2Stage === 'hook_pre_lz' &&
    shareMeshMapping.status !== 'found'
  ) {
    return res.status(400).json({
      success: false,
      error: 'hook_pre_lz requires an applied creator-scoped share-mesh mapping',
    } satisfies ApiEnvelope<never>)
  }
  const hookLane = await maybeSetupCreator({
    db: db as any,
    creatorToken,
    mapping: shareMeshMapping,
    body,
    b2Stage,
  })
  // B1 (default): Meteora pool needs share-mesh mint only — lottery hook is optional/B2.
  // B2 hook_pre_lz still blocks pool creation until post_lz (token_badge sequencing).
  const meteoraPool = b2Stage === 'hook_pre_lz'
    ? { status: 'disabled', reason: 'post_lz_stage_required_for_pool_creation' } as const
    : shareMeshMapping.status === 'missing'
    ? { status: 'waiting_for_share_mesh_mint' } as const
    : await maybeCreateMeteoraPool({
      db: db as any,
      creatorToken,
      mapping: shareMeshMapping,
      mode: b2Stage === 'b1' ? 'b1' : 'b2',
    })

  const b2PrerequisitesMet =
    b2Stage !== 'b1' &&
    shareMeshMapping.status !== 'missing' &&
    hookLane.status === 'completed' &&
    meteoraPool.status === 'completed' &&
    Boolean(meteoraPool.poolAddress && meteoraPool.signature)
  let b2ReadinessQueued = false
  if (b2Stage === 'post_lz' && b2PrerequisitesMet && envFlag('SOLANA_B2_READINESS_VERIFICATION_ENABLED', true)) {
    try {
      const shareMeshMint = shareMeshMapping.shareMeshMint
      const queue = await enqueueSolanaB2ReadinessVerification({
        creatorToken,
        shareMeshMint,
        deploySessionId: typeof body.deploySessionId === 'string' ? body.deploySessionId.trim() || null : null,
      })
      b2ReadinessQueued = queue.enqueued
    } catch (error) {
      console.warn('[keeper/solana/provision-creator] b2 readiness queue failed', {
        creatorToken: creatorToken.toLowerCase(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const nextSteps = [
    'Confirm Path 1 platform readiness: verify-batcher-pipe-a-readiness.ts exit 0',
    'After finalizePhase2, bridge 30% ShareOFT seeds the LZ share-mesh mint on Solana',
    shareMeshMapping.status === 'missing'
      ? 'Wait for deploy-session finalize to persist solana_share_mesh_mappings.share_mesh_mint'
      : 'Meteora DLMM pool provisioning is recorded in solana_meteora_pool_status',
    ...(b2Stage === 'b1'
      ? ['Lottery remains on Base for B1; keep all Solana B2 relay workers disabled']
      : [
          hookLane.status === 'completed'
            ? 'Solana lottery hook mint + PDAs are recorded in solana_hook_status'
            : 'Provision the required Solana lottery hook lane (setup-creator) before enabling relay_entries',
          b2ReadinessQueued
            ? 'B2 readiness verification queued — solana_creator_relay_config updated when checks pass'
            : 'Run POST /api/keeper/solana/verify-b2-readiness after pool + hook provisioning',
        ]),
    'Seed initial DLMM liquidity after the pool exists; empty pools do not swap or browse reliably',
  ]
  if (b2Stage === 'hook_pre_lz') {
    nextSteps.splice(0, nextSteps.length,
      'Verify hook mint + PDAs at finalized commitment',
      'Create the regular LayerZero OFT Store for this existing Token-2022 mint and transfer mint authority to the OFT Store',
      'Wire Base↔Solana peers and 3-of-5 mainnet DVNs, then persist the applied mapping',
      'Obtain Meteora token_badge before running post_lz pool provisioning',
    )
  }
  if (!orchestratorConfigured) {
    nextSteps.unshift('Set SOLANA_ORCHESTRATOR_URL on Vercel and redeploy production API')
  } else if (orchestratorHealthy === false) {
    nextSteps.unshift('Restore solana-keeper-orchestrator.service on ops host (GET /healthz failed)')
  }

  const checklist: ProvisionChecklist = {
    creatorToken,
    trigger,
    b2Stage,
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
    b2ReadinessQueued,
    vaultAddress: typeof body.vaultAddress === 'string' ? body.vaultAddress : null,
    deploySessionId: typeof body.deploySessionId === 'string' ? body.deploySessionId : null,
  })

  return res.status(200).json({ success: true, data: checklist } satisfies ApiEnvelope<ProvisionChecklist>)
}
