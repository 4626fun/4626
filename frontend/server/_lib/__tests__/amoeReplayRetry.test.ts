// PR 4 — `amoeReplayRetry` orchestrator unit tests.
//
// Covers `retrySubmissionById` (manual / signed-in user) and
// `retrySubmissionByIdAsCron` (system actor) across the full outcome
// matrix:
//
//   - submission_not_found
//   - ownership mismatch (manual only)
//   - submission_not_retryable (any non-`manager_declined` state)
//   - epoch rolled → markAbandonedEpochRolled, returns 'abandoned_epoch_rolled'
//   - missing proof_blob → markRejectedChain, returns 'rejected_chain'
//   - relay throws ManagerDeclinedEntry → markManagerDeclined, returns
//     'manager_declined_again' (or 'abandoned_budget_exhausted' if state advanced)
//   - relay throws other error → markRejectedChain, returns 'rejected_chain'
//   - relay succeeds → markSettled, returns 'settled'
//
// We mock the replay-store module so the orchestrator can be tested in
// isolation. We also mock `lotteryAmoe.js` so we don't pull in viem +
// the rest of the chain ABI surface.

import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks (must be hoisted so vi.mock factories see them)
// ---------------------------------------------------------------------------

const {
  findByIdMock,
  markAbandonedEpochRolledMock,
  markManagerDeclinedMock,
  markRejectedChainMock,
  markSettledMock,
  buildAmoeEntryZKCallMock,
} = vi.hoisted(() => ({
  findByIdMock: vi.fn(),
  markAbandonedEpochRolledMock: vi.fn(),
  markManagerDeclinedMock: vi.fn(),
  markRejectedChainMock: vi.fn(),
  markSettledMock: vi.fn(),
  buildAmoeEntryZKCallMock: vi.fn(),
}))

vi.mock('../lottery/amoeReplayStore.js', () => ({
  findById: findByIdMock,
  markAbandonedEpochRolled: markAbandonedEpochRolledMock,
  markManagerDeclined: markManagerDeclinedMock,
  markRejectedChain: markRejectedChainMock,
  markSettled: markSettledMock,
}))

vi.mock('../lottery/lotteryAmoe.js', () => ({
  buildAmoeEntryZKCall: buildAmoeEntryZKCallMock,
  AMOE_PLONK_PUB_INPUT_SLOT: {
    walletAddrCommit: 0,
    creatorCoinAddr: 1,
    nonceCommit: 2,
    epoch: 3,
    allowlistRoot: 4,
    pointsBurnedAsUSD: 5,
    pointsLedgerRoot: 6,
    pointsBurnNullifier: 7,
  },
  AMOE_PLONK_PROOF_LEN: 24,
  AMOE_PLONK_PUB_INPUTS_LEN: 8,
}))

import {
  retrySubmissionById,
  retrySubmissionByIdAsCron,
  type RetrySubmissionRelay,
} from '../lottery/amoeReplayRetry.js'
import {
  AmoeAuthorityError,
  AmoeBadRequestError,
  AmoeServerError,
} from '../lottery/lotteryAmoeErrors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBMISSION_ID = 'a3a4b5c6-1111-2222-3333-444455556666'
const ROUTER = '0x77705a2f173dd52f28300447506dc35086c34626' as const
const TX_HASH = `0x${'ee'.repeat(32)}` as `0x${string}`
const SIGNUP_ID_OWNER = 12345n
const SIGNUP_ID_OTHER = 99999n
const EPOCH = 100n

const CANONICAL_PROOF = Array.from(
  { length: 24 },
  (_, i) => `0x${i.toString(16).padStart(64, '0')}`,
)
const CANONICAL_PUB = Array.from(
  { length: 8 },
  (_, i) => `0x${(i + 100).toString(16).padStart(64, '0')}`,
)

interface RowOverrides {
  state?: string
  epoch?: bigint
  proofBlob?: { proof: string[]; pubInputs: string[] } | null
  signupId?: bigint
}

