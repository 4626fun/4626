import { randomUUID } from 'node:crypto'

import { ensureSolanaLotteryEntryInboxSchema } from '../db/schemaBootstrap.js'
import { deriveSolanaWinnerWinId } from './solanaLotteryWinnerSettlement.js'
import { reconcileConfirmedInboxBaseRequestIds } from './solanaLotteryEntryInbox.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type WinnerSettlementRequest = {
  creatorMint: string
  winnerSolana: string
  sharesPaid: string
  winId: `0x${string}`
}

export type WinnerSettlementAck = {
  status: 'recorded' | 'already_recorded'
  winId: string
  signature: string | null
  winIdRecord: string
  winnerRecord: string
}

type Candidate = WinnerSettlementRequest & {
  id: number
  attemptId: string
}

export function resolveSolanaProvisionerSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (
    String(env.SOLANA_HOOK_PROVISIONER_SECRET ?? '').trim() ||
    String(env.SOLANA_METEORA_POOL_PROVISIONER_SECRET ?? '').trim() ||
    String(env.METEORA_IX_PROVISIONER_SECRET ?? '').trim()
  )
}

function hex(value: unknown): `0x${string}` {
  const text = String(value ?? '').toLowerCase()
  if (!/^0x[0-9a-f]+$/.test(text)) throw new Error('winner_settlement_malformed_hex')
  return text as `0x${string}`
}

/**
 * The provisioner URL is shared with the creator setup endpoint in deployed
 * environments. Normalize that endpoint back to the service root before
 * addressing the dedicated winner-recording route.
 */
export function resolveSolanaProvisionerBaseUrl(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:setup-creator|create-pool|meteora-ixs)$/i, '')
}

