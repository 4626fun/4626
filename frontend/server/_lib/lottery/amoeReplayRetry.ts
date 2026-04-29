// SPDX-License-Identifier: MIT
//
// AMOE replay-store retry orchestrator.
//
// Single entry point for both:
//   * `POST /api/v1/lottery/amoe/retry-zk` (manual user-initiated retry)
//   * `amoe_retry_cron` (5-minute scheduled sweep of `manager_declined`)
//
// Both call paths share the same state-transition + relay logic; the
// only difference is who picks the row (manual vs cron) and how
// errors propagate (HTTP vs metrics-only).
//
// LOCKED INVARIANT: a retry MUST NOT regenerate the proof. The router
// only rolls back the nullifier writes when `ManagerDeclinedEntry`
// fires; for every other revert path the nullifiers are committed,
// and re-broadcasting the same proof would fail with `NonceReplayed`.
// Because of that, this module never re-enters the prover \u2014 it pulls
// the stored `proof_blob` and re-decodes it for `submitAmoeEntryZK`.
//
// Design doc: `docs/security/amoe-pr4-replay-store-design.md` \u00a76.

import {
  buildAmoeEntryZKCall,
  AMOE_PLONK_PUB_INPUT_SLOT,
  AMOE_PLONK_PROOF_LEN,
  AMOE_PLONK_PUB_INPUTS_LEN,
} from './lotteryAmoe.js'
import {
  findById,
  markAbandonedEpochRolled,
  markManagerDeclined,
  markRejectedChain,
  markSettled,
  type AmoeReplayProofBlob,
  type AmoeSubmissionRow,
} from './amoeReplayStore.js'
import {
  AmoeBadRequestError,
  AmoeServerError,
} from './lotteryAmoeErrors.js'

/**
 * Relay function injected by callers. Production wires it to the same
 * `relayAmoeEntryZkTransaction` used by the submit handler; tests mock it.
 */
export type RetrySubmissionRelay = (params: {
  to: `0x${string}`
  callData: `0x${string}`
}) => Promise<`0x${string}`>

export type RetrySubmissionOutcome =
  | { kind: 'settled'; txHash: `0x${string}` }
  | { kind: 'manager_declined_again'; retryCount: number; reason: string }
  | { kind: 'abandoned_epoch_rolled' }
  | { kind: 'abandoned_budget_exhausted' }
  | { kind: 'rejected_chain'; reason: string }

export interface RetrySubmissionParams {
  submissionId: string
  /**
   * Caller's signup_id (Postgres bigint). Required for ownership check
   * \u2014 a retry is rejected unless the caller owns the row.
   *
   * For cron callers, pass the row's own `signup_id` value (the cron
   * is acting on behalf of the user and is allowed to retry their rows
   * regardless of who originally submitted them).
   */
  callerSignupId: bigint
  /**
   * Current epoch. Compared to the row's `epoch` \u2014 a mismatch means
   * the proof is no longer valid for the current epoch and the row is
   * abandoned with `epoch_rolled`.
   */
  currentEpoch: bigint
  /** Address of the deployed `LotteryAmoeRouter`. */
  lotteryAmoeRouter: `0x${string}`
  /**
   * Relay function. Production callers leave this as the default
   * (resolved by the caller), tests inject a mock.
   */
  relay?: RetrySubmissionRelay
}

/**
 * The cron-only variant: skips the `callerSignupId` ownership check
 * because the cron runs as a system-level actor. Also drops
 * `submissionId` because the cron passes the id as a positional arg
 * to the per-row retry call.
 */
export interface CronRetrySubmissionParams {
  currentEpoch: bigint
  lotteryAmoeRouter: `0x${string}`
  relay?: RetrySubmissionRelay
}

/**
 * Decode a `ManagerDeclinedEntry` revert from a relay error. Mirrors
 * the detector in the submit handler so the retry path classifies the
 * same shapes consistently.
 */
function decodeManagerDeclinedRevert(
  err: unknown,
): { reason: string; txHash: `0x${string}` | null } | null {
  if (!err || typeof err !== 'object') return null
  const e = err as {
    name?: string
    message?: string
    cause?: { name?: string; message?: string }
    shortMessage?: string
    metaMessages?: string[]
    transactionHash?: string
  }
  const haystack = [
    e.name,
    e.message,
    e.shortMessage,
    e.cause?.name,
    e.cause?.message,
    ...(Array.isArray(e.metaMessages) ? e.metaMessages : []),
  ]
    .filter((s): s is string => typeof s === 'string')
    .join(' | ')
  if (!haystack) return null
  if (!/ManagerDeclinedEntry/.test(haystack)) return null
  const txHash =
    typeof e.transactionHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(e.transactionHash)
      ? (e.transactionHash.toLowerCase() as `0x${string}`)
      : null
  return { reason: 'ManagerDeclinedEntry', txHash }
}

function blobToBigints(blob: AmoeReplayProofBlob): { proof: bigint[]; pubInputs: bigint[] } {
  if (!Array.isArray(blob.proof) || !Array.isArray(blob.pubInputs)) {
    throw new AmoeServerError('amoe_replay_proof_blob_invalid')
  }
  if (blob.proof.length !== AMOE_PLONK_PROOF_LEN) {
    throw new AmoeServerError('amoe_replay_proof_blob_invalid')
  }
  if (blob.pubInputs.length !== AMOE_PLONK_PUB_INPUTS_LEN) {
    throw new AmoeServerError('amoe_replay_proof_blob_invalid')
  }
  const proof = blob.proof.map((s) => BigInt(String(s)))
  const pubInputs = blob.pubInputs.map((s) => BigInt(String(s)))
  return { proof, pubInputs }
}

