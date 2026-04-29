// PR 4 — `amoeReplayStore` unit tests.
//
// Covers the state machine surface: insertPending, findById,
// findActiveByNonceCommit, markProven (happy + unique-violation +
// state-precondition), markBroadcasting, markSettled, markManagerDeclined
// (incl. retry-budget abandon), markProveFailed, markRejectedChain,
// markAbandonedEpochRolled, pickRetriesForCron, reclaimStrandedRetries,
// gcExpiredProofBlobs, and the defaultRetryBackoffMs helper.
//
// Mocking pattern mirrors `amoeNonceStore.test.ts`: capture every
// `db.sql\`...\`` invocation against a vi.hoisted() getDb mock and
// inspect the SQL fragments / bound values.
//
// IMPORTANT: ensureAmoeReplayStoreSchema runs SEVEN DDL statements
// (CREATE TABLE + ALTER TABLE ADD COLUMN IF NOT EXISTS retry_started_at
// + 5 CREATE INDEX). After schema bootstrap the statement under test is
// at calls[7]. Tests reset the cache via
// __resetAmoeReplayStoreSchemaEnsuredForTest() in beforeEach.

import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

import {
  AMOE_SUBMISSION_TERMINAL_STATES,
  DEFAULT_AMOE_MAX_RETRIES,
  __resetAmoeReplayStoreSchemaEnsuredForTest,
  defaultRetryBackoffMs,
  findActiveByNonceCommit,
  findById,
  gcExpiredProofBlobs,
  insertPending,
  markAbandonedEpochRolled,
  markBroadcasting,
  markManagerDeclined,
  markProveFailed,
  markProven,
  markRejectedChain,
  markSettled,
  pickRetriesForCron,
  readAmoeMaxRetries,
  reclaimStrandedRetries,
  type AmoeReplayProofBlob,
} from '../lottery/amoeReplayStore.js'
import {
  AmoeBadRequestError,
  AmoeServerError,
} from '../lottery/lotteryAmoeErrors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_WALLET = '0x1111111111111111111111111111111111111111' as const
const VALID_CREATOR = '0x2222222222222222222222222222222222222222' as const
const NONCE_COMMIT = `0x${'aa'.repeat(32)}` as `0x${string}`
const WALLET_COMMIT = `0x${'bb'.repeat(32)}` as `0x${string}`
const POINTS_NULL = `0x${'cc'.repeat(32)}` as `0x${string}`
const TX_HASH = `0x${'dd'.repeat(32)}` as `0x${string}`
const SUBMISSION_ID = 'a3a4b5c6-1111-2222-3333-444455556666'

const SAMPLE_PROOF_BLOB: AmoeReplayProofBlob = {
  proof: Array.from({ length: 24 }, (_, i) => `0x${i.toString(16).padStart(64, '0')}`),
  pubInputs: Array.from({ length: 8 }, (_, i) => `0x${(i + 100).toString(16).padStart(64, '0')}`),
}

/**
 * Schema bootstrap runs SEVEN DDL statements:
 *   1. CREATE TABLE IF NOT EXISTS amoe_zk_submissions
 *   2. ALTER TABLE … ADD COLUMN IF NOT EXISTS retry_started_at  (forward-compat)
 *   3-7. five CREATE INDEX statements
 */
const SCHEMA_BOOTSTRAP_STMT_COUNT = 7
/** Index of the first non-bootstrap statement in `calls`. */
const FIRST_OP_IDX = SCHEMA_BOOTSTRAP_STMT_COUNT // i.e. 7

interface SqlCall {
  strings: TemplateStringsArray
  values: unknown[]
}

/**
 * Fluent mock harness — every `db.sql\`...\`` call is captured. Result
 * sequence is queue-driven so each statement (schema bootstrap + the
 * actual mutation) gets its own canned response. Default response on
 * an empty queue is `{ rows: [] }` to match the schema bootstrap shape.
 */