function buildRow(overrides: RowOverrides = {}): any {
  return {
    id: SUBMISSION_ID,
    signupId: overrides.signupId ?? SIGNUP_ID_OWNER,
    wallet: '0x1111111111111111111111111111111111111111',
    creatorCoin: '0x2222222222222222222222222222222222222222',
    epoch: overrides.epoch ?? EPOCH,
    nonceCommitHex: `0x${'aa'.repeat(32)}`,
    walletCommitHex: `0x${'bb'.repeat(32)}`,
    pointsBurnNullifierHex: `0x${'cc'.repeat(32)}`,
    proofBlob:
      overrides.proofBlob === undefined
        ? { proof: CANONICAL_PROOF, pubInputs: CANONICAL_PUB }
        : overrides.proofBlob,
    spendRefId: `zk:${SUBMISSION_ID}`,
    pointsBurned: 500n,
    state: overrides.state ?? 'manager_declined',
    stateReason: null,
    createdAt: new Date('2026-04-29T00:00:00Z'),
    provenAt: new Date('2026-04-29T01:00:00Z'),
    broadcastAt: new Date('2026-04-29T01:01:00Z'),
    settledAt: null,
    txHash: TX_HASH,
    blockNumber: null,
    managerEntryId: null,
    retryCount: 1,
    nextRetryAt: new Date('2026-04-29T02:00:00Z'),
    lastRetryError: 'lottery_paused',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: buildAmoeEntryZKCall succeeds and returns a calldata blob.
  buildAmoeEntryZKCallMock.mockResolvedValue({
    to: ROUTER,
    callData: ('0x' + 'aa'.repeat(200)) as `0x${string}`,
  })
})

// ---------------------------------------------------------------------------
// retrySubmissionById — pre-flight checks
// ---------------------------------------------------------------------------