async function postWinnerSettlement(request: WinnerSettlementRequest): Promise<WinnerSettlementAck> {
  const url = resolveSolanaProvisionerBaseUrl(process.env.SOLANA_HOOK_PROVISIONER_URL ?? '')
  const secret = resolveSolanaProvisionerSecret()
  if (!url) throw new Error('winner_settlement_missing_provisioner_url')
  if (!secret) throw new Error('winner_settlement_missing_provisioner_secret')
  const timeoutMs = Math.max(1_000, Math.min(Number(process.env.SOLANA_PROVISIONER_TIMEOUT_MS ?? 20_000), 60_000))
  const response = await fetch(`${url}/record-lottery-winner`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text()
  let body: any
  try { body = text ? JSON.parse(text) : {} } catch { throw new Error(`winner_settlement_invalid_ack:${response.status}`) }
  if (!response.ok || body?.success !== true) {
    throw new Error(`winner_settlement_provisioner_${response.status}:${String(body?.error ?? text).slice(0, 200)}`)
  }
  return body as WinnerSettlementAck
}

/**
 * Correlate a confirmed Solana-origin entry with Base VRF winner + callback,
 * then record the winner through the separately gated provisioner endpoint.
 */
export async function processSolanaLotteryWinnerBatch(params: {
  db: Db
  limit?: number
  settle?: (request: WinnerSettlementRequest) => Promise<WinnerSettlementAck>
}): Promise<{ reconciled: number; recovered: number; claimed: number; confirmed: number; quarantined: number; retried: number; errors: string[] }> {
  await ensureSolanaLotteryEntryInboxSchema(params.db as any)
  const limit = Math.max(1, Math.min(params.limit ?? 25, 100))
  const reconciled = await reconcileConfirmedInboxBaseRequestIds({ db: params.db, limit: limit * 2 })
  // Retrying the exact same WinId is safe: the hook's one-shot PDA either
  // records once or returns the identical finalized readback.
  const recovered = await params.db.sql`
    UPDATE solana_lottery_winner_settlement
    SET status = 'pending', attempt_id = NULL, last_error = 'stale_submitting_recovered', updated_at = NOW()
    WHERE status = 'submitting' AND updated_at < NOW() - INTERVAL '5 minutes'
    RETURNING id
  `
  const seeded = await params.db.sql`
    INSERT INTO solana_lottery_winner_settlement (
      win_id, entry_inbox_id, base_tx_hash, base_log_index, base_request_id,
      creator_token, beneficiary_csw, winner_solana, creator_mint, shares_paid,
      status, last_error
    )
    SELECT
      'pending:' || inbox.id,
      inbox.id,
      lower('0x' || encode(winners.tx_hash, 'hex')),
      winners.log_idx,
      winners.request_id,
      lower('0x' || encode(winners.token, 'hex')),
      lower('0x' || encode(winners."user", 'hex')),
      inbox.buyer_solana,
      inbox.creator_mint,
      COALESCE(callbacks.total_shares_paid, drops.total_shares_paid, 0),
      CASE
        WHEN drops.match_count > 0 OR callbacks.match_count <> 1 THEN 'quarantined'
        WHEN COALESCE(callbacks.total_shares_paid, drops.total_shares_paid, 0) <= 0 THEN 'quarantined'
        ELSE 'pending'
      END,
      CASE
        WHEN drops.match_count > 0 THEN 'base_winner_callback_dropped:' || drops.reason
        WHEN callbacks.match_count <> 1 THEN 'base_winner_callback_ambiguous:' || callbacks.match_count
        WHEN COALESCE(callbacks.total_shares_paid, drops.total_shares_paid, 0) <= 0 THEN 'base_winner_callback_zero_shares'
        ELSE NULL
      END
    FROM solana_lottery_entry_inbox inbox
    JOIN solana_share_mesh_mappings mapping
      ON mapping.share_mesh_mint = inbox.creator_mint AND mapping.status = 'applied'
    JOIN protocol_lottery_winners winners
      ON winners.request_id = inbox.base_request_id
     AND lower('0x' || encode(winners.token, 'hex')) = lower(mapping.creator_token)
     AND lower('0x' || encode(winners."user", 'hex')) = lower(inbox.beneficiary_csw)
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS match_count, MAX(callback.total_shares_paid) AS total_shares_paid
      FROM protocol_lottery_winner_callbacks callback
      WHERE callback.tx_hash = winners.tx_hash
        AND callback.dst_eid = 30168
        AND callback.token = winners.token AND callback.winner = winners."user"
    ) callbacks ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS match_count, MAX(dropped.total_shares_paid) AS total_shares_paid,
             MAX(dropped.reason) AS reason
      FROM protocol_lottery_winner_callback_drops dropped
      WHERE dropped.tx_hash = winners.tx_hash
        AND dropped.dst_eid = 30168
        AND dropped.token = winners.token AND dropped.winner = winners."user"
    ) drops ON TRUE
    WHERE inbox.status = 'confirmed'
      AND inbox.base_request_id IS NOT NULL
      AND (callbacks.match_count > 0 OR drops.match_count > 0)
    ON CONFLICT (entry_inbox_id) DO NOTHING
    RETURNING *
  `

  // Replace temporary seeds with full domain-separated IDs. The second read
  // also repairs a process crash between INSERT and this update.
  const unfinished = await params.db.sql`
    SELECT * FROM solana_lottery_winner_settlement
    WHERE win_id LIKE 'pending:%'
    ORDER BY id LIMIT ${limit * 2}
  `
  const seeds = new Map<number, any>()
  for (const row of [...(seeded.rows ?? []), ...(unfinished.rows ?? [])]) seeds.set(Number(row.id), row)
  for (const row of seeds.values()) {
    const winId = deriveSolanaWinnerWinId({
      baseChainId: 8453n,
      baseTxHash: hex(row.base_tx_hash) as `0x${string}`,
      baseLogIndex: Number(row.base_log_index),
      creatorToken: hex(row.creator_token) as `0x${string}`,
      beneficiaryCsw: hex(row.beneficiary_csw) as `0x${string}`,
      requestId: BigInt(row.base_request_id),
    })
    await params.db.sql`UPDATE solana_lottery_winner_settlement SET win_id = ${winId}, updated_at = NOW() WHERE id = ${row.id} AND win_id LIKE 'pending:%'`
  }

  const attemptId = randomUUID()
  const claimed = await params.db.sql`
    WITH candidates AS (
      SELECT id FROM solana_lottery_winner_settlement
      WHERE status = 'pending'
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE solana_lottery_winner_settlement settlement
    SET status = 'submitting', attempt_id = ${attemptId}, attempt_count = attempt_count + 1,
        last_error = NULL, updated_at = NOW()
    FROM candidates WHERE settlement.id = candidates.id
    RETURNING settlement.*
  `

  const output = { reconciled, recovered: recovered.rows.length, claimed: claimed.rows.length, confirmed: 0, quarantined: 0, retried: 0, errors: [] as string[] }
  const settle = params.settle ?? postWinnerSettlement
  for (const row of claimed.rows as any[]) {
    const candidate: Candidate = {
      id: Number(row.id), attemptId, creatorMint: String(row.creator_mint),
      winnerSolana: String(row.winner_solana), sharesPaid: String(row.shares_paid),
      winId: hex(row.win_id),
    }
    try {
      const ack = await settle(candidate)
      if (ack.winId.toLowerCase() !== candidate.winId || !ack.winIdRecord || !ack.winnerRecord) {
        throw new Error('winner_settlement_readback_mismatch')
      }
      const updated = await params.db.sql`
        UPDATE solana_lottery_winner_settlement
        SET status = 'confirmed', solana_signature = ${ack.signature}, win_id_record = ${ack.winIdRecord},
            winner_record = ${ack.winnerRecord}, submitted_at = NOW(), confirmed_at = NOW(), updated_at = NOW()
        WHERE id = ${candidate.id} AND status = 'submitting' AND attempt_id = ${candidate.attemptId}
        RETURNING id
      `
      if (updated.rows.length !== 1) throw new Error('winner_settlement_attempt_fence_lost')
      output.confirmed += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const terminal = message.includes('replay_record_mismatch') || message.includes('readback_mismatch')
      await params.db.sql`
        UPDATE solana_lottery_winner_settlement
        SET status = ${terminal ? 'quarantined' : 'pending'}, last_error = ${message.slice(0, 500)}, updated_at = NOW()
        WHERE id = ${candidate.id} AND status = 'submitting' AND attempt_id = ${candidate.attemptId}
      `
      if (terminal) output.quarantined += 1
      else output.retried += 1
      output.errors.push(`${candidate.winId}:${message}`)
    }
  }
  return output
}