function makeDbMock(): {
  db: { sql: ReturnType<typeof vi.fn> }
  calls: SqlCall[]
  pushResult: (r: { rows: any[] } | Error) => void
  pushSchemaBootstrapNoops: () => void
  pushDefaultRows: (rows: any[]) => void
} {
  const calls: SqlCall[] = []
  const queue: Array<{ rows: any[] } | Error> = []
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings, values })
    const next = queue.shift()
    if (next instanceof Error) throw next
    if (next) return next
    return { rows: [] }
  })
  return {
    db: { sql: sql as unknown as ReturnType<typeof vi.fn> },
    calls,
    pushResult: (r) => queue.push(r),
    pushSchemaBootstrapNoops: () => {
      for (let i = 0; i < SCHEMA_BOOTSTRAP_STMT_COUNT; i++) queue.push({ rows: [] })
    },
    pushDefaultRows: (rows) => queue.push({ rows }),
  }
}

/** Build a representative raw-row fixture matching the table schema. */
function makeRawRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: SUBMISSION_ID,
    signup_id: '12345',
    wallet_address: VALID_WALLET,
    creator_coin: VALID_CREATOR,
    epoch: '100',
    nonce_commit_hex: null,
    wallet_commit_hex: null,
    points_burn_nullifier_hex: null,
    proof_blob: null,
    spend_ref_id: 'zk:test-ref',
    points_burned: '500',
    state: 'pending',
    state_reason: null,
    created_at: new Date('2026-04-29T00:00:00Z'),
    proven_at: null,
    broadcast_at: null,
    settled_at: null,
    tx_hash: null,
    block_number: null,
    manager_entry_id: null,
    retry_count: 0,
    next_retry_at: null,
    last_retry_error: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetAmoeReplayStoreSchemaEnsuredForTest()
})

// ---------------------------------------------------------------------------
// Constants / pure helpers
// ---------------------------------------------------------------------------

describe('module constants', () => {
  it('exports the expected terminal-state set', () => {
    expect(AMOE_SUBMISSION_TERMINAL_STATES).toBeInstanceOf(Set)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('settled')).toBe(true)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('prove_failed')).toBe(true)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('abandoned')).toBe(true)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('rejected_chain')).toBe(true)
    // Transient states must NOT be in terminal set.
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('pending')).toBe(false)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('proven')).toBe(false)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('broadcast')).toBe(false)
    expect(AMOE_SUBMISSION_TERMINAL_STATES.has('manager_declined')).toBe(false)
  })

  it('DEFAULT_AMOE_MAX_RETRIES is 8 per design doc', () => {
    expect(DEFAULT_AMOE_MAX_RETRIES).toBe(8)
  })
})

describe('readAmoeMaxRetries', () => {
  beforeEach(() => {
    delete process.env.AMOE_MAX_RETRIES
  })

  it('returns the default when env unset', () => {
    expect(readAmoeMaxRetries()).toBe(DEFAULT_AMOE_MAX_RETRIES)
  })

  it('honours a valid override', () => {
    process.env.AMOE_MAX_RETRIES = '12'
    expect(readAmoeMaxRetries()).toBe(12)
  })

  it('falls back to default when override is non-numeric', () => {
    process.env.AMOE_MAX_RETRIES = 'banana'
    expect(readAmoeMaxRetries()).toBe(DEFAULT_AMOE_MAX_RETRIES)
  })

  it('falls back to default when override is out of range', () => {
    process.env.AMOE_MAX_RETRIES = '0'
    expect(readAmoeMaxRetries()).toBe(DEFAULT_AMOE_MAX_RETRIES)
    process.env.AMOE_MAX_RETRIES = '500'
    expect(readAmoeMaxRetries()).toBe(DEFAULT_AMOE_MAX_RETRIES)
  })
})

describe('defaultRetryBackoffMs', () => {
  it('starts at ~30 minutes for retryCount=0 (plus jitter ≤5min)', () => {
    const ms = defaultRetryBackoffMs(0)
    const base = 30 * 60 * 1000
    expect(ms).toBeGreaterThanOrEqual(base)
    expect(ms).toBeLessThanOrEqual(base + 5 * 60 * 1000)
  })

  it('grows exponentially: retryCount=1 ≈ 60min', () => {
    const ms = defaultRetryBackoffMs(1)
    const base = 60 * 60 * 1000
    expect(ms).toBeGreaterThanOrEqual(base)
    expect(ms).toBeLessThanOrEqual(base + 5 * 60 * 1000)
  })

  it('caps at 24h regardless of large retryCount', () => {
    const cap = 24 * 60 * 60 * 1000
    const ms = defaultRetryBackoffMs(50)
    expect(ms).toBeLessThanOrEqual(cap + 5 * 60 * 1000)
  })
})

