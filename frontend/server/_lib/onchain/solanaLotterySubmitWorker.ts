/**
 * Solana lottery inbox submit worker.
 *
 * Orchestrates: claim → prepareSolanaLotteryInboxForSubmit → beginInboxSubmit →
 * LZ OApp send → markInboxSubmitted. Failures route to skip/quarantine/release.
 *
 * Still gated by SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED + transport readiness
 * inside submitSolanaLotteryEntryViaLz. Does not enable flags by itself.
 */

import { randomUUID } from 'node:crypto'

import {
  beginInboxSubmit,
  claimSolanaLotteryInboxLeases,
  markInboxQuarantined,
  markInboxSkippedIdentity,
  markInboxSkippedPricing,
  markInboxSubmitted,
  releaseInboxLease,
  type SolanaLotteryInboxRow,
} from './solanaLotteryEntryInbox.js'
import {
  assessSolanaLotteryLzTransportReadiness,
  submitSolanaLotteryEntryViaLz,
  type SolanaLotteryLzSubmitResult,
} from './solanaLotteryLzTransport.js'
import type { SolanaLotteryOappSender } from './solanaLotteryOappSender.js'
import { prepareSolanaLotteryInboxForSubmit } from './solanaLotterySubmission.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

export type SolanaLotterySubmitWorkerResult = {
  claimed: number
  submitted: number
  skippedIdentity: number
  skippedPricing: number
  quarantined: number
  released: number
  errors: string[]
}

function resolveAmountScaled(row: SolanaLotteryInboxRow): string {
  const raw = String(row.amountRaw ?? '').trim()
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error('solana_lottery_invalid_scaled_amount')
  }
  // B2 hook mint uses the share-mesh amount surface; LZ payload amount is the
  // same integer until an explicit decimal adapter is configured.
  return raw
}

function isIdentityError(message: string): boolean {
  return (
    message.startsWith('solana_lottery_identity_') ||
    message === 'solana_lottery_b2_mapping_missing' ||
    message === 'solana_lottery_b2_route_not_ready'
  )
}

export async function processSolanaLotteryInboxSubmitBatch(params: {
  db: Db
  leaseOwner: string
  limit?: number
  sender?: SolanaLotteryOappSender | null
  submit?: (request: {
    sourceEventId: string
    buyer: `0x${string}`
    tokenIn: `0x${string}`
    amount: bigint
  }) => Promise<SolanaLotteryLzSubmitResult>
}): Promise<SolanaLotterySubmitWorkerResult> {
  const leaseOwner = params.leaseOwner.trim()
  if (!leaseOwner) throw new Error('invalid_lease_owner')

  const claimed = await claimSolanaLotteryInboxLeases({
    db: params.db,
    leaseOwner,
    limit: params.limit,
  })

  const out: SolanaLotterySubmitWorkerResult = {
    claimed: claimed.length,
    submitted: 0,
    skippedIdentity: 0,
    skippedPricing: 0,
    quarantined: 0,
    released: 0,
    errors: [],
  }

  const submitFn =
    params.submit ??
    ((request) => submitSolanaLotteryEntryViaLz(request, { sender: params.sender }))

  for (const leased of claimed) {
    let row = leased
    try {
      let amountScaled: string
      try {
        amountScaled = resolveAmountScaled(row)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'invalid_scaled_amount'
        await markInboxSkippedPricing({
          db: params.db,
          id: row.id,
          leaseOwner,
          reason,
        })
        out.skippedPricing += 1
        continue
      }

      try {
        row = await prepareSolanaLotteryInboxForSubmit({
          db: params.db,
          row,
          leaseOwner,
          amountScaled,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (isIdentityError(message)) {
          await markInboxSkippedIdentity({
            db: params.db,
            id: row.id,
            leaseOwner,
            reason: message,
          })
          out.skippedIdentity += 1
          continue
        }
        throw error
      }

      if (!row.beneficiaryCsw || !row.shareOft || !row.amountScaled) {
        throw new Error('solana_lottery_identity_incomplete')
      }

      // Effect-free gate before fencing submit intent.
      const readiness = assessSolanaLotteryLzTransportReadiness()
      if (!readiness.ready) {
        await releaseInboxLease({
          db: params.db,
          id: row.id,
          leaseOwner,
          lastError: `transport_not_ready:${readiness.reasons.join(',')}`,
        })
        out.released += 1
        out.errors.push(`${row.sourceEventId}:transport_not_ready`)
        continue
      }

      const submitAttemptId = randomUUID()
      row = await beginInboxSubmit({
        db: params.db,
        id: row.id,
        leaseOwner,
        submitAttemptId,
      })

      try {
        const sent = await submitFn({
          sourceEventId: row.sourceEventId,
          buyer: row.beneficiaryCsw as `0x${string}`,
          tokenIn: row.shareOft as `0x${string}`,
          amount: BigInt(row.amountScaled),
        })
        await markInboxSubmitted({
          db: params.db,
          id: row.id,
          leaseOwner,
          submitAttemptId,
          lzGuid: sent.lzGuid,
          baseTxHash: sent.baseTxHash,
        })
        out.submitted += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // After beginInboxSubmit, never auto-return to pending.
        await markInboxQuarantined({
          db: params.db,
          id: row.id,
          leaseOwner,
          reason: message.slice(0, 500) || 'submit_failed',
        })
        out.quarantined += 1
        out.errors.push(`${row.sourceEventId}:${message}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      out.errors.push(`${row.sourceEventId}:${message}`)
      try {
        await markInboxQuarantined({
          db: params.db,
          id: row.id,
          leaseOwner,
          reason: message.slice(0, 500) || 'submit_worker_error',
        })
        out.quarantined += 1
      } catch {
        // Best-effort; row may already be terminal.
      }
    }
  }

  return out
}
