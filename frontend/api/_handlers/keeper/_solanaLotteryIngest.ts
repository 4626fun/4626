/**
 * POST /api/keeper/solana/lottery-ingest
 *
 * Machine-auth, finalized-RPC ingestion into the durable B2 inbox. This reads
 * Solana and writes only local evidence; it never submits a Solana transaction
 * or enables the Base relay.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Connection, PublicKey } from '@solana/web3.js'

import {
  type ApiEnvelope,
  getDbForCron,
  handleOptions,
  isDbConfigured,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '@4626/server-core'

import {
  ingestFinalizedLotteryLogs,
  type SolanaLotteryIngestRpc,
} from '../../../server/_lib/onchain/solanaLotteryIngest.js'
import { CREATOR_SHARE_HOOK_PROGRAM_ID } from '../../../server/_lib/onchain/creatorShareHookPdas.js'

function enabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    String(process.env.SOLANA_LOTTERY_INGEST_ENABLED ?? '').trim().toLowerCase(),
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
    return res.status(503).json({ success: false, error: 'solana_lottery_ingest_disabled' } satisfies ApiEnvelope<never>)
  }

  const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim()
  const programId = String(process.env.SOLANA_PROGRAM_ID ?? '').trim()
  if (!rpcUrl || !programId) {
    return res.status(503).json({ success: false, error: 'solana_lottery_ingest_unconfigured' } satisfies ApiEnvelope<never>)
  }
  try { new PublicKey(programId) } catch {
    return res.status(503).json({ success: false, error: 'invalid_solana_program_id' } satisfies ApiEnvelope<never>)
  }
  if (programId !== CREATOR_SHARE_HOOK_PROGRAM_ID) {
    return res.status(503).json({ success: false, error: 'noncanonical_solana_hook_program_id' } satisfies ApiEnvelope<never>)
  }
  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)
  }
  const db = await getDbForCron()
  if (!db) return res.status(503).json({ success: false, error: 'database_unavailable' } satisfies ApiEnvelope<never>)

  const body = await readBoundedJsonObjectBody(req, { maxBytes: 4_096 })
  const requestedLimit = body && typeof body.limit === 'number' ? body.limit : 25
  const limit = Math.max(1, Math.min(Math.floor(requestedLimit), 100))
  const connection = new Connection(rpcUrl, 'finalized')
  const rpc: SolanaLotteryIngestRpc = {
    getGenesisHash: () => connection.getGenesisHash(),
    async getSignaturesForAddress(address, opts) {
      const rows = await connection.getSignaturesForAddress(new PublicKey(address), {
        limit: opts.limit,
        until: opts.until,
        before: opts.before,
      }, 'finalized')
      return rows.map((row) => row.signature)
    },
    async getParsedTransaction(signature, opts) {
      return await connection.getParsedTransaction(signature, opts) as any
    },
  }

  try {
    const result = await ingestFinalizedLotteryLogs({ db: db as any, rpc, programId, limit })
    return res.status(200).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return res.status(500).json({ success: false, error: message.slice(0, 300) } satisfies ApiEnvelope<never>)
  }
}
