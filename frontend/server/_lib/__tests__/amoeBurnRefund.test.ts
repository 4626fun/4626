// PR 6c — `amoeBurnRefund` helper unit tests.
//
// Covers:
//
//   1. Env helpers (isAmoeBurnRefundCronEnabled, readRefundAgeSec,
//      readMaxRefundsPerTick) — defaults + overrides + bad values.
//   2. findOrphanBurns — issues the expected SQL (canary checks),
//      shapes the rows, raises on missing/invalid fields.
//   3. refundOrphanBurn — issues the INSERT, surfaces inserted vs
//      idempotent-no-op via `RETURNING id` shape.
//   4. runBurnRefundTick — composes the two, aggregates counts,
//      collects per-row errors without aborting.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_MAX_REFUNDS_PER_TICK,
  DEFAULT_REFUND_AGE_EPOCHS,
  findOrphanBurns,
  isAmoeBurnRefundCronEnabled,
  readMaxRefundsPerTick,
  readRefundAgeSec,
  refundOrphanBurn,
  runBurnRefundTick,
  type AmoeBurnRefundDb,
} from '../lottery/amoeBurnRefund.js'

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function withEnv(
  overrides: Record<string, string | undefined>,
  body: () => void,
): void {
  const previous: Record<string, string | undefined> = {}
  for (const k of Object.keys(overrides)) {
    previous[k] = process.env[k]
    if (overrides[k] === undefined) delete process.env[k]
    else process.env[k] = overrides[k]
  }
  try {
    body()
  } finally {
    for (const k of Object.keys(previous)) {
      if (previous[k] === undefined) delete process.env[k]
      else process.env[k] = previous[k]
    }
  }
}

describe('amoeBurnRefund — env helpers', () => {
  it('isAmoeBurnRefundCronEnabled is false by default', () => {
    withEnv({ AMOE_REFUND_CRON_ENABLED: undefined }, () => {
      expect(isAmoeBurnRefundCronEnabled()).toBe(false)
    })
  })

  it('isAmoeBurnRefundCronEnabled is true only on exact "1"', () => {
    withEnv({ AMOE_REFUND_CRON_ENABLED: '1' }, () => {
      expect(isAmoeBurnRefundCronEnabled()).toBe(true)
    })
    withEnv({ AMOE_REFUND_CRON_ENABLED: 'true' }, () => {
      expect(isAmoeBurnRefundCronEnabled()).toBe(false)
    })
    withEnv({ AMOE_REFUND_CRON_ENABLED: '0' }, () => {
      expect(isAmoeBurnRefundCronEnabled()).toBe(false)
    })
  })

  it('readRefundAgeSec defaults to 7 epochs (7 days)', () => {
    withEnv({ AMOE_REFUND_AGE_EPOCHS: undefined }, () => {
      expect(readRefundAgeSec()).toBe(DEFAULT_REFUND_AGE_EPOCHS * 86_400)
      expect(readRefundAgeSec()).toBe(7 * 86_400)
    })
  })

  it('readRefundAgeSec honours integer override', () => {
    withEnv({ AMOE_REFUND_AGE_EPOCHS: '3' }, () => {
      expect(readRefundAgeSec()).toBe(3 * 86_400)
    })
    withEnv({ AMOE_REFUND_AGE_EPOCHS: '14' }, () => {
      expect(readRefundAgeSec()).toBe(14 * 86_400)
    })
  })

  it('readRefundAgeSec rejects non-integer / out-of-range values', () => {
    for (const bad of ['', '0', '-1', '1.5', 'seven', 'NaN']) {
      withEnv({ AMOE_REFUND_AGE_EPOCHS: bad }, () => {
        expect(readRefundAgeSec()).toBe(DEFAULT_REFUND_AGE_EPOCHS * 86_400)
      })
    }
  })

  it('readMaxRefundsPerTick defaults to 50', () => {
    withEnv({ AMOE_REFUND_MAX_PER_TICK: undefined }, () => {
      expect(readMaxRefundsPerTick()).toBe(DEFAULT_MAX_REFUNDS_PER_TICK)
      expect(readMaxRefundsPerTick()).toBe(50)
    })
  })

  it('readMaxRefundsPerTick honours integer override', () => {
    withEnv({ AMOE_REFUND_MAX_PER_TICK: '10' }, () => {
      expect(readMaxRefundsPerTick()).toBe(10)
    })
  })

  it('readMaxRefundsPerTick rejects bad values', () => {
    for (const bad of ['', '0', '-1', '2.5', 'fifty']) {
      withEnv({ AMOE_REFUND_MAX_PER_TICK: bad }, () => {
        expect(readMaxRefundsPerTick()).toBe(DEFAULT_MAX_REFUNDS_PER_TICK)
      })
    }
  })
})

