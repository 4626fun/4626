/**
 * POST /api/keeper/solana/verify-b2-readiness
 *
 * Machine-auth checkpoint: verify B2 readiness (mapping + pool + hook + on-chain PDAs).
 * Read-only by default. Evidence persistence requires persistEvidence=true plus
 * its independent default-off env gate. This endpoint never enables a relay.
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

import { verifySolanaB2Readiness } from '../../../server/_lib/onchain/solanaB2Readiness.js'
import { upsertSolanaCreatorRelayReadiness } from '../../../server/_lib/onchain/solanaCreatorRelayConfig.js'
import { reconcileSolanaHookStatus } from '../../../server/_lib/onchain/solanaHookStatus.js'
import { deriveCreatorShareHookPdas } from '../../../server/_lib/onchain/creatorShareHookPdas.js'
import { reconcileSolanaMeteoraPoolStatus } from '../../../server/_lib/onchain/solanaMeteoraPoolStatus.js'

type Body = {
  creatorToken?: unknown
  shareMeshMint?: unknown
  deploySessionId?: unknown
  persistEvidence?: unknown
}

type VerifyResult = {
  ready: boolean
  creatorToken: string
  shareMeshMint: string
  shareOft: string
  readinessStatus: 'verified' | 'failed' | 'pending'
  relayEnabled: boolean
  relaySyncEnqueued: boolean
  evidencePersisted: boolean
  checks: Array<{ id: string; passed: boolean; detail: string }>
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
  const creatorToken = getAddress(creatorRaw as Address).toLowerCase()
  const shareMeshMint =
    typeof body.shareMeshMint === 'string' && body.shareMeshMint.trim() ? body.shareMeshMint.trim() : null
  const sourceSessionId =
    typeof body.deploySessionId === 'string' && body.deploySessionId.trim() ? body.deploySessionId.trim() : null

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }
  const db = await getDbForCron()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  const readiness = await verifySolanaB2Readiness({
    db: db as any,
    creatorToken,
    shareMeshMint,
  })

  if (!readiness.shareMeshMint || !readiness.shareOft) {
    return res.status(409).json({
      success: false,
      error: 'Missing share mesh mapping — finalize deploy and sync mapping first',
    } satisfies ApiEnvelope<never>)
  }

  const readinessStatus = readiness.ready ? 'verified' : 'failed'
  const failedChecks = readiness.checks.filter((check) => !check.passed)
  const persistRequested = body.persistEvidence === true
  const persistEnabled = ['1', 'true', 'yes'].includes(
    String(process.env.SOLANA_B2_READINESS_PERSIST_ENABLED ?? '').trim().toLowerCase(),
  )
  const evidencePersisted = persistRequested && persistEnabled
  if (evidencePersisted) {
    await upsertSolanaCreatorRelayReadiness({
      db: db as any,
      creatorToken: readiness.creatorToken,
      shareOft: readiness.shareOft,
      shareMeshMint: readiness.shareMeshMint,
      readinessStatus,
      readinessChecksJson: readiness.checks,
      lastError: readiness.ready
        ? null
        : failedChecks.map((check) => `${check.id}:${check.detail}`).join('; ') || 'b2_not_ready',
      sourceSessionId,
    })
    await reconcileSolanaHookStatus({
      db: db as any,
      creatorToken: readiness.creatorToken,
      shareOft: readiness.shareOft,
      ...(deriveCreatorShareHookPdas(readiness.shareMeshMint) ?? {}),
      status: readiness.ready ? 'created' : 'failed',
      lastError: readiness.ready
        ? null
        : failedChecks.map((check) => `${check.id}:${check.detail}`).join('; ') || 'b2_not_ready',
      sourceSessionId,
    })
    const poolChecks = readiness.checks.filter((check) => [
      'meteora_pool_created',
      'pool_account_onchain',
      'meteora_pool_mint_alignment',
    ].includes(check.id))
    if (poolChecks.length > 0) {
      const failedPoolChecks = poolChecks.filter((check) => !check.passed)
      await reconcileSolanaMeteoraPoolStatus({
        db: db as any,
        shareMeshMint: readiness.shareMeshMint,
        status: failedPoolChecks.length === 0 ? 'created' : 'failed',
        lastError: failedPoolChecks.length === 0
          ? null
          : failedPoolChecks.map((check) => `${check.id}:${check.detail}`).join('; '),
      })
    }
  }

  const result: VerifyResult = {
    ready: readiness.ready,
    creatorToken: readiness.creatorToken,
    shareMeshMint: readiness.shareMeshMint,
    shareOft: readiness.shareOft,
    readinessStatus,
    relayEnabled: false,
    relaySyncEnqueued: false,
    evidencePersisted,
    checks: readiness.checks,
  }

  console.info('[keeper/solana/verify-b2-readiness]', {
    creatorToken,
    shareMeshMint: readiness.shareMeshMint,
    ready: readiness.ready,
    relayEnabled: false,
    relaySyncEnqueued: false,
    evidencePersisted,
    failedChecks: failedChecks.map((check) => check.id),
  })

  return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<VerifyResult>)
}