/**
 * Internal: shared retry path used by both the manual endpoint and the
 * cron. Pulls the row, validates state + epoch, rebuilds calldata,
 * relays, classifies outcome.
 *
 * Caller pre-resolves the relay (so this module stays decoupled from
 * the handler's relay implementation, which depends on viem +
 * `privyCoinbaseSmartWallet`).
 */
async function executeRetry(
  row: AmoeSubmissionRow,
  params: { lotteryAmoeRouter: `0x${string}`; relay: RetrySubmissionRelay; currentEpoch: bigint },
): Promise<RetrySubmissionOutcome> {
  if (row.epoch !== params.currentEpoch) {
    await markAbandonedEpochRolled(row.id)
    return { kind: 'abandoned_epoch_rolled' }
  }

  if (!row.proofBlob) {
    // Should never happen for a `manager_declined` row \u2014 the GC policy
    // explicitly preserves the blob in that state. If we hit this,
    // someone manually nulled the column. Surface as terminal.
    await markRejectedChain(row.id, { reason: 'proof_blob_missing' })
    return { kind: 'rejected_chain', reason: 'proof_blob_missing' }
  }

  const { proof, pubInputs } = blobToBigints(row.proofBlob)

  const call = await buildAmoeEntryZKCall({
    wallet: row.wallet,
    creatorCoin: row.creatorCoin,
    epoch: row.epoch,
    proof,
    pubInputs,
    lotteryAmoeRouter: params.lotteryAmoeRouter,
  })

  let txHash: `0x${string}`
  try {
    txHash = await params.relay({ to: call.to, callData: call.callData })
  } catch (relayErr) {
    const declined = decodeManagerDeclinedRevert(relayErr)
    if (declined) {
      const updated = await markManagerDeclined(row.id, {
        txHash: declined.txHash ?? ('0x' as `0x${string}`),
        reason: declined.reason,
      })
      if (updated.state === 'abandoned') {
        return { kind: 'abandoned_budget_exhausted' }
      }
      return {
        kind: 'manager_declined_again',
        retryCount: updated.retryCount,
        reason: declined.reason,
      }
    }
    const reason =
      relayErr instanceof Error ? relayErr.message.slice(0, 256) : 'relay_failed'
    await markRejectedChain(row.id, { reason })
    return { kind: 'rejected_chain', reason }
  }

  await markSettled(row.id, {
    txHash,
    blockNumber: 0n, // PR 5 publisher backfills these from chain.
    managerEntryId: null,
  })
  // Best-effort: the original submit handler already debited credits
  // on the first successful settle, so a retry that finally settles
  // does NOT re-debit. The replay-store's terminal `settled` state is
  // the audit-time source of truth.
  // Audit pubInputs slot occupied to silence unused-var warnings while
  // documenting that `pubInputs` IS the binding the chain just accepted.
  void AMOE_PLONK_PUB_INPUT_SLOT
  void pubInputs
  return { kind: 'settled', txHash }
}

/**
 * Public: retry by id, with caller-ownership verification.
 *
 * Used by the `POST /api/v1/lottery/amoe/retry-zk` HTTP endpoint.
 *
 * Validates:
 *   1. Row exists.
 *   2. Caller owns the row (`signup_id === callerSignupId`).
 *   3. State is `manager_declined` (only retryable state).
 *   4. Current epoch matches the row's epoch.
 *
 * @throws AmoeBadRequestError('submission_not_found')
 * @throws AmoeAuthorityError if caller doesn't own the row
 * @throws AmoeBadRequestError('submission_not_retryable') for any state
 *         other than `manager_declined`
 */
export async function retrySubmissionById(
  params: RetrySubmissionParams,
): Promise<RetrySubmissionOutcome> {
  const row = await findById(params.submissionId)
  if (!row) {
    throw new AmoeBadRequestError('submission_not_found')
  }
  if (row.signupId !== params.callerSignupId) {
    // Distinct error class used by the handler to surface 403.
    const { AmoeAuthorityError } = await import('./lotteryAmoeErrors.js')
    throw new AmoeAuthorityError('submission_authority_mismatch')
  }
  if (row.state !== 'manager_declined') {
    throw new AmoeBadRequestError('submission_not_retryable')
  }
  const relay = params.relay
  if (!relay) {
    throw new AmoeServerError('amoe_retry_relay_missing')
  }
  return executeRetry(row, {
    lotteryAmoeRouter: params.lotteryAmoeRouter,
    relay,
    currentEpoch: params.currentEpoch,
  })
}

/**
 * Public: retry by id from the cron path \u2014 skips the
 * caller-ownership check (the cron is a system actor).
 */
export async function retrySubmissionByIdAsCron(
  id: string,
  params: CronRetrySubmissionParams,
): Promise<RetrySubmissionOutcome> {
  const row = await findById(id)
  if (!row) throw new AmoeBadRequestError('submission_not_found')
  if (row.state !== 'manager_declined') {
    // The pickup query already filters by state; if we land here the
    // row was concurrently advanced by a parallel cron worker. That's
    // fine \u2014 just no-op.
    return { kind: 'rejected_chain', reason: 'state_advanced_under_cron' }
  }
  const relay = params.relay
  if (!relay) {
    throw new AmoeServerError('amoe_retry_relay_missing')
  }
  return executeRetry(row, {
    lotteryAmoeRouter: params.lotteryAmoeRouter,
    relay,
    currentEpoch: params.currentEpoch,
  })
}