// ---------------------------------------------------------------------------
// SQL canary helpers
// ---------------------------------------------------------------------------

interface CapturedSqlCall {
  text: string
  params: unknown[]
}

function captureDb(
  responder: (text: string, params: unknown[]) => Promise<{ rows: unknown[] }>,
): { db: AmoeBurnRefundDb; calls: CapturedSqlCall[] } {
  const calls: CapturedSqlCall[] = []
  const db: AmoeBurnRefundDb = {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join('?')
      calls.push({ text, params: values })
      return responder(text, values)
    }),
  }
  return { db, calls }
}

// ---------------------------------------------------------------------------
// findOrphanBurns
// ---------------------------------------------------------------------------

describe('amoeBurnRefund — findOrphanBurns', () => {
  it('shapes rows and returns oldest-first', async () => {
    const { db } = captureDb(async () => ({
      rows: [
        {
          points_id: '42',
          signup_id: 7n,
          spend_ref_id: 'spend:abc',
          amount: -500,
          created_at: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
          points_id: 99,
          signup_id: '11',
          spend_ref_id: 'spend:def',
          amount: '-1000',
          created_at: '2026-04-02T00:00:00.000Z',
        },
      ],
    }))

    const out = await findOrphanBurns(db, { ageSec: 86_400, limit: 50 })

    expect(out).toEqual([
      {
        pointsId: 42n,
        signupId: 7n,
        spendRefId: 'spend:abc',
        pointsBurned: 500,
        burnedAt: '2026-04-01T00:00:00.000Z',
      },
      {
        pointsId: 99n,
        signupId: 11n,
        spendRefId: 'spend:def',
        pointsBurned: 1000,
        burnedAt: '2026-04-02T00:00:00.000Z',
      },
    ])
  })

  it('issues SELECT with the orphan-detection predicates', async () => {
    const { db, calls } = captureDb(async () => ({ rows: [] }))
    await findOrphanBurns(db, { ageSec: 86_400 * 7, limit: 25 })
    expect(calls.length).toBe(1)
    const text = calls[0]!.text
    // Source filter
    expect(text).toMatch(/p\.source = \?/)
    expect(calls[0]!.params).toContain('amoe_entry_spend')
    // Settlement-skip subquery (state='settled' is parameterised)
    expect(text).toMatch(/amoe_zk_submissions/i)
    expect(text).toMatch(/s\.state = \?/i)
    expect(calls[0]!.params).toContain('settled')
    // Refund-skip subquery (source='amoe_entry_refund' is parameterised)
    expect(text).toMatch(/r\.source = \?/i)
    expect(calls[0]!.params).toContain('amoe_entry_refund')
    // Age cutoff via INTERVAL multiplication, ageSec passed as a param
    expect(text).toMatch(/INTERVAL '1 second' \* \?/)
    expect(calls[0]!.params).toContain(86_400 * 7)
    // Oldest-first + bounded
    expect(text).toMatch(/ORDER BY p\.created_at ASC/)
    expect(text).toMatch(/LIMIT \?/)
    expect(calls[0]!.params).toContain(25)
  })

  it('rejects positive amounts (data corruption)', async () => {
    const { db } = captureDb(async () => ({
      rows: [
        {
          points_id: '1',
          signup_id: 1n,
          spend_ref_id: 'spend:x',
          amount: 100, // positive — invalid for a debit row
          created_at: new Date(),
        },
      ],
    }))
    await expect(findOrphanBurns(db, { ageSec: 1, limit: 1 })).rejects.toThrow(
      /amoe_refund_invalid_amount/,
    )
  })

  it('rejects missing spend_ref_id', async () => {
    const { db } = captureDb(async () => ({
      rows: [
        {
          points_id: '1',
          signup_id: 1n,
          spend_ref_id: null,
          amount: -100,
          created_at: new Date(),
        },
      ],
    }))
    await expect(findOrphanBurns(db, { ageSec: 1, limit: 1 })).rejects.toThrow(
      /amoe_refund_invalid_spend_ref_id/,
    )
  })

  it('rejects bad ageSec / limit', async () => {
    const { db } = captureDb(async () => ({ rows: [] }))
    await expect(findOrphanBurns(db, { ageSec: 0, limit: 1 })).rejects.toThrow(
      /amoe_refund_invalid_age_sec/,
    )
    await expect(findOrphanBurns(db, { ageSec: 1, limit: 0 })).rejects.toThrow(
      /amoe_refund_invalid_limit/,
    )
    await expect(findOrphanBurns(db, { ageSec: 1, limit: 1.5 })).rejects.toThrow(
      /amoe_refund_invalid_limit/,
    )
  })

  it('returns empty array when no rows match', async () => {
    const { db } = captureDb(async () => ({ rows: [] }))
    const out = await findOrphanBurns(db, { ageSec: 86_400, limit: 50 })
    expect(out).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// refundOrphanBurn
// ---------------------------------------------------------------------------

describe('amoeBurnRefund — refundOrphanBurn', () => {
  it('issues INSERT ... ON CONFLICT DO NOTHING with positive amount', async () => {
    const { db, calls } = captureDb(async () => ({
      rows: [{ id: '101' }],
    }))
    const out = await refundOrphanBurn(db, {
      signupId: 7n,
      spendRefId: 'spend:abc',
      pointsBurned: 500,
    })
    expect(out).toEqual({ inserted: true })
    expect(calls.length).toBe(1)
    const text = calls[0]!.text
    expect(text).toMatch(/INSERT INTO points/)
    expect(text).toMatch(/ON CONFLICT DO NOTHING/)
    expect(text).toMatch(/RETURNING id/)
    expect(calls[0]!.params).toContain(7n)
    expect(calls[0]!.params).toContain('amoe_entry_refund')
    expect(calls[0]!.params).toContain('spend:abc')
    expect(calls[0]!.params).toContain(500)
  })

  it('reports inserted=false when ON CONFLICT swallows the insert', async () => {
    const { db } = captureDb(async () => ({ rows: [] }))
    const out = await refundOrphanBurn(db, {
      signupId: 7n,
      spendRefId: 'spend:abc',
      pointsBurned: 500,
    })
    expect(out).toEqual({ inserted: false })
  })

  it('rejects non-positive points', async () => {
    const { db } = captureDb(async () => ({ rows: [] }))
    await expect(
      refundOrphanBurn(db, { signupId: 1n, spendRefId: 'r', pointsBurned: 0 }),
    ).rejects.toThrow(/amoe_refund_invalid_points_burned/)
    await expect(
      refundOrphanBurn(db, { signupId: 1n, spendRefId: 'r', pointsBurned: -10 }),
    ).rejects.toThrow(/amoe_refund_invalid_points_burned/)
    await expect(
      refundOrphanBurn(db, { signupId: 1n, spendRefId: 'r', pointsBurned: 1.5 }),
    ).rejects.toThrow(/amoe_refund_invalid_points_burned/)
  })

  it('rejects empty spend_ref_id', async () => {
    const { db } = captureDb(async () => ({ rows: [] }))
    await expect(
      refundOrphanBurn(db, { signupId: 1n, spendRefId: '', pointsBurned: 100 }),
    ).rejects.toThrow(/amoe_refund_invalid_spend_ref_id/)
  })
})

// ---------------------------------------------------------------------------
// runBurnRefundTick
// ---------------------------------------------------------------------------

describe('amoeBurnRefund — runBurnRefundTick', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    // Pin env so reads inside the tick are deterministic.
    const previous: Record<string, string | undefined> = {
      AMOE_REFUND_AGE_EPOCHS: process.env.AMOE_REFUND_AGE_EPOCHS,
      AMOE_REFUND_MAX_PER_TICK: process.env.AMOE_REFUND_MAX_PER_TICK,
    }
    process.env.AMOE_REFUND_AGE_EPOCHS = '7'
    process.env.AMOE_REFUND_MAX_PER_TICK = '50'
    restoreEnv = () => {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
  })

  it('returns zero counts when no orphans', async () => {
    const { db } = captureDb(async () => ({ rows: [] }))
    const result = await runBurnRefundTick(db)
    expect(result).toEqual({ scannedCount: 0, refundedCount: 0, errors: [] })
  })

  it('aggregates inserted vs idempotent rows', async () => {
    let call = 0
    const { db } = captureDb(async (text) => {
      call += 1
      if (/SELECT[\s\S]+FROM points AS p/i.test(text)) {
        return {
          rows: [
            {
              points_id: '1',
              signup_id: 7n,
              spend_ref_id: 'a',
              amount: -500,
              created_at: new Date(),
            },
            {
              points_id: '2',
              signup_id: 8n,
              spend_ref_id: 'b',
              amount: -1000,
              created_at: new Date(),
            },
            {
              points_id: '3',
              signup_id: 9n,
              spend_ref_id: 'c',
              amount: -200,
              created_at: new Date(),
            },
          ],
        }
      }
      // Refund INSERTs — first row inserted, second swallowed, third inserted.
      // Sequence: scan(1) -> insert#1(2) -> insert#2(3) -> insert#3(4)
      if (call === 2) return { rows: [{ id: 'X1' }] }
      if (call === 3) return { rows: [] }
      if (call === 4) return { rows: [{ id: 'X3' }] }
      return { rows: [] }
    })
    const result = await runBurnRefundTick(db)
    expect(result.scannedCount).toBe(3)
    expect(result.refundedCount).toBe(2)
    expect(result.errors).toEqual([])
  })

  it('captures per-row errors without aborting the tick', async () => {
    let call = 0
    const { db } = captureDb(async (text) => {
      call += 1
      if (/SELECT[\s\S]+FROM points AS p/i.test(text)) {
        return {
          rows: [
            {
              points_id: '1',
              signup_id: 7n,
              spend_ref_id: 'a',
              amount: -500,
              created_at: new Date(),
            },
            {
              points_id: '2',
              signup_id: 8n,
              spend_ref_id: 'b',
              amount: -1000,
              created_at: new Date(),
            },
          ],
        }
      }
      // First INSERT throws; second succeeds.
      if (call === 2) throw new Error('simulated_unique_violation')
      if (call === 3) return { rows: [{ id: 'X2' }] }
      return { rows: [] }
    })
    const result = await runBurnRefundTick(db)
    expect(result.scannedCount).toBe(2)
    expect(result.refundedCount).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({
      pointsId: '1',
      message: expect.stringContaining('simulated_unique_violation'),
    })
  })

  it('honours explicit ageSec / limit overrides', async () => {
    const { db, calls } = captureDb(async () => ({ rows: [] }))
    await runBurnRefundTick(db, { ageSec: 999, limit: 7 })
    // Find the SELECT call and check params.
    const select = calls.find((c) => /FROM points AS p/.test(c.text))
    expect(select).toBeDefined()
    expect(select!.params).toContain(999)
    expect(select!.params).toContain(7)
  })
})
