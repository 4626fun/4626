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

type Body = {
  creatorToken?: unknown
  activationId?: unknown
  paymentSource?: unknown
  trigger?: unknown
  vaultAddress?: unknown
  deploySessionId?: unknown
}

type ProvisionChecklist = {
  creatorToken: Address
  trigger: string
  orchestratorConfigured: boolean
  orchestratorHealthy: boolean | null
  entitlementConfirmed: boolean
  nextSteps: string[]
  runbook: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
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
      const metadata = { ...(row.metadata ?? {}), solanaShareMeshProvisioningQueuedAt: new Date().toISOString(), solanaShareMeshTrigger: trigger }
      await (db as any).sql`
        UPDATE creator_strategy_features
        SET metadata = ${JSON.stringify(metadata)}::jsonb, updated_at = NOW()
        WHERE id = ${activationId}
      `
    }
  }

  const orchestratorConfigured = Boolean(env('SOLANA_ORCHESTRATOR_URL'))
  const orchestratorHealthy = orchestratorConfigured ? await pingOrchestratorHealth() : null

  const nextSteps = [
    'Confirm Path 1 platform readiness: verify-batcher-pipe-a-readiness.ts exit 0',
    'After finalizePhase2, bridge 30% ShareOFT seeds the LZ share-mesh mint on Solana',
    'Run kpr solana:create-dlmm-pool with TOKEN_MINT_X=<share_mesh_mint> for Meteora (Path 2 B1)',
    'Upsert creator_meteora_alpha_vaults when pool + Alpha Vault exist',
    'Keep relay_entries disabled until B2 hook path is verified (policy doc)',
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
    nextSteps,
    runbook: 'docs/operations/solana-share-mesh-budget-paths.md',
  }

  console.info('[keeper/solana/provision-creator]', {
    creatorToken: creatorToken.toLowerCase(),
    trigger,
    activationId: Number.isInteger(activationId) ? activationId : null,
    orchestratorConfigured,
    orchestratorHealthy,
    vaultAddress: typeof body.vaultAddress === 'string' ? body.vaultAddress : null,
    deploySessionId: typeof body.deploySessionId === 'string' ? body.deploySessionId : null,
  })

  return res.status(200).json({ success: true, data: checklist } satisfies ApiEnvelope<ProvisionChecklist>)
}
