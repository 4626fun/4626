// PR 3 — `amoeNonceStore` unit tests.
//
// Coverage:
//   1. Input validation — bad nonce / wallet / creator-coin formats are
//      rejected before any DB call. This must surface as
//      `AmoeBadRequestError('invalid_nonce')`.
//   2. DB-unavailable path — the ZK submit handler MUST refuse to fall
//      back to in-memory mode (legacy `consumeAmoeNonce` does, the ZK
//      path does NOT). Surfaces as `AmoeServerError('amoe_db_unavailable')`.
//   3. Conditional UPDATE — wallet/creator-coin are lowercased before
//      binding, and the SQL is the single conditional UPDATE that
//      atomically marks the row consumed.
//   4. Failure modes — when the UPDATE returns zero rows (consumed,
//      expired, mismatched, never issued), surface a single collapsed
//      error code `nonce_already_used`. We deliberately don't leak which
//      of the four conditions caused the failure (timing-attack hardening).
//
// The vi.mock pattern follows the project convention used in
// `api/__tests__/accountsMe.test.ts` for `getDb`.

import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

import { consumeAmoeNonceForSubmit } from '../lottery/amoeNonceStore.js'
import {
  AmoeBadRequestError,
  AmoeServerError,
} from '../lottery/lotteryAmoeErrors.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_WALLET = '0x1111111111111111111111111111111111111111' as const
const VALID_CREATOR = '0x2222222222222222222222222222222222222222' as const
const VALID_NONCE = `0x${'ab'.repeat(32)}` as `0x${string}`

interface SqlCall {
  strings: TemplateStringsArray
  values: unknown[]
}

/**
 * Build a vitest mock that captures all `db.sql\`...\`` invocations and
 * returns a configurable `{rows: [...]}` payload. Keeps the existing
 * `db.sql` tagged-template surface intact.
 */
function makeDbMock(
  initialRows: ReadonlyArray<Record<string, unknown>> = [],
): {
  db: { sql: ReturnType<typeof vi.fn> }
  calls: SqlCall[]
  setNextRows: (rows: ReadonlyArray<Record<string, unknown>>) => void
} {
  const calls: SqlCall[] = []
  let nextRows: ReadonlyArray<Record<string, unknown>> = initialRows
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings, values })
    return { rows: nextRows.slice() }
  })
  return {
    db: { sql: sql as unknown as ReturnType<typeof vi.fn> },
    calls,
    setNextRows: (rows) => {
      nextRows = rows
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('consumeAmoeNonceForSubmit — input validation', () => {
  it('rejects a non-bytes32 nonce', async () => {
    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: '0xdeadbeef' as `0x${string}`,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('invalid_nonce')
    // No DB call should have been issued.
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed wallet', async () => {
    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: '0xZZZ' as `0x${string}`,
        creatorCoin: VALID_CREATOR,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('invalid_nonce')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed creatorCoin', async () => {
    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: '0x123' as `0x${string}`,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('invalid_nonce')
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('rejects a non-hex bytes32 nonce (correct length, wrong charset)', async () => {
    const badNonce = `0x${'zz'.repeat(32)}` as `0x${string}`
    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: badNonce,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('invalid_nonce')
  })
})

describe('consumeAmoeNonceForSubmit — database availability', () => {
  it('throws AmoeServerError(amoe_db_unavailable) when getDb returns null', async () => {
    getDbMock.mockResolvedValueOnce(null)
    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_db_unavailable')
  })

  it('throws AmoeServerError(amoe_db_unavailable) when getDb returns undefined', async () => {
    getDbMock.mockResolvedValueOnce(undefined)
    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeServerError)
    expect((err as Error).message).toBe('amoe_db_unavailable')
  })
})

describe('consumeAmoeNonceForSubmit — happy path', () => {
  it('issues a single conditional UPDATE and resolves on success', async () => {
    const { db, calls } = makeDbMock([{ nonce: VALID_NONCE }])
    getDbMock.mockResolvedValueOnce(db)

    await consumeAmoeNonceForSubmit({
      wallet: VALID_WALLET,
      creatorCoin: VALID_CREATOR,
      nonce: VALID_NONCE,
    })

    // Exactly one SQL call.
    expect(calls.length).toBe(1)

    // Verify the SQL is the conditional UPDATE — check key fragments.
    const sqlText = calls[0]!.strings.join('?')
    expect(sqlText).toMatch(/UPDATE\s+lottery_amoe_nonces/i)
    expect(sqlText).toMatch(/SET\s+consumed_at\s*=\s*NOW\(\)/i)
    expect(sqlText).toMatch(/consumed_at\s+IS\s+NULL/i)
    expect(sqlText).toMatch(/expires_at\s*>\s*NOW\(\)/i)
    expect(sqlText).toMatch(/RETURNING\s+nonce/i)
  })

  it('lowercases wallet and creatorCoin before binding to the UPDATE', async () => {
    const { db, calls } = makeDbMock([{ nonce: VALID_NONCE }])
    getDbMock.mockResolvedValueOnce(db)

    const upperWallet = '0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa' as `0x${string}`
    const upperCreator = '0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb' as `0x${string}`
    await consumeAmoeNonceForSubmit({
      wallet: upperWallet,
      creatorCoin: upperCreator,
      nonce: VALID_NONCE,
    })

    expect(calls.length).toBe(1)
    // The order in the SQL is `nonce, wallet, creator_coin` — see the
    // implementation. Bind args land in that order.
    const [boundNonce, boundWallet, boundCreator] = calls[0]!.values
    expect(boundNonce).toBe(VALID_NONCE)
    expect(boundWallet).toBe(upperWallet.toLowerCase())
    expect(boundCreator).toBe(upperCreator.toLowerCase())
  })
})

describe('consumeAmoeNonceForSubmit — failure collapsing', () => {
  it('throws nonce_already_used when UPDATE returns zero rows', async () => {
    const { db } = makeDbMock([])
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('nonce_already_used')
  })

  it('throws nonce_already_used when row exists but column is missing', async () => {
    // Defense-in-depth: empty-object row should be treated as "no real
    // RETURNING value" rather than as success.
    const { db } = makeDbMock([{} as Record<string, unknown>])
    getDbMock.mockResolvedValueOnce(db)

    let err: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(AmoeBadRequestError)
    expect((err as Error).message).toBe('nonce_already_used')
  })

  it('does NOT differentiate failure modes (timing-attack hardening)', async () => {
    // We collapse "consumed", "expired", "wrong wallet", "wrong creator",
    // and "never issued" into the same public error string. The handler
    // shouldn't be able to tell them apart from the response alone.
    const { db } = makeDbMock([])
    getDbMock.mockResolvedValueOnce(db)
    getDbMock.mockResolvedValueOnce(db)

    let err1: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: VALID_NONCE,
      })
    } catch (e) {
      err1 = e
    }
    let err2: unknown = null
    try {
      await consumeAmoeNonceForSubmit({
        wallet: VALID_WALLET,
        creatorCoin: VALID_CREATOR,
        nonce: `0x${'cd'.repeat(32)}` as `0x${string}`,
      })
    } catch (e) {
      err2 = e
    }
    expect((err1 as Error).message).toBe((err2 as Error).message)
    expect((err1 as Error).message).toBe('nonce_already_used')
  })
})
