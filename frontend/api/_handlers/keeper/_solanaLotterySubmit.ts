/**
 * POST /api/keeper/solana/lottery-submit
 *
 * Machine-auth worker: claim inbox leases and submit via prepare → begin → OApp send.
 * Fail-closed when relay/transport/sender are unset. Does not flip env flags.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

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

import { processSolanaLotteryInboxSubmitBatch } from '../../../server/_lib/onchain/solanaLotterySubmitWorker.js'

type Body = {
  leaseOwner?: unknown
  limit?: unknown
}

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    String(
      process.env.SOLANA_LOTTERY_SUBMIT_ENABLED ??
        process.env.SOLANA_ORCHESTRATOR_LOTTERY_SUBMIT_ENABLED ??
        '',
    )
      .trim()
      .toLowerCase(),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res)) return

  if (!enabled()) {
    return res.status(503).json({
      success: false,
      error: 'solana_lottery_submit_disabled',
    } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'database_unavailable',
    } satisfies ApiEnvelope<never>)
  }

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 4_096 })
  const body = (bodyRaw && typeof bodyRaw === 'object' ? bodyRaw : {}) as Body
  const leaseOwner =
    typeof body.leaseOwner === 'string' && body.leaseOwner.trim()
      ? body.leaseOwner.trim()
      : `keeper-solana-lottery-submit:${process.env.VERCEL_REGION ?? 'local'}`
  const limit =
    typeof body.limit === 'number' && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(Math.floor(body.limit), 50))
      : 10

  const db = await getDbForCron()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'database_unavailable',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await processSolanaLotteryInboxSubmitBatch({
      db: db as any,
      leaseOwner,
      limit,
    })
    return res.status(200).json({
      success: true,
      data: result,
    } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({
      success: false,
      error: message.slice(0, 300),
    } satisfies ApiEnvelope<never>)
  }
}