// ---------------------------------------------------------------------------
// DB-availability gate (shared across every public function)
// ---------------------------------------------------------------------------

describe('DB availability gate', () => {
  it('insertPending throws AmoeServerError(amoe_db_unavailable) when getDb returns null', async () => {
    getDbMock.mockResolvedValueOnce(null)
    let err: unknown = null
    try {
      await insertPending({
        signupId: 12345n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 100n,
        spendRefId: 'zk:abc',
        pointsBurned: 500,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_db_unavailable')
  })

  it('findById throws when getDb returns null', async () => {
    getDbMock.mockResolvedValueOnce(null)
    let err: unknown = null
    try {
      await findById(SUBMISSION_ID)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
  })
})

// ---------------------------------------------------------------------------
// insertPending — input validation
// ---------------------------------------------------------------------------

describe('insertPending — input validation', () => {
  async function expectBadRequest(promise: Promise<unknown>, code: string) {
    let err: unknown = null
    try {
      await promise
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe(code)
  }

  it('rejects non-positive signupId', async () => {
    await expectBadRequest(
      insertPending({
        signupId: 0n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 100n,
        spendRefId: 'zk:abc',
        pointsBurned: 500,
      }),
      'amoe_signup_id_invalid',
    )
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('rejects non-positive epoch', async () => {
    await expectBadRequest(
      insertPending({
        signupId: 1n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 0n,
        spendRefId: 'zk:abc',
        pointsBurned: 500,
      }),
      'amoe_epoch_invalid',
    )
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('rejects empty spendRefId', async () => {
    await expectBadRequest(
      insertPending({
        signupId: 1n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 100n,
        spendRefId: '   ',
        pointsBurned: 500,
      }),
      'amoe_spend_ref_empty',
    )
  })

  it('rejects non-positive pointsBurned', async () => {
    await expectBadRequest(
      insertPending({
        signupId: 1n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 100n,
        spendRefId: 'zk:abc',
        pointsBurned: 0,
      }),
      'amoe_points_burned_invalid',
    )
  })

  it('rejects non-integer pointsBurned', async () => {
    await expectBadRequest(
      insertPending({
        signupId: 1n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 100n,
        spendRefId: 'zk:abc',
        pointsBurned: 1.5,
      }),
      'amoe_points_burned_invalid',
    )
  })
})

// ---------------------------------------------------------------------------
// insertPending — happy path
// ---------------------------------------------------------------------------

describe('insertPending — happy path', () => {
  it('inserts a pending row, lowercases addresses, returns generated id', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([{ id: SUBMISSION_ID }])
    getDbMock.mockResolvedValueOnce(db)

    const id = await insertPending({
      signupId: 12345n,
      wallet: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      creatorCoin: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      epoch: 100n,
      spendRefId: 'zk:abc-def',
      pointsBurned: 500,
    })

    expect(id).toBe(SUBMISSION_ID)
    expect(calls.length).toBe(FIRST_OP_IDX + 1)
    const insert = calls[FIRST_OP_IDX]!
    const sqlText = insert.strings.join('?')
    expect(sqlText).toMatch(/INSERT\s+INTO\s+amoe_zk_submissions/i)
    expect(sqlText).toMatch(/VALUES/i)
    expect(sqlText).toMatch(/RETURNING\s+id/i)
    expect(insert.values[0]).toBe('12345')
    expect(insert.values[1]).toBe(VALID_WALLET.toLowerCase())
    expect(insert.values[2]).toBe(VALID_CREATOR.toLowerCase())
    expect(insert.values[3]).toBe('100')
    expect(insert.values[4]).toBe('zk:abc-def')
    expect(insert.values[5]).toBe(500)
  })

  it('throws amoe_replay_insert_failed when RETURNING is empty', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await insertPending({
        signupId: 1n,
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        epoch: 100n,
        spendRefId: 'zk:abc',
        pointsBurned: 500,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_replay_insert_failed')
  })
})

// ---------------------------------------------------------------------------
// findById / findActiveByNonceCommit
// ---------------------------------------------------------------------------

describe('findById', () => {
  it('returns null when not found', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)

    const row = await findById(SUBMISSION_ID)
    expect(row).toBeNull()
  })

  it('returns the typed row, converting bigints + lowercase + JSONB', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({
        signup_id: '99999',
        wallet_address: '0xAaAaAa1111111111111111111111111111111111',
        creator_coin: '0xBBBBBB2222222222222222222222222222222222',
        epoch: '7',
        nonce_commit_hex: NONCE_COMMIT,
        wallet_commit_hex: WALLET_COMMIT,
        points_burn_nullifier_hex: POINTS_NULL,
        proof_blob: SAMPLE_PROOF_BLOB,
        block_number: '101',
        manager_entry_id: '42',
        state: 'settled',
        retry_count: 2,
      }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const row = await findById(SUBMISSION_ID)
    expect(row).not.toBeNull()
    expect(row!.signupId).toBe(99999n)
    expect(row!.wallet).toBe('0xaaaaaa1111111111111111111111111111111111')
    expect(row!.creatorCoin).toBe('0xbbbbbb2222222222222222222222222222222222')
    expect(row!.epoch).toBe(7n)
    expect(row!.blockNumber).toBe(101n)
    expect(row!.managerEntryId).toBe(42n)
    expect(row!.proofBlob).toEqual(SAMPLE_PROOF_BLOB)
    expect(row!.retryCount).toBe(2)
    expect(row!.state).toBe('settled')
  })
})

describe('findActiveByNonceCommit', () => {
  it('lowercases the nonce commit before binding', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)

    const upperCommit = `0x${'AA'.repeat(32)}` as `0x${string}`
    await findActiveByNonceCommit(upperCommit)
    const select = calls[FIRST_OP_IDX]!
    expect(select.values[0]).toBe(upperCommit.toLowerCase())
  })
})

// ---------------------------------------------------------------------------
// markProven — happy path + unique-violation collapse + state precondition
// ---------------------------------------------------------------------------

describe('markProven', () => {
  it('happy path returns proven row', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({
        nonce_commit_hex: NONCE_COMMIT,
        wallet_commit_hex: WALLET_COMMIT,
        points_burn_nullifier_hex: POINTS_NULL,
        proof_blob: SAMPLE_PROOF_BLOB,
        state: 'proven',
        proven_at: new Date('2026-04-29T01:00:00Z'),
      }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const row = await markProven(SUBMISSION_ID, {
      nonceCommitHex: NONCE_COMMIT,
      walletCommitHex: WALLET_COMMIT,
      pointsBurnNullifierHex: POINTS_NULL,
      proofBlob: SAMPLE_PROOF_BLOB,
    })
    expect(row.state).toBe('proven')
    expect(row.nonceCommitHex).toBe(NONCE_COMMIT)
  })

  it('translates PG 23505 unique-violation into AmoeBadRequestError(submission_in_flight)', async () => {
    const { db, pushSchemaBootstrapNoops, pushResult } = makeDbMock()
    pushSchemaBootstrapNoops()
    const pgErr = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    })
    pushResult(pgErr)
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await markProven(SUBMISSION_ID, {
        nonceCommitHex: NONCE_COMMIT,
        walletCommitHex: WALLET_COMMIT,
        pointsBurnNullifierHex: POINTS_NULL,
        proofBlob: SAMPLE_PROOF_BLOB,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('submission_in_flight')
  })

  it('also catches unique-violation surfaced via err.message text', async () => {
    const { db, pushSchemaBootstrapNoops, pushResult } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushResult(new Error('error: amoe_zk_submissions_nonce_commit_unique violated'))
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await markProven(SUBMISSION_ID, {
        nonceCommitHex: NONCE_COMMIT,
        walletCommitHex: WALLET_COMMIT,
        pointsBurnNullifierHex: POINTS_NULL,
        proofBlob: SAMPLE_PROOF_BLOB,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('submission_in_flight')
  })

  it('on zero-rows + state=proven re-read, surfaces submission_in_flight', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([]) // UPDATE returns no row
    // findById is then called from inside markProven — schema is now
    // cached so no extra DDL is issued. Just one SELECT. But getDb()
    // is awaited again, so we need a second resolved-once mock.
    pushDefaultRows([makeRawRow({ state: 'proven' })])
    getDbMock.mockResolvedValueOnce(db)
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await markProven(SUBMISSION_ID, {
        nonceCommitHex: NONCE_COMMIT,
        walletCommitHex: WALLET_COMMIT,
        pointsBurnNullifierHex: POINTS_NULL,
        proofBlob: SAMPLE_PROOF_BLOB,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('submission_in_flight')
  })

  it('on zero-rows + state=settled re-read, surfaces submission_already_settled', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    pushDefaultRows([makeRawRow({ state: 'settled' })])
    getDbMock.mockResolvedValueOnce(db)
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await markProven(SUBMISSION_ID, {
        nonceCommitHex: NONCE_COMMIT,
        walletCommitHex: WALLET_COMMIT,
        pointsBurnNullifierHex: POINTS_NULL,
        proofBlob: SAMPLE_PROOF_BLOB,
      })
    } catch (e) {
      err = e
    }
    expect((err as Error).message).toBe('submission_already_settled')
  })
})

// ---------------------------------------------------------------------------
// markBroadcasting / markSettled
// ---------------------------------------------------------------------------

describe('markBroadcasting', () => {
  it('lowercases the optional tx hash and returns the broadcast row', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({
        state: 'broadcast',
        broadcast_at: new Date(),
        tx_hash: TX_HASH,
      }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const upperHash = `0x${'DD'.repeat(32)}` as `0x${string}`
    const row = await markBroadcasting(SUBMISSION_ID, { txHash: upperHash })
    expect(row.state).toBe('broadcast')
    const update = calls[FIRST_OP_IDX]!
    expect(update.values).toContain(upperHash.toLowerCase())
  })

  it('throws amoe_replay_state_invalid when no row matches', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await markBroadcasting(SUBMISSION_ID)
    } catch (e) {
      err = e
    }
    expect((err as Error).message).toBe('amoe_replay_state_invalid')
  })
})

describe('markSettled', () => {
  it('writes block + manager entry id and clears proof_blob', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({
        state: 'settled',
        settled_at: new Date(),
        tx_hash: TX_HASH,
        block_number: '500',
        manager_entry_id: '7',
      }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const row = await markSettled(SUBMISSION_ID, {
      txHash: TX_HASH,
      blockNumber: 500n,
      managerEntryId: 7n,
    })
    expect(row.state).toBe('settled')
    expect(row.blockNumber).toBe(500n)
    expect(row.managerEntryId).toBe(7n)

    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/proof_blob\s*=\s*NULL/i)
    expect(sqlText).toMatch(/proof_kept_until\s*=\s*NULL/i)
    expect(update.values).toContain('500')
    expect(update.values).toContain('7')
  })

  it('accepts null managerEntryId (PR 5 will backfill)', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([makeRawRow({ state: 'settled' })])
    getDbMock.mockResolvedValueOnce(db)

    await markSettled(SUBMISSION_ID, {
      txHash: TX_HASH,
      blockNumber: 0n,
      managerEntryId: null,
    })
    const update = calls[FIRST_OP_IDX]!
    expect(update.values).toContain(null)
  })
})

// ---------------------------------------------------------------------------
// markManagerDeclined
// ---------------------------------------------------------------------------

describe('markManagerDeclined', () => {
  it('records reason + tx hash + bumps retry_count', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({
        state: 'manager_declined',
        retry_count: 1,
        last_retry_error: 'lottery_paused',
        tx_hash: TX_HASH,
      }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const row = await markManagerDeclined(SUBMISSION_ID, {
      txHash: TX_HASH,
      reason: 'lottery_paused',
    })
    expect(row.state).toBe('manager_declined')
    expect(row.retryCount).toBe(1)
    expect(row.lastRetryError).toBe('lottery_paused')

    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/retry_count\s*=\s*s\.retry_count\s*\+\s*1/i)
    expect(sqlText).toMatch(/CASE\s+WHEN\s+s\.retry_count\s*\+\s*1\s*>=/i)
    // Claim flag is cleared on decline so the next cron pass can
    // re-pick the row when its backoff matures.
    expect(sqlText).toMatch(/retry_started_at\s*=\s*NULL/i)
  })

  it('uses per-count backoff via SQL unnest with ordinality (not a hardcoded backoff(0))', async () => {
    // Codex review on PR #444 — fix #3: prior implementation called
    // `defaultRetryBackoffMs(0)` once per decline so every retry was
    // scheduled ~30min out instead of exponentially backing off.
    // The fixed SQL passes a `text[]` of pre-computed ISO timestamps
    // (one per retry_count 0..maxRetries-1) and unnests it with
    // ordinality, picking the entry matching `s.retry_count + 1`.
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([makeRawRow({ state: 'manager_declined', retry_count: 1 })])
    getDbMock.mockResolvedValueOnce(db)

    await markManagerDeclined(SUBMISSION_ID, { txHash: TX_HASH, reason: 'r' })
    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/unnest\s*\(/i)
    expect(sqlText).toMatch(/::timestamptz\[\]/i)
    expect(sqlText).toMatch(/WITH\s+ORDINALITY/i)
    // The bound array MUST have one ISO entry per allowed retry slot.
    const arrayValue = update.values.find(
      (v): v is string[] =>
        Array.isArray(v) && v.length > 0 && typeof v[0] === 'string',
    ) as string[] | undefined
    expect(arrayValue).toBeDefined()
    expect(arrayValue!.length).toBe(DEFAULT_AMOE_MAX_RETRIES)
    // Every entry parses as a valid Date.
    for (const iso of arrayValue!) {
      expect(Number.isFinite(Date.parse(iso))).toBe(true)
    }
    // Backoffs must be monotonically non-decreasing modulo jitter
    // (each slot is base*2^n + uniform(0,5min)). Confirm slot[1]
    // is meaningfully later than slot[0] (well beyond the 5-min
    // jitter ceiling) — this is the actual exponential-backoff
    // assertion that catches a regression to backoffMs(0).
    const slot0 = Date.parse(arrayValue![0]!)
    const slot1 = Date.parse(arrayValue![1]!)
    expect(slot1 - slot0).toBeGreaterThan(20 * 60 * 1000)
  })

  it('binds the configured maxRetries threshold (8 by default)', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([makeRawRow({ state: 'manager_declined', retry_count: 1 })])
    getDbMock.mockResolvedValueOnce(db)

    await markManagerDeclined(SUBMISSION_ID, { txHash: TX_HASH, reason: 'r' })
    const update = calls[FIRST_OP_IDX]!
    expect(update.values).toContain(DEFAULT_AMOE_MAX_RETRIES)
  })

  it('respects an explicit nextRetryAt override', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([makeRawRow({ state: 'manager_declined' })])
    getDbMock.mockResolvedValueOnce(db)

    const overrideAt = new Date('2026-05-01T12:00:00Z')
    await markManagerDeclined(SUBMISSION_ID, {
      txHash: TX_HASH,
      reason: 'r',
      nextRetryAt: overrideAt,
    })
    const update = calls[FIRST_OP_IDX]!
    // The override is bound twice (once for the `IS NOT NULL` test,
    // once for the `::timestamptz` cast). Both entries are the same
    // ISO string, so we only assert presence.
    expect(update.values).toContain(overrideAt.toISOString())
  })
})

