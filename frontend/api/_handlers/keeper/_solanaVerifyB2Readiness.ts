/**
 * POST /api/keeper/solana/verify-b2-readiness
 *
 * Machine-auth checkpoint: verify B2 readiness (mapping + pool + hook + on-chain PDAs),
 * persist solana_creator_relay_config, optionally enable per-creator relay, and sync
 * SOLANA_RELAY_ENABLED_MINTS to the Vultr orchestrator.
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
import {
  markSolanaCreatorRelayEnabled,
  upsertSolanaCreatorRelayReadiness,
} from '../../../server/_lib/onchain/solanaCreatorRelayConfig.js'
import { enqueueSolanaRelayConfigSync } from '../../../server/_lib/onchain/solanaRelayConfigSync.js'

type Body = {
  creatorToken?: unknown
  shareMeshMint?: unknown
  deploySessionId?: unknown
  autoEnableRelay?: unknown
}

type VerifyResult = {
  ready: boolean
  creatorToken: string
  shareMeshMint: string
  shareOft: string
  readinessStatus: 'verified' | 'failed' | 'pending'
  relayEnabled: boolean
  relaySyncEnqueued: boolean
  checks: Array<{ id: string; passed: boolean; detail: string }>
}

function envFlag(name: string, fallback = false): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function shouldAutoEnableRelay(body: Body): boolean {
  if (body.autoEnableRelay === true) return true
  const raw = body.autoEnableRelay
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return envFlag('SOLANA_B2_AUTO_ENABLE_RELAY', false)
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

  let relayEnabled = false
  let relaySyncEnqueued = false

  if (readiness.ready && shouldAutoEnableRelay(body) && readiness.shareMeshMint) {
    const enabled = await markSolanaCreatorRelayEnabled({
      db: db as any,
      shareMeshMint: readiness.shareMeshMint,
    })
    relayEnabled = Boolean(enabled?.relayEnabled)
    if (relayEnabled) {
      const sync = await enqueueSolanaRelayConfigSync({
        db: db as any,
        reason: 'b2_readiness_auto_enable',
      })
      relaySyncEnqueued = sync.enqueued
    }
  }

  const result: VerifyResult = {
    ready: readiness.ready,
    creatorToken: readiness.creatorToken,
    shareMeshMint: readiness.shareMeshMint,
    shareOft: readiness.shareOft,
    readinessStatus,
    relayEnabled,
    relaySyncEnqueued,
    checks: readiness.checks,
  }

  console.info('[keeper/solana/verify-b2-readiness]', {
    creatorToken,
    shareMeshMint: readiness.shareMeshMint,
    ready: readiness.ready,
    relayEnabled,
    relaySyncEnqueued,
    failedChecks: failedChecks.map((check) => check.id),
  })

  return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<VerifyResult>)
}
