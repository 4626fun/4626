// PR 5a — `amoeLedgerProjector` unit tests.
//
// Covers the L0 → L1 projection contract:
//   * SQL window narrowing to a single epoch's [start, end)
//   * Salt requirement (read-time failure if AMOE_SIGNUP_SALT unset)
//   * Idempotency via UNIQUE(source_points_id) — re-running counts as
//     `alreadyPresent`, not `projected`
//   * Field-element derivation matches the witness module's helpers
//     bit-exactly (Poseidon5 leaf, Poseidon2 walletAddrCommit)
//   * Skipped rows: missing context (lookup returns null), out-of-range
//     points, malformed source_id
//   * Epoch-boundary assertion catches a mis-classified row
//
// Mocking strategy: rather than mocking `getDb`, the projector accepts a
// db-pool param directly so tests inject an in-memory implementation
// that captures every db.sql template call.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'

import {
  AMOE_ENTRY_SPEND_SOURCE,
  AMOE_POINTS_TO_USD_E6,
  projectAmoeBurnsToLedger,
} from '../lottery/amoeLedgerProjector.js'
import {
  AMOE_EPOCH_GENESIS_SECONDS,
  AMOE_EPOCH_LENGTH_SECONDS,
  computeAmoeLedgerLeaf,
  computeAmoeWalletAddrCommit,
} from '../lottery/amoeWitness.js'
import {
  deriveSignupIdHash,
  deriveSpendRefIdHash,
  readAmoeSignupSalt,
} from '../lottery/amoeIdentifiers.js'

// Fixture salt — same convention as amoeIdentifiers.test.ts. 32 bytes of
// 0xab so we can trivially reproduce the salt vector by eye.
const FIXTURE_SALT_HEX = 'ab'.repeat(32)
const FIXTURE_SALT = new Uint8Array(32).fill(0xab)

interface CapturedSql {
  textParts: ReadonlyArray<string>
  values: unknown[]
}

function makeCapturingDb(rowsByCallIndex: ReadonlyArray<{ rows: unknown[] }>) {
  const calls: CapturedSql[] = []
  let i = 0
  return {
    calls,
    db: {
      sql: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<{ rows: unknown[] }> => {
        calls.push({ textParts: Array.from(strings), values })
        const result = rowsByCallIndex[i] ?? { rows: [] }
        i += 1
        return result
      },
    },
  }
}