// ---------------------------------------------------------------------------
// Terminal transitions
// ---------------------------------------------------------------------------

describe('markProveFailed', () => {
  it('clears proof blob and truncates oversized reason to 1024 chars', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([makeRawRow({ state: 'prove_failed' })])
    getDbMock.mockResolvedValueOnce(db)

    const longReason = 'x'.repeat(2000)
    await markProveFailed(SUBMISSION_ID, longReason)
    const update = calls[FIRST_OP_IDX]!
    const boundReason = update.values.find(
      (v) => typeof v === 'string' && v.startsWith('xxx'),
    ) as string
    expect(boundReason.length).toBe(1024)
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/proof_blob\s*=\s*NULL/i)
  })

  it('throws amoe_replay_state_invalid when no row matches', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await markProveFailed(SUBMISSION_ID, 'r')
    } catch (e) {
      err = e
    }
    expect((err as Error).message).toBe('amoe_replay_state_invalid')
  })
})

describe('markRejectedChain', () => {
  it('keeps proof blob with proof_kept_until window', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([makeRawRow({ state: 'rejected_chain' })])
    getDbMock.mockResolvedValueOnce(db)

    await markRejectedChain(SUBMISSION_ID, { reason: 'bad_proof', txHash: TX_HASH })
    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/proof_kept_until\s*=/i)
    // Note: rejectedChain does NOT clear proof_blob (we keep it for forensics).
    expect(sqlText).not.toMatch(/proof_blob\s*=\s*NULL/i)
  })
})