describe('retrySubmissionById — preflight', () => {
  it('throws submission_not_found when row missing', async () => {
    findByIdMock.mockResolvedValueOnce(null)
    let err: unknown = null
    try {
      await retrySubmissionById({
        submissionId: SUBMISSION_ID,
        callerSignupId: SIGNUP_ID_OWNER,
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
        relay: vi.fn(),
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('submission_not_found')
  })

  it('throws AmoeAuthorityError when caller signup_id mismatches', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow({ signupId: SIGNUP_ID_OTHER }))
    let err: unknown = null
    try {
      await retrySubmissionById({
        submissionId: SUBMISSION_ID,
        callerSignupId: SIGNUP_ID_OWNER,
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
        relay: vi.fn(),
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeAuthorityError)
    expect((err as Error).message).toBe('submission_authority_mismatch')
  })

  it('throws submission_not_retryable for any non-manager_declined state', async () => {
    for (const state of ['pending', 'proven', 'broadcast', 'settled', 'rejected_chain', 'abandoned', 'prove_failed']) {
      findByIdMock.mockResolvedValueOnce(buildRow({ state }))
      let err: unknown = null
      try {
        await retrySubmissionById({
          submissionId: SUBMISSION_ID,
          callerSignupId: SIGNUP_ID_OWNER,
          currentEpoch: EPOCH,
          lotteryAmoeRouter: ROUTER,
          relay: vi.fn(),
        })
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(AmoeBadRequestError)
      expect((err as Error).message).toBe('submission_not_retryable')
    }
  })

  it('throws amoe_retry_relay_missing when relay not provided', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    let err: unknown = null
    try {
      await retrySubmissionById({
        submissionId: SUBMISSION_ID,
        callerSignupId: SIGNUP_ID_OWNER,
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_retry_relay_missing')
  })
})

// ---------------------------------------------------------------------------
// retrySubmissionById — outcome matrix
// ---------------------------------------------------------------------------

describe('retrySubmissionById — outcomes', () => {
  it('epoch mismatch → markAbandonedEpochRolled, returns abandoned_epoch_rolled', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow({ epoch: 99n }))
    markAbandonedEpochRolledMock.mockResolvedValueOnce(buildRow({ state: 'abandoned' }))

    const relay = vi.fn() as unknown as RetrySubmissionRelay
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'abandoned_epoch_rolled' })
    expect(markAbandonedEpochRolledMock).toHaveBeenCalledWith(SUBMISSION_ID)
    expect(relay).not.toHaveBeenCalled()
  })

  it('missing proof_blob → markRejectedChain(proof_blob_missing)', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow({ proofBlob: null }))
    markRejectedChainMock.mockResolvedValueOnce(buildRow({ state: 'rejected_chain' }))

    const relay = vi.fn() as unknown as RetrySubmissionRelay
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'rejected_chain', reason: 'proof_blob_missing' })
    expect(markRejectedChainMock).toHaveBeenCalledWith(SUBMISSION_ID, {
      reason: 'proof_blob_missing',
    })
    expect(relay).not.toHaveBeenCalled()
  })

  it('relay succeeds → markSettled, returns settled with txHash', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    markSettledMock.mockResolvedValueOnce(buildRow({ state: 'settled' }))

    const relay: RetrySubmissionRelay = vi.fn().mockResolvedValue(TX_HASH)
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'settled', txHash: TX_HASH })
    expect(markSettledMock).toHaveBeenCalledWith(SUBMISSION_ID, {
      txHash: TX_HASH,
      blockNumber: 0n,
      managerEntryId: null,
    })
    expect(buildAmoeEntryZKCallMock).toHaveBeenCalledTimes(1)
    // Verify the orchestrator passed proof + pubInputs as bigints with
    // correct lengths (mirrors blobToBigints contract).
    const callArgs = buildAmoeEntryZKCallMock.mock.calls[0]![0]
    expect(callArgs.proof).toHaveLength(24)
    expect(callArgs.pubInputs).toHaveLength(8)
    expect(typeof callArgs.proof[0]).toBe('bigint')
    expect(typeof callArgs.pubInputs[0]).toBe('bigint')
    expect(callArgs.lotteryAmoeRouter).toBe(ROUTER)
    expect(callArgs.epoch).toBe(EPOCH)
  })

  it('relay throws ManagerDeclinedEntry → markManagerDeclined, returns manager_declined_again', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    markManagerDeclinedMock.mockResolvedValueOnce(
      buildRow({ state: 'manager_declined' }),
    )
    const declineErr = Object.assign(new Error('execution reverted: ManagerDeclinedEntry()'), {
      name: 'ContractFunctionExecutionError',
      shortMessage: 'ManagerDeclinedEntry',
    })
    const relay: RetrySubmissionRelay = vi.fn().mockRejectedValue(declineErr)
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out.kind).toBe('manager_declined_again')
    expect(markManagerDeclinedMock).toHaveBeenCalledTimes(1)
    expect(markManagerDeclinedMock.mock.calls[0]![1]!.reason).toBe('ManagerDeclinedEntry')
  })

  it('relay throws ManagerDeclinedEntry, store advances row to abandoned → returns abandoned_budget_exhausted', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    // markManagerDeclined returns row in 'abandoned' state — happens
    // when retry_count + 1 >= maxRetries inside the same UPDATE.
    markManagerDeclinedMock.mockResolvedValueOnce(buildRow({ state: 'abandoned' }))
    const declineErr = new Error('ManagerDeclinedEntry')
    const relay: RetrySubmissionRelay = vi.fn().mockRejectedValue(declineErr)
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'abandoned_budget_exhausted' })
  })

  it('relay throws non-ManagerDeclinedEntry error → markRejectedChain, returns rejected_chain', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    markRejectedChainMock.mockResolvedValueOnce(buildRow({ state: 'rejected_chain' }))
    const relay: RetrySubmissionRelay = vi
      .fn()
      .mockRejectedValue(new Error('execution reverted: NonceReplayed'))
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out.kind).toBe('rejected_chain')
    expect((out as { kind: 'rejected_chain'; reason: string }).reason).toContain(
      'NonceReplayed',
    )
    expect(markRejectedChainMock).toHaveBeenCalledTimes(1)
  })

  it('relay throws non-Error value → reason becomes relay_failed', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    markRejectedChainMock.mockResolvedValueOnce(buildRow({ state: 'rejected_chain' }))
    // Throw a non-Error; the orchestrator must still classify gracefully.
    const relay: RetrySubmissionRelay = vi.fn().mockRejectedValue('boom')
    const out = await retrySubmissionById({
      submissionId: SUBMISSION_ID,
      callerSignupId: SIGNUP_ID_OWNER,
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'rejected_chain', reason: 'relay_failed' })
  })

  it('proof_blob with wrong proof length throws amoe_replay_proof_blob_invalid', async () => {
    findByIdMock.mockResolvedValueOnce(
      buildRow({ proofBlob: { proof: ['0x1'], pubInputs: CANONICAL_PUB } }),
    )
    const relay: RetrySubmissionRelay = vi.fn()
    let err: unknown = null
    try {
      await retrySubmissionById({
        submissionId: SUBMISSION_ID,
        callerSignupId: SIGNUP_ID_OWNER,
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
        relay,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_replay_proof_blob_invalid')
  })

  it('proof_blob with wrong pubInputs length throws amoe_replay_proof_blob_invalid', async () => {
    findByIdMock.mockResolvedValueOnce(
      buildRow({ proofBlob: { proof: CANONICAL_PROOF, pubInputs: ['0x1'] } }),
    )
    const relay: RetrySubmissionRelay = vi.fn()
    let err: unknown = null
    try {
      await retrySubmissionById({
        submissionId: SUBMISSION_ID,
        callerSignupId: SIGNUP_ID_OWNER,
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
        relay,
      })
    } catch (e) {
      err = e
    }
    expect((err as Error).message).toBe('amoe_replay_proof_blob_invalid')
  })
})

// ---------------------------------------------------------------------------
// retrySubmissionByIdAsCron — system actor (no ownership check)
// ---------------------------------------------------------------------------

describe('retrySubmissionByIdAsCron', () => {
  it('skips ownership check, settles successfully', async () => {
    // Note `signupId` differs from any caller — cron should NOT reject.
    findByIdMock.mockResolvedValueOnce(buildRow({ signupId: SIGNUP_ID_OTHER }))
    markSettledMock.mockResolvedValueOnce(buildRow({ state: 'settled' }))

    const relay: RetrySubmissionRelay = vi.fn().mockResolvedValue(TX_HASH)
    const out = await retrySubmissionByIdAsCron(SUBMISSION_ID, {
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'settled', txHash: TX_HASH })
  })

  it('throws submission_not_found for missing rows', async () => {
    findByIdMock.mockResolvedValueOnce(null)
    let err: unknown = null
    try {
      await retrySubmissionByIdAsCron(SUBMISSION_ID, {
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
        relay: vi.fn(),
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('submission_not_found')
  })

  it('returns state_advanced_under_cron when row state is no longer manager_declined', async () => {
    // Concurrent worker advanced the row between pickup and processing.
    findByIdMock.mockResolvedValueOnce(buildRow({ state: 'settled' }))
    const out = await retrySubmissionByIdAsCron(SUBMISSION_ID, {
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay: vi.fn(),
    })
    expect(out).toEqual({ kind: 'rejected_chain', reason: 'state_advanced_under_cron' })
  })

  it('throws amoe_retry_relay_missing when relay not provided', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow())
    let err: unknown = null
    try {
      await retrySubmissionByIdAsCron(SUBMISSION_ID, {
        currentEpoch: EPOCH,
        lotteryAmoeRouter: ROUTER,
      })
    } catch (e) {
      err = e
    }
    expect((err as Error).message).toBe('amoe_retry_relay_missing')
  })

  it('handles epoch mismatch like the manual path', async () => {
    findByIdMock.mockResolvedValueOnce(buildRow({ epoch: 99n }))
    markAbandonedEpochRolledMock.mockResolvedValueOnce(buildRow({ state: 'abandoned' }))
    const relay: RetrySubmissionRelay = vi.fn()
    const out = await retrySubmissionByIdAsCron(SUBMISSION_ID, {
      currentEpoch: EPOCH,
      lotteryAmoeRouter: ROUTER,
      relay,
    })
    expect(out).toEqual({ kind: 'abandoned_epoch_rolled' })
    expect(relay).not.toHaveBeenCalled()
  })
})