describe('projectAmoeBurnsToLedger', () => {
  beforeEach(() => {
    process.env.AMOE_SIGNUP_SALT = FIXTURE_SALT_HEX
  })
  afterEach(() => {
    delete process.env.AMOE_SIGNUP_SALT
  })

  it('refuses to run when AMOE_SIGNUP_SALT is unset', async () => {
    delete process.env.AMOE_SIGNUP_SALT
    const { db } = makeCapturingDb([])
    await expect(
      projectAmoeBurnsToLedger({
        db,
        epoch: 0n,
        publisherRunId: '00000000-0000-0000-0000-000000000001',
        lookupBurnContext: async () => null,
      }),
    ).rejects.toThrow(/amoe_signup_salt_misconfigured/)
  })

  it('narrows the SQL scan to the requested epoch window', async () => {
    const { calls, db } = makeCapturingDb([{ rows: [] }])
    await projectAmoeBurnsToLedger({
      db,
      epoch: 5n,
      publisherRunId: '00000000-0000-0000-0000-000000000002',
      lookupBurnContext: async () => null,
    })
    expect(calls).toHaveLength(1)
    const select = calls[0]!
    // Bound values are: source-tag, start_sec, end_sec, afterId, batchSize.
    const [tag, startSec, endSec, afterId, batchSize] = select.values
    expect(tag).toBe(AMOE_ENTRY_SPEND_SOURCE)
    const expectedStart = AMOE_EPOCH_GENESIS_SECONDS + 5n * AMOE_EPOCH_LENGTH_SECONDS
    const expectedEnd = expectedStart + AMOE_EPOCH_LENGTH_SECONDS
    expect(startSec).toBe(expectedStart.toString())
    expect(endSec).toBe(expectedEnd.toString())
    expect(afterId).toBe('0') // default cursor
    expect(batchSize).toBe('1000') // default
    // Sanity: SELECT touches `points` and filters by source + amount<0
    const text = select.textParts.join('?')
    expect(text).toMatch(/FROM points/i)
    expect(text).toMatch(/source\s*=/i)
    expect(text).toMatch(/amount\s*<\s*0/i)
    expect(text).toMatch(/created_at\s*>=\s*to_timestamp/i)
  })

  it('anti-joins against amoe_points_burn_ledger so projected rows are not re-scanned', async () => {
    // Codex review (PR #445): without an anti-join, ORDER BY id ASC LIMIT
    // batchSize would re-read the same earliest rows on every call and
    // rows past the first batch would never get projected. This test
    // pins the SQL contract so that regression cannot land silently.
    const { calls, db } = makeCapturingDb([{ rows: [] }])
    await projectAmoeBurnsToLedger({
      db,
      epoch: 3n,
      publisherRunId: '00000000-0000-0000-0000-000000000007',
      lookupBurnContext: async () => null,
    })
    expect(calls).toHaveLength(1)
    const text = calls[0]!.textParts.join('?')
    // NOT EXISTS subquery against amoe_points_burn_ledger by source_points_id.
    expect(text).toMatch(/NOT\s+EXISTS/i)
    expect(text).toMatch(/FROM\s+amoe_points_burn_ledger/i)
    expect(text).toMatch(/source_points_id\s*=\s*p\.id/i)
    // Cursor predicate is present even on the default path.
    expect(text).toMatch(/p\.id\s*>\s*\?::bigint/i)
  })

  it('respects the afterId cursor and surfaces lastScannedId on the result', async () => {
    // Permanently-skipped rows (lookup returns null) cannot be inserted
    // into L1, so the anti-join would still surface them on every call.
    // The publisher cron breaks that loop by passing the previous
    // lastScannedId back in as `afterId`. This test pins both the
    // forwarded bind and the surfaced result.
    const epoch = 0n
    const createdAtMs =
      Number((AMOE_EPOCH_GENESIS_SECONDS + 50n) * 1000n)
    const candidates = [
      { id: 17, signup_id: 1, source_id: 'amoe-spend:a', amount: -150, created_at: new Date(createdAtMs) },
      { id: 21, signup_id: 2, source_id: 'amoe-spend:b', amount: -250, created_at: new Date(createdAtMs) },
    ]
    const { calls, db } = makeCapturingDb([{ rows: candidates }])
    const result = await projectAmoeBurnsToLedger({
      db,
      epoch,
      publisherRunId: '00000000-0000-0000-0000-000000000008',
      lookupBurnContext: async () => null, // skip everything
      afterId: 9n,
    })
    // Cursor flowed through to the SQL bind (4th value).
    const [, , , afterId] = calls[0]!.values
    expect(afterId).toBe('9')
    // Result advances the cursor for the publisher's next call.
    expect(result.scanned).toBe(2)
    expect(result.projected).toBe(0)
    expect(result.skippedMissingContext).toBe(2)
    expect(result.lastScannedId).toBe(21n)
  })

  it('projects a single in-bounds burn with bit-exact field elements', async () => {
    const epoch = 0n
    const wallet = '0x1234567890abcdef1234567890abcdef12345678'
    // High byte 0x01 keeps the value below the BN254 field modulus (~0x30644e72…).
    const twitterCreditNullifierHex =
      '0x01' + 'cd'.repeat(31)
    // pick a created_at strictly inside epoch 0
    const createdAtMs =
      Number((AMOE_EPOCH_GENESIS_SECONDS + 100n) * 1000n)
    const candidate = {
      id: 42,
      signup_id: 7,
      source_id: 'amoe-spend:abc',
      amount: -200, // 200 points → $20 → 200_000 USD-1e6
      created_at: new Date(createdAtMs),
    }
    const { calls, db } = makeCapturingDb([
      { rows: [candidate] }, // SELECT
      { rows: [{ source_points_id: 42 }] }, // INSERT (returning a row)
    ])

    const result = await projectAmoeBurnsToLedger({
      db,
      epoch,
      publisherRunId: '00000000-0000-0000-0000-000000000099',
      lookupBurnContext: async () => ({
        walletAddress: wallet,
        twitterCreditNullifierHex,
      }),
    })

    expect(result.scanned).toBe(1)
    expect(result.projected).toBe(1)
    expect(result.alreadyPresent).toBe(0)
    expect(result.skippedMissingContext).toBe(0)
    expect(result.rows).toHaveLength(1)

    // Independently re-derive the field elements and compare.
    const salt = readAmoeSignupSalt()
    expect(Buffer.from(salt).toString('hex')).toBe(FIXTURE_SALT_HEX)
    expect(salt).toEqual(FIXTURE_SALT)

    const expectedSignupIdHash = deriveSignupIdHash({
      profileId: 7n,
      salt: FIXTURE_SALT,
    })
    const expectedSpendRefIdHash = deriveSpendRefIdHash({
      spendRefId: 'amoe-spend:abc',
      salt: FIXTURE_SALT,
    })
    const expectedPointsBurnedAsUSD = 200n * AMOE_POINTS_TO_USD_E6
    const walletBigint = BigInt('0x' + wallet.slice(2))
    const twitterCreditNullifier = BigInt(twitterCreditNullifierHex)
    const expectedWalletAddrCommit = computeAmoeWalletAddrCommit(
      walletBigint,
      twitterCreditNullifier,
    )
    const expectedLeaf = computeAmoeLedgerLeaf(
      expectedSignupIdHash,
      expectedSpendRefIdHash,
      expectedPointsBurnedAsUSD,
      epoch,
      expectedWalletAddrCommit,
    )

    const projected = result.rows[0]!
    expect(projected.signupId).toBe(7n)
    expect(projected.spendRefId).toBe('amoe-spend:abc')
    expect(projected.pointsBurned).toBe(200n)
    expect(projected.epoch).toBe(0n)
    expect(projected.pointsBurnedAsUSD).toBe(expectedPointsBurnedAsUSD)
    expect(BigInt(projected.signupIdHashHex)).toBe(expectedSignupIdHash)
    expect(BigInt(projected.spendRefIdHashHex)).toBe(expectedSpendRefIdHash)
    expect(BigInt(projected.walletAddrCommitHex)).toBe(expectedWalletAddrCommit)
    expect(BigInt(projected.leafHashHex)).toBe(expectedLeaf)
    expect(projected.sourcePointsId).toBe(42n)
    expect(projected.publisherRunId).toBe('00000000-0000-0000-0000-000000000099')

    // INSERT call should be the second SQL invocation, with ON CONFLICT
    // DO NOTHING for idempotency.
    expect(calls).toHaveLength(2)
    const insertText = calls[1]!.textParts.join('?')
    expect(insertText).toMatch(/INSERT INTO amoe_points_burn_ledger/i)
    expect(insertText).toMatch(/ON CONFLICT \(source_points_id\) DO NOTHING/i)
    expect(insertText).toMatch(/RETURNING source_points_id/i)
  })

  it('counts already-present rows as alreadyPresent (idempotent re-run)', async () => {
    const wallet = '0x' + 'aa'.repeat(20)
    const twitterCreditNullifierHex = '0x01' + 'cd'.repeat(31)
    const createdAtMs = Number((AMOE_EPOCH_GENESIS_SECONDS + 200n) * 1000n)
    const { db } = makeCapturingDb([
      {
        rows: [
          {
            id: 100,
            signup_id: 11,
            source_id: 'sref-A',
            amount: -150,
            created_at: new Date(createdAtMs),
          },
        ],
      },
      // INSERT returns no rows → ON CONFLICT swallowed it.
      { rows: [] },
    ])

    const result = await projectAmoeBurnsToLedger({
      db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000003',
      lookupBurnContext: async () => ({
        walletAddress: wallet,
        twitterCreditNullifierHex,
      }),
    })
    expect(result.scanned).toBe(1)
    expect(result.projected).toBe(0)
    expect(result.alreadyPresent).toBe(1)
    expect(result.skippedMissingContext).toBe(0)
    // The reported row is still emitted so callers can audit it.
    expect(result.rows).toHaveLength(1)
  })

  it('skips rows when the lookup callback returns null', async () => {
    const createdAtMs = Number((AMOE_EPOCH_GENESIS_SECONDS + 300n) * 1000n)
    const { calls, db } = makeCapturingDb([
      {
        rows: [
          {
            id: 200,
            signup_id: 22,
            source_id: 'sref-B',
            amount: -500,
            created_at: new Date(createdAtMs),
          },
        ],
      },
    ])
    const result = await projectAmoeBurnsToLedger({
      db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000004',
      lookupBurnContext: async () => null,
    })
    expect(result.scanned).toBe(1)
    expect(result.projected).toBe(0)
    expect(result.alreadyPresent).toBe(0)
    expect(result.skippedMissingContext).toBe(1)
    // Only one SQL call (the SELECT) — INSERT was skipped.
    expect(calls).toHaveLength(1)
  })

  it('skips rows whose points are out of the AMOE [100, 1_000_000] band', async () => {
    const createdAtMs = Number((AMOE_EPOCH_GENESIS_SECONDS + 400n) * 1000n)
    const { db } = makeCapturingDb([
      {
        rows: [
          // 50 points — below AMOE minimum of 100
          {
            id: 300,
            signup_id: 33,
            source_id: 'sref-too-small',
            amount: -50,
            created_at: new Date(createdAtMs),
          },
          // 2_000_000 points — above AMOE maximum
          {
            id: 301,
            signup_id: 33,
            source_id: 'sref-too-big',
            amount: -2_000_000,
            created_at: new Date(createdAtMs),
          },
        ],
      },
    ])
    const result = await projectAmoeBurnsToLedger({
      db,
      epoch: 0n,
      publisherRunId: '00000000-0000-0000-0000-000000000005',
      lookupBurnContext: async () => ({
        walletAddress: '0x' + 'bb'.repeat(20),
        twitterCreditNullifierHex: '0x01' + 'ee'.repeat(31),
      }),
    })
    expect(result.scanned).toBe(2)
    expect(result.projected).toBe(0)
    expect(result.skippedMissingContext).toBe(2)
  })

  it('throws when a candidate row falls outside the requested epoch', async () => {
    // Window-narrowing in SQL should already prevent this, but the
    // assertion is a defense-in-depth against TZ bugs. We fabricate a
    // mismatched row to verify the assertion fires.
    const createdAtMs = Number(
      (AMOE_EPOCH_GENESIS_SECONDS + AMOE_EPOCH_LENGTH_SECONDS + 100n) * 1000n,
    )
    const { db } = makeCapturingDb([
      {
        rows: [
          {
            id: 999,
            signup_id: 1,
            source_id: 'sref-wrong-epoch',
            amount: -100,
            created_at: new Date(createdAtMs), // belongs to epoch 1, not 0
          },
        ],
      },
    ])
    await expect(
      projectAmoeBurnsToLedger({
        db,
        epoch: 0n,
        publisherRunId: '00000000-0000-0000-0000-000000000006',
        lookupBurnContext: async () => ({
          walletAddress: '0x' + 'cc'.repeat(20),
          twitterCreditNullifierHex: '0x01' + 'dd'.repeat(31),
        }),
      }),
    ).rejects.toThrow(/epoch mismatch/)
  })
})