describe('markAbandonedEpochRolled', () => {
  it('uses the fixed reason "epoch_rolled" and clears proof blob', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({ state: 'abandoned', state_reason: 'epoch_rolled' }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const row = await markAbandonedEpochRolled(SUBMISSION_ID)
    expect(row.state).toBe('abandoned')
    expect(row.stateReason).toBe('epoch_rolled')
    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/state_reason\s*=\s*'epoch_rolled'/i)
    expect(sqlText).toMatch(/proof_blob\s*=\s*NULL/i)
  })
})

// ---------------------------------------------------------------------------
// Cron picker / reclaimer / proof GC
// ---------------------------------------------------------------------------

describe('pickRetriesForCron', () => {
  it('uses FOR UPDATE SKIP LOCKED, claims by nulling next_retry_at and stamping retry_started_at', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)

    await pickRetriesForCron(50)
    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/FOR\s+UPDATE\s+SKIP\s+LOCKED/i)
    expect(sqlText).toMatch(/state\s*=\s*'manager_declined'/i)
    expect(sqlText).toMatch(/next_retry_at\s*=\s*NULL/i)
    // Two-phase claim must also stamp `retry_started_at = NOW()` so the
    // reclaim sweeper can distinguish in-flight rows from crash-stranded
    // ones (Codex review on PR #444 — fix #2).
    expect(sqlText).toMatch(/retry_started_at\s*=\s*NOW\(\)/i)
    expect(update.values).toContain(50)
  })

  it('caps the limit at 200', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)
    await pickRetriesForCron(99999)
    const update = calls[FIRST_OP_IDX]!
    expect(update.values).toContain(200)
  })

  it('floors the limit at 1', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([])
    getDbMock.mockResolvedValueOnce(db)
    await pickRetriesForCron(0)
    const update = calls[FIRST_OP_IDX]!
    expect(update.values).toContain(1)
  })

  it('returns rows mapped via rowToTyped', async () => {
    const { db, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([
      makeRawRow({
        state: 'manager_declined',
        retry_count: 2,
        nonce_commit_hex: NONCE_COMMIT,
      }),
      makeRawRow({
        id: 'b3a4b5c6-1111-2222-3333-444455556666',
        state: 'manager_declined',
        retry_count: 5,
      }),
    ])
    getDbMock.mockResolvedValueOnce(db)

    const rows = await pickRetriesForCron(10)
    expect(rows.length).toBe(2)
    expect(rows[0]!.state).toBe('manager_declined')
    expect(rows[0]!.retryCount).toBe(2)
    expect(rows[1]!.retryCount).toBe(5)
  })
})

describe('reclaimStrandedRetries', () => {
  it('returns count of reclaimed rows and only resurrects sufficiently old claims', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }])
    getDbMock.mockResolvedValueOnce(db)

    const n = await reclaimStrandedRetries()
    expect(n).toBe(3)
    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/state\s*=\s*'manager_declined'/i)
    expect(sqlText).toMatch(/next_retry_at\s+IS\s+NULL/i)
    expect(sqlText).toMatch(/SET\s+next_retry_at\s*=\s*NOW\(\)/i)
    // Race-safety guard: reclaim MUST only target rows whose claim is
    // older than STRANDED_CLAIM_AGE_MS so it never fights healthy
    // in-flight retries (Codex review on PR #444 — fix #2).
    expect(sqlText).toMatch(/retry_started_at\s+IS\s+NOT\s+NULL/i)
    expect(sqlText).toMatch(/make_interval\s*\(\s*secs\s*=>/i)
    // After reclaim the claim must be cleared so the row presents as
    // fresh on the next pickup pass.
    expect(sqlText).toMatch(/retry_started_at\s*=\s*NULL/i)
    // Cutoff is bound as a number of seconds (15 min = 900s).
    expect(update.values).toContain(15 * 60)
  })
})

describe('gcExpiredProofBlobs', () => {
  it('returns count of scrubbed blobs', async () => {
    const { db, calls, pushSchemaBootstrapNoops, pushDefaultRows } = makeDbMock()
    pushSchemaBootstrapNoops()
    pushDefaultRows([{ id: 'a' }, { id: 'b' }])
    getDbMock.mockResolvedValueOnce(db)

    const n = await gcExpiredProofBlobs()
    expect(n).toBe(2)
    const update = calls[FIRST_OP_IDX]!
    const sqlText = update.strings.join('?')
    expect(sqlText).toMatch(/proof_blob\s*=\s*NULL/i)
    expect(sqlText).toMatch(/proof_kept_until\s*<=\s*NOW\(\)/i)
  })
})
